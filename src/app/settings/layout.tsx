import { PageTabs } from "@/components/PageTabs";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[88rem] px-5 py-8 md:px-10 md:py-12">
      {/*
        One heading for the whole section. It used to read "Master Data", which
        was the title of one tab out of six — so Workspace, Members and Roles
        all announced themselves as Master Data. Each tab names itself below.
      */}
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl text-ink">
        Settings
      </h1>
      <p className="mt-1 max-w-xl text-sm text-muted">
        Workspace-level configuration used across every client, component, and
        sprint.
      </p>
      <div className="mt-8">
        <PageTabs
          tabs={[
            { label: "Workspace", href: "/settings", exact: true },
            { label: "Members", href: "/settings/members" },
            { label: "Roles & Permissions", href: "/settings/roles" },
            { label: "Report Templates", href: "/settings/report-templates" },
            { label: "Master Data", href: "/settings/masters" },
            { label: "Definition of Done", href: "/settings/dod" },
          ]}
        />
      </div>
      <div className="mt-10">{children}</div>
    </div>
  );
}
