/**
 * Push the prototype seed into a running backend.
 *
 *   npm run seed:backend
 *
 * Signs in as the backend's administrator, then sends every record in
 * src/lib/data.ts through the same write adapters the app uses, so the seed
 * exercises the real API and a shape the server refuses fails loudly here.
 * Re-running is safe where the API upserts (templates, roles, lists,
 * settings); rows that already exist are skipped with a note.
 *
 * Each seeded member also gets an account (same email, SEED_MEMBER_PASSWORD)
 * so anyone can sign in as them in api mode.
 *
 * Environment:
 *   NEXT_PUBLIC_API_BASE   default http://localhost:8080/api/v1
 *   SEED_ADMIN_EMAIL       default admin@wit.id (migration 000005)
 *   SEED_ADMIN_PASSWORD    default wit-admin-changeme (rotate it; see backend/README.md)
 *   SEED_MEMBER_PASSWORD   default wit-demo-changeme
 */
process.env.NEXT_PUBLIC_API_BASE ??= "http://localhost:8080/api/v1";

const { api, login } = await import("../src/lib/api/client");
const persist = await import("../src/lib/api/persist");
const data = await import("../src/lib/data");

const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@wit.id";
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "wit-admin-changeme";
const memberPassword = process.env.SEED_MEMBER_PASSWORD ?? "wit-demo-changeme";

let created = 0;
let skipped = 0;

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run one write. "Already exists" is a skip, the per-IP rate limit is a short
 * wait and a retry, and anything else stops the run with the record named.
 */
async function put(label: string, call: () => Promise<void>) {
  for (let attempt = 0; ; attempt++) {
    try {
      await call();
      created++;
      return;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/already|exists|duplicate|conflict/i.test(msg)) {
        skipped++;
        return;
      }
      if (/rate limit/i.test(msg) && attempt < 10) {
        await pause(500);
        continue;
      }
      throw new Error(`${label}: ${msg}`);
    }
  }
}

await login(adminEmail, adminPassword);
console.log(`signed in as ${adminEmail}`);

for (const c of data.clients) await put(`client ${c.id}`, () => persist.clients.add(c));
for (const p of data.projects) await put(`project ${p.id}`, () => persist.projects.add(p));
for (const m of data.members) await put(`member ${m.id}`, () => persist.members.add(m));
// A module's current sprint has to exist before it can be pointed at, so the
// pointer is set after the sprints below.
for (const m of data.modules) {
  await put(`module ${m.id}`, () => persist.modules.add({ ...m, currentSprintId: undefined }));
}
for (const b of data.backlog) await put(`backlog ${b.id}`, () => persist.backlog.add(b));
for (const s of data.sprints) await put(`sprint ${s.id}`, () => persist.sprints.add(s));
for (const m of data.modules) {
  if (!m.currentSprintId) continue;
  await put(`current sprint of ${m.id}`, () =>
    persist.modules.update(m.id, { currentSprintId: m.currentSprintId }, m, m),
  );
}
for (const t of data.tasks) await put(`task ${t.id}`, () => persist.tasks.add(t));
for (const d of data.decisions) await put(`decision ${d.id}`, () => persist.decisions.add(d));
for (const n of data.retroNotes) await put(`retro note ${n.id}`, () => persist.retroNotes.add(n));
for (const a of data.retroActions) await put(`retro action ${a.id}`, () => persist.retroActions.add(a));
for (const d of data.demoItems) await put(`demo item ${d.id}`, () => persist.demoItems.add(d));
for (const f of data.clientFeedback) await put(`feedback ${f.id}`, () => persist.clientFeedback.add(f));
for (const t of data.reportTemplateMaster) await put(`template ${t.id}`, () => persist.reportTemplates.add(t));
for (const q of data.reportQueueSeed) await put(`queue ${q.id}`, () => persist.reportQueue.add(q));
// The API reads `all`, `write` and `read` from a role's permissions; the seed
// only knows the UI's capability flags. Merge, or the administrator loses the
// authority this script is running on.
const serverRoles = await api.GET("/roles");
const serverPermissions = new Map(
  (serverRoles.data ?? []).map((r) => [r.id, r.permissions ?? {}]),
);
for (const r of data.roleMatrix) {
  await put(`role ${r.id}`, () =>
    persist.saveRole({
      ...r,
      permissions: { ...serverPermissions.get(r.id), ...r.permissions },
    }),
  );
}
for (const [key, values] of Object.entries(data.masterLists)) {
  for (const [i, v] of values.entries()) {
    await put(`list ${key}/${v}`, () => persist.addMasterValue(key, v, i));
  }
}
await put("settings", () => persist.saveSettings(data.workspaceDefaults, data.defaultDodTemplate));

// Accounts last: a member row must exist for the email match at sign-in.
for (const m of data.members) {
  if (m.email.toLowerCase() === adminEmail.toLowerCase()) continue;
  await put(`account ${m.email}`, async () => {
    const { error, response } = await api.POST("/users", {
      body: { email: m.email, password: memberPassword, name: m.name },
    });
    if (error || !response.ok) {
      throw new Error((error as { error?: string })?.error ?? `HTTP ${response.status}`);
    }
  });
}

console.log(`done: ${created} written, ${skipped} already there`);
