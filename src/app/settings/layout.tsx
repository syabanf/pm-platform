import { PageTabs } from "@/components/PageTabs";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-10 md:py-12">
      <div className="label">Settings</div>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl text-ink">
        Master Data
      </h1>
      <p className="mt-1 max-w-xl text-sm text-muted">
        Workspace-level configuration used across every client, module, and
        sprint.
      </p>
      <div className="mt-8">
        <PageTabs
          tabs={[
            { label: "Workspace", href: "/settings", exact: true },
            { label: "Members", href: "/settings/members" },
            { label: "Roles & Permissions", href: "/settings/roles" },
            { label: "Report Templates", href: "/settings/report-templates" },
            { label: "Lists", href: "/settings/lists" },
            { label: "Definition of Done", href: "/settings/dod" },
          ]}
        />
      </div>
      <div className="mt-10">{children}</div>
    </div>
  );
}
