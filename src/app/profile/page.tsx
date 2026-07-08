"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusPill } from "@/components/StatusPill";
import { Button, KpiStrip, PageContainer } from "@/components/ui";
import { usePrototype } from "@/lib/store";

export default function ProfilePage() {
  const router = useRouter();
  const { currentUser, workspaceConf, logout } = usePrototype();

  if (!currentUser) return null; // AppFrame redirects to /login

  const signOut = () => {
    logout();
    router.replace("/login");
  };

  const overloaded = currentUser.workload > 100;

  return (
    <PageContainer max="4xl">
      <div className="label">Profile</div>

      <div className="mt-4 flex flex-wrap items-start gap-5">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center text-2xl font-semibold text-paper"
          style={{ backgroundColor: workspaceConf.brandColor }}
        >
          {currentUser.name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">
            {currentUser.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {currentUser.roleLabel} · {currentUser.email}
          </p>
          <div className="mt-2">
            <StatusPill status={overloaded ? "overloaded" : currentUser.status} />
          </div>
        </div>
        <Button variant="danger" onClick={signOut}>
          Sign out
        </Button>
      </div>

      <KpiStrip
        className="mt-10"
        items={[
          { value: `${currentUser.allocation}%`, label: "Allocation" },
          { value: currentUser.capacityDays, label: "Sprint Capacity" },
          {
            value: `${currentUser.workload}%`,
            label: "Workload",
            tone: overloaded ? "danger" : "neutral",
          },
          { value: currentUser.role, label: "Role" },
        ]}
      />

      <section className="mt-12 grid gap-12 md:grid-cols-2">
        <div>
          <h2 className="label">Skills</h2>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {currentUser.skillTags.length === 0 && (
              <span className="text-sm text-muted">No skill tags yet.</span>
            )}
            {currentUser.skillTags.map((tag) => (
              <span
                key={tag}
                className="border border-line px-2.5 py-1 text-xs uppercase tracking-wide text-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div>
          <h2 className="label">Workspace</h2>
          <div className="mt-4 divide-y divide-line border-y border-line text-sm">
            <div className="flex items-center justify-between py-3">
              <span className="text-muted">Workspace</span>
              <span className="text-ink">{workspaceConf.name}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-muted">Company</span>
              <span className="text-ink">{workspaceConf.company}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-muted">Manage</span>
              <Link
                href="/settings"
                className="text-ink hover:underline"
              >
                Workspace settings →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <p className="mt-12 text-xs text-muted">
        Prototype account — sign out returns to the login screen. Switch demo
        personas from there.
      </p>
    </PageContainer>
  );
}
