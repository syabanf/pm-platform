"use client";

import { AIBadge } from "@/components/AICoachPanel";
import { Wordmark } from "@/components/ui";
import {
  reportBlockRenderers,
  type ReportBlockProps,
} from "@/components/ReportBlocks";
import type { BacklogItem, Module, ReportConfig, Sprint } from "@/lib/types";
import { burndownInsight } from "@/lib/data";
import { isInFlight } from "@/lib/boardColumns";
import { renderTokens, type ReportContext } from "@/lib/reportTokens";
import { usePrototype } from "@/lib/store";

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h3 className="flex items-baseline gap-3 border-b border-line pb-2 text-sm font-semibold text-ink">
        <span className="tabular-nums text-muted">{number}.</span> {title}
      </h3>
      <div className="mt-3 text-sm leading-relaxed text-ink">{children}</div>
    </section>
  );
}

/**
 * Renders a section's narrative.
 *
 * A run of lines starting with "-" becomes a bullet list and everything else
 * becomes a paragraph — which is what lets the recommendation and mitigation
 * lists that used to be hardcoded in this file live in the template instead.
 *
 * Grouping runs, rather than classifying whole blank-line-separated blocks,
 * is deliberate: an intro line above its bullets is the obvious way to write
 * one, and treating the block as all-or-nothing turned that into a single
 * run-on sentence with dashes in the middle of it.
 */
function Narrative({ text }: { text: string }) {
  const runs: { bulleted: boolean; lines: string[] }[] = [];
  // A blank line ends the current run as well as a change of bullet-ness, so
  // two prose paragraphs stay two paragraphs. Merely skipping blanks joined
  // them with a space — which is what the seeded Executive Summary splits on
  // purpose to avoid.
  let broken = true;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      broken = true;
      continue;
    }
    const bulleted = /^[-*•]\s*/.test(line);
    const last = runs[runs.length - 1];
    if (!broken && last && last.bulleted === bulleted) last.lines.push(line);
    else runs.push({ bulleted, lines: [line] });
    broken = false;
  }

  return (
    <>
      {runs.map((run, i) =>
        run.bulleted ? (
          <ul key={i} className={`space-y-1 ${i > 0 ? "mt-3" : ""}`}>
            {run.lines.map((line, j) => (
              <li key={j}>— {line.replace(/^[-*•]\s*/, "")}</li>
            ))}
          </ul>
        ) : (
          <p key={i} className={i > 0 ? "mt-3" : undefined}>
            {run.lines.join(" ")}
          </p>
        )
      )}
    </>
  );
}

/**
 * Reads live store data so reports reflect this-session board moves and
 * runtime-created sprints, not the frozen seed. Including the client: the
 * header used to resolve it against the seed array, so a renamed client showed
 * its new name in the sidebar and its old one in the report on the same screen.
 */
function useReportData(mod: Module, sprint: Sprint): ReportBlockProps {
  const {
    tasks: allTasks,
    backlog,
    decisions,
    members,
    clients,
  } = usePrototype();
  const tasks = allTasks.filter((t) => t.sprintId === sprint.id);
  return {
    module: mod,
    sprint,
    client: clients.find((c) => c.id === mod.clientId),
    members,
    tasks,
    backlogItems: sprint.backlogItemIds
      .map((id) => backlog.find((b) => b.id === id))
      .filter((b): b is BacklogItem => !!b),
    completed: tasks.filter((t) => t.column === "done"),
    inProgress: tasks.filter((t) => isInFlight(t.column)),
    blocked: tasks.filter((t) => t.column === "blocked"),
    completionRate:
      sprint.committed > 0
        ? Math.round((sprint.completed / sprint.committed) * 100)
        : 0,
    openDecisions: decisions.filter(
      (d) => d.status === "open" && d.moduleId === mod.id
    ),
  };
}

/**
 * A report, rendered from its template.
 *
 * The template decides everything below the header: which sections there are,
 * in what order, and for each one whether it carries an automatic block, a
 * narrative with tokens in it, or both. There used to be a component per
 * template here — four of them, plus two more keyed by report type — which
 * meant that editing a template's sections in Settings changed the headings
 * and nothing under them.
 */
export function ReportPreview({
  mod,
  sprint,
  config,
}: {
  mod: Module;
  sprint: Sprint;
  config: ReportConfig;
}) {
  const { reportTemplates, projects } = usePrototype();
  const data = useReportData(mod, sprint);
  const project = projects.find((p) => p.id === mod.projectId);
  const templateDef = reportTemplates.find((t) => t.name === config.template);

  const ctx: ReportContext = {
    client: data.client,
    project,
    module: mod,
    sprint,
    metrics: {
      committed: sprint.committed,
      completed: sprint.completed,
      completionRate: data.completionRate,
      inProgress: data.inProgress.length,
      blocked: data.blocked.length,
      notCompleted: data.tasks.length - data.completed.length,
      openDecisions: data.openDecisions.length,
      velocity: mod.velocity,
    },
    preparedBy: "Fahmi",
  };

  const sections = (templateDef?.sections ?? []).filter((s) => s.enabled);
  const audienceLine = templateDef
    ? `${templateDef.visibility === "client-facing" ? "External" : "Internal"} — ${templateDef.audience}`
    : "—";

  return (
    <article className="border border-line bg-paper p-10">
      {/* Document header */}
      <header className="border-b-2 border-black pb-6">
        <div className="flex items-start justify-between">
          <Wordmark />
          <div className="text-right text-xs text-muted">
            <div className="font-medium text-ink">{config.template} Template</div>
            <div className="mt-0.5">{audienceLine}</div>
            <div className="mt-0.5">{config.period}</div>
          </div>
        </div>
        <h2 className="mt-6 text-2xl font-semibold tracking-tight text-ink">
          {config.type}
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-muted md:grid-cols-3">
          <div>Client: <span className="text-ink">{data.client?.name}</span></div>
          <div>Project: <span className="text-ink">{project?.name}</span></div>
          <div>Component: <span className="text-ink">{mod.name}</span></div>
          <div>Sprint: <span className="text-ink">Sprint {String(sprint.number).padStart(2, "0")}</span></div>
          <div>Period: <span className="text-ink">{sprint.startDate} → {sprint.endDate}</span></div>
          <div>Prepared by: <span className="text-ink">{ctx.preparedBy}</span></div>
        </div>
      </header>

      {sections.length === 0 && (
        <p className="mt-8 text-sm italic text-muted">
          The {config.template} template has no sections switched on — add some
          in Settings → Report Templates.
        </p>
      )}

      {sections.map((section, i) => {
        const Block = reportBlockRenderers[section.autoBlock];
        const body = section.body.trim();
        return (
          <Section key={section.id} number={i + 1} title={section.title}>
            {Block && <Block {...data} />}
            {body && (
              <div className={Block ? "mt-3" : undefined}>
                <Narrative text={renderTokens(body, ctx)} />
              </div>
            )}
            {!Block && !body && (
              <p className="italic text-muted">
                To be completed before sending — this section has no automatic
                content and no narrative yet.
              </p>
            )}
          </Section>
        );
      })}

      <section className="mt-8 border border-line border-l-2 border-l-ai p-5">
        <div className="flex items-center justify-between">
          <AIBadge />
          <span className="text-[10px] uppercase tracking-wide text-muted">
            AI-generated — review before sending
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink">
          {burndownInsight.insight} {burndownInsight.reason} Recommended:{" "}
          {burndownInsight.recommendations.join("; ").toLowerCase()}.
        </p>
      </section>
    </article>
  );
}
