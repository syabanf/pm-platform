"use client";

import { AIBadge } from "@/components/AICoachPanel";
import { Button, EmptyState, Field, inputClass } from "@/components/ui";
import { articleToMarkdown, downloadFile, slugify } from "@/lib/export";
import { usePrototype } from "@/lib/store";

// Re-exported so existing `@/components/Document` imports keep working.
export { Field, inputClass };

export function DocumentArticle({ children }: { children: React.ReactNode }) {
  return <article className="border border-line bg-paper p-10">{children}</article>;
}

export function DocHeader({
  docType,
  date,
  title,
  meta,
}: {
  docType: string;
  date: string;
  title: string;
  meta: { label: string; value: string }[];
}) {
  return (
    <header className="border-b-2 border-black pb-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-bold tracking-tight text-black">WIT</div>
          <div className="label mt-0.5">Sprint OS</div>
        </div>
        <div className="text-right text-xs text-muted">
          <div className="font-medium text-ink">{docType}</div>
          <div className="mt-0.5">{date}</div>
        </div>
      </div>
      <h2 className="mt-6 text-2xl font-semibold tracking-tight text-ink">
        {title || "Untitled"}
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-muted md:grid-cols-3">
        {meta.map((m) => (
          <div key={m.label}>
            {m.label}: <span className="text-ink">{m.value}</span>
          </div>
        ))}
      </div>
    </header>
  );
}

export function DocSection({
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

export function AIFootnote({ text }: { text: string }) {
  return (
    <section className="mt-8 border border-line border-l-2 border-l-ai p-5">
      <div className="flex items-center justify-between">
        <AIBadge />
        <span className="text-[10px] uppercase tracking-wide text-muted">
          Drafted automatically — review before sending
        </span>
      </div>
      <p className="mt-3 text-sm text-ink">{text}</p>
    </section>
  );
}

export function DocActions({
  extra,
}: {
  extra?: { label: string; toast: string }[];
}) {
  const { showToast } = usePrototype();

  const exportMarkdown = (e: React.MouseEvent<HTMLButtonElement>) => {
    const article = e.currentTarget.closest("article");
    if (!article) return;
    const title =
      article.querySelector("h2")?.textContent?.trim() ?? "document";
    downloadFile(
      `${slugify(title)}.md`,
      articleToMarkdown(article),
      "text/markdown;charset=utf-8"
    );
    showToast("Markdown file downloaded.", "success");
  };

  return (
    <div className="print-hide mt-6 flex flex-wrap gap-2">
      <Button onClick={exportMarkdown}>Export Markdown</Button>
      <Button variant="secondary" onClick={() => window.print()}>
        Export PDF (Print)
      </Button>
      {extra?.map((action) => (
        <Button
          key={action.label}
          variant="secondary"
          onClick={() => showToast(action.toast, "success")}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}

export function DocEmptyState({ hint }: { hint: string }) {
  return <EmptyState centered>{hint}</EmptyState>;
}

export function DocPageShell({
  label,
  title,
  description,
  form,
  document,
}: {
  label: string;
  title: string;
  description: string;
  form: React.ReactNode;
  document: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-10 md:py-12">
      <div className="print-hide">
        <div className="label">{label}</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl text-ink">
          {title}
        </h1>
        <p className="mt-1 max-w-xl text-sm text-muted">{description}</p>
      </div>
      <div className="mt-10 grid gap-8 md:grid-cols-[340px_1fr] lg:grid-cols-[380px_1fr] lg:gap-12 print:block">
        <div className="print-hide space-y-5">{form}</div>
        <div>{document}</div>
      </div>
    </div>
  );
}

export function GenerateButton({
  onClick,
  label = "Generate Document",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <Button size="lg" fullWidth onClick={onClick}>
      {label}
    </Button>
  );
}
