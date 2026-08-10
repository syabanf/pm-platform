/**
 * The document generators.
 *
 * One list. It was written out in four places — the index page, the command
 * palette, the sidebar's Documents children, and the breadcrumb's segment
 * labels — and had already drifted: the palette called the MoM page "MoM
 * Generator" while the index called it "Minutes of Meeting" and the sidebar
 * called it "MoM".
 *
 * Two names, deliberately, because both are wanted. `title` is what the
 * document is; `navLabel` is what fits in a 200px rail and a breadcrumb. Where
 * they are the same, they are the same string.
 */
export interface DocumentGenerator {
  /** URL segment, and the key the breadcrumb looks up. */
  slug: string;
  title: string;
  navLabel: string;
  description: string;
  /** What you give it — shown as a badge on the index. */
  input: "Bullet list" | "Form" | "Checklist";
}

export const documentGenerators: DocumentGenerator[] = [
  {
    slug: "mom",
    title: "Minutes of Meeting",
    navLabel: "MoM",
    description:
      "Paste raw bullet points — get discussion notes, decisions, action items with owners, and open questions.",
    input: "Bullet list",
  },
  {
    slug: "status-update",
    title: "Status Update",
    navLabel: "Status Update",
    description:
      "Turn quick notes into a structured weekly update: done, in flight, blockers, and asks.",
    input: "Bullet list",
  },
  {
    slug: "change-request",
    title: "Change Request",
    navLabel: "Change Request",
    description:
      "Scope change with business reason, impact assessment, and client approval section.",
    input: "Form",
  },
  {
    slug: "uat-signoff",
    title: "UAT Sign-off",
    navLabel: "UAT Sign-off",
    description:
      "Acceptance record per scope item with pass/fail results and signature blocks.",
    input: "Checklist",
  },
  {
    slug: "kickoff",
    title: "Kickoff Charter",
    navLabel: "Kickoff Charter",
    description:
      "Project charter: objective, scope in/out, team, timeline, and success criteria.",
    input: "Form",
  },
];

export const documentHref = (g: DocumentGenerator) => `/documents/${g.slug}`;
