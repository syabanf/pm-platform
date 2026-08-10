import Link from "next/link";
import { documentGenerators, documentHref } from "@/lib/documents";


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
        {documentGenerators.map((gen) => (
          <Link
            key={gen.slug}
            href={documentHref(gen)}
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
