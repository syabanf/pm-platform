import Link from "next/link";

const generators = [
  {
    href: "/documents/mom",
    title: "Minutes of Meeting",
    description:
      "Paste raw bullet points — get discussion notes, decisions, action items with owners, and open questions.",
    input: "Bullet list",
  },
  {
    href: "/documents/status-update",
    title: "Status Update",
    description:
      "Turn quick notes into a structured weekly update: done, in flight, blockers, and asks.",
    input: "Bullet list",
  },
  {
    href: "/documents/change-request",
    title: "Change Request",
    description:
      "Scope change with business reason, impact assessment, and client approval section.",
    input: "Form",
  },
  {
    href: "/documents/uat-signoff",
    title: "UAT Sign-off",
    description:
      "Acceptance record per scope item with pass/fail results and signature blocks.",
    input: "Checklist",
  },
  {
    href: "/documents/kickoff",
    title: "Kickoff Charter",
    description:
      "Project charter: objective, scope in/out, team, timeline, and success criteria.",
    input: "Form",
  },
];

export default function DocumentsIndexPage() {
  return (
    <div className="mx-auto max-w-[88rem] px-5 py-8 md:px-10 md:py-12">
      <div className="label">Documents</div>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl text-ink">
        Generate Document
      </h1>
      <p className="mt-1 max-w-xl text-sm text-muted">
        The documents a PM produces around every sprint — drafted from minimal
        input, in a consistent WIT format, always reviewed before sending.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {generators.map((gen) => (
          <Link
            key={gen.href}
            href={gen.href}
            className="group flex flex-col border border-line p-6 transition-colors hover:border-black"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-base font-semibold text-ink">{gen.title}</div>
              <span className="border border-line px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted">
                {gen.input}
              </span>
            </div>
            <p className="mt-2 flex-1 text-sm text-muted">{gen.description}</p>
            <span className="mt-4 text-xs text-muted group-hover:text-ink">
              Open generator →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
