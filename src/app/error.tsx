"use client";

import { Button } from "@/components/ui";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center px-5 py-12 md:px-10">
      <div className="label">Something broke</div>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink md:text-3xl">
        This screen hit an error.
      </h1>
      <p className="mt-2 text-sm text-muted">
        The rest of the app is still fine — you can retry this screen or head
        back home. {error.digest && `(ref: ${error.digest})`}
      </p>
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>Try Again</Button>
        {/* Deliberate hard navigation: inside an error boundary the client
            router may be part of what failed, so a plain anchor is the
            reliable escape hatch. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          className="border border-line px-4 py-2 text-sm text-muted hover:border-black hover:text-ink"
        >
          Back to Home
        </a>
      </div>
    </div>
  );
}
