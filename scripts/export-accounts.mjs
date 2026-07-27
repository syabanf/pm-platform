// Generates the account sheet handed out when the app is introduced to a team.
//
// It reads the seeds rather than restating them, so the sheet cannot drift from
// what the app actually accepts: members come from src/lib/data.ts, the one-click
// accounts from the login page's own list, and the backend administrator from
// the migration that seeds it.
//
//   npm run export:accounts     -> docs/accounts.md and docs/accounts.csv
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

/** Pulls the seeded members out of the TypeScript source. */
function members() {
  const block = read("src/lib/data.ts").match(
    /export const members: Member\[\] = \[([\s\S]*?)\n\];/
  );
  if (!block) throw new Error("could not find the members seed in src/lib/data.ts");

  return block[1]
    .split(/\n  \{/)
    .slice(1)
    .map((entry) => {
      const field = (key) =>
        entry.match(new RegExp(`${key}:\\s*"([^"]*)"`))?.[1] ?? "";
      return {
        id: field("id"),
        name: field("name"),
        email: field("email"),
        roleLabel: field("roleLabel"),
        status: field("status"),
      };
    })
    .filter((m) => m.id);
}

/** The accounts the login screen offers as one-click buttons. */
function oneClickIds() {
  const m = read("src/app/login/page.tsx").match(/const DEMO_IDS = \[([^\]]*)\]/);
  return m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : [];
}

/** The administrator the backend seeds, read from the migration that seeds it. */
function backendAdmin() {
  const sql = read("backend/migrations/000005_users.up.sql");
  const email = sql.match(/VALUES \('usr-admin', '([^']+)'/)?.[1] ?? "";
  // The bootstrap password is stated in the migration's own comment; take it
  // from there so the two cannot disagree.
  const password = sql.match(/bcrypt\(cost \d+\) of "([^"]+)"/)?.[1] ?? "";
  return { email, password };
}

const people = members();
const oneClick = new Set(oneClickIds());
const admin = backendAdmin();
const generated = new Date().toISOString().slice(0, 10);

const rows = people.map((m) => ({
  ...m,
  oneClick: oneClick.has(m.id) ? "yes" : "no",
}));

// ------------------------------------------------------------------ markdown ---
const md = `# WIT Sprint OS — Akun untuk Sosialisasi

_Dibuat otomatis dari seed aplikasi pada ${generated}. Jangan diedit manual —
jalankan \`npm run export:accounts\` untuk memperbarui._

## Cara masuk

Buka **http://localhost:3000** (atau alamat tempat aplikasi dipasang).

Aplikasi ini masih **prototipe**: datanya ada di memori browser, dan
**password apa pun diterima** (asal tidak dikosongkan) — yang menentukan Anda
masuk sebagai siapa adalah **alamat email**. Reload halaman akan mengembalikan semua data ke kondisi awal,
jadi peserta bebas mencoba tanpa takut merusak apa pun.

Empat akun bertanda ⚡ tersedia sebagai tombol satu klik di layar login, tanpa
perlu mengetik apa pun.

## Akun

| | Nama | Email | Peran | Satu klik |
| --- | --- | --- | --- | --- |
${rows
  .map(
    (m) =>
      `| ${m.oneClick === "yes" ? "⚡" : ""} | ${m.name} | \`${m.email}\` | ${m.roleLabel} | ${m.oneClick === "yes" ? "ya" : "—"} |`
  )
  .join("\n")}

Email di luar daftar ini tetap bisa masuk — akan diperlakukan sebagai Delivery
Lead. Jadi peserta boleh mencoba alamatnya sendiri.

## Saran pembagian saat sosialisasi

| Peserta | Masuk sebagai | Yang paling relevan dilihat |
| --- | --- | --- |
| Delivery Lead / PM | Fahmi | Home → Needs Attention, laporan klien |
| System Analyst | Risya | Backlog dan refinement |
| Developer | Reyza | Sprint board, Daily |
| QA | Christian | Kolom QA di board, Definition of Done |
| Admin workspace | Admin | Settings: roles, master list, template laporan |

## Backend (belum dipakai aplikasi)

Bagian ini **tidak diperlukan untuk sosialisasi** — aplikasi belum terhubung ke
backend. Sertakan hanya bila yang hadir adalah tim teknis.

| | |
| --- | --- |
| Email | \`${admin.email}\` |
| Password | \`${admin.password}\` |

> Password di atas adalah **kredensial awal** yang tertulis di dalam kode
> migrasi, bukan rahasia. **Wajib diganti** sebelum backend dipakai sungguhan,
> dan jangan dibagikan di luar tim teknis.

Pendaftaran mandiri sudah tersedia di backend: \`POST /auth/register\` membuat
akun berstatus *pending*, \`POST /auth/verify\` mengaktifkannya, dan login
ditolak sebelum email terverifikasi.
`;

// ----------------------------------------------------------------------- csv ---
const csv = [
  "name,email,role,one_click,status",
  ...rows.map((m) =>
    [m.name, m.email, m.roleLabel, m.oneClick, m.status]
      .map((v) => (v.includes(",") ? `"${v}"` : v))
      .join(",")
  ),
].join("\n");

mkdirSync(new URL("../docs", import.meta.url), { recursive: true });
writeFileSync(new URL("../docs/accounts.md", import.meta.url), md);
writeFileSync(new URL("../docs/accounts.csv", import.meta.url), csv + "\n");

console.log(`docs/accounts.md and docs/accounts.csv — ${rows.length} accounts`);
console.log(`  one-click: ${rows.filter((r) => r.oneClick === "yes").map((r) => r.name).join(", ")}`);
