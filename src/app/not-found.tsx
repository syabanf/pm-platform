import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center px-5 py-12 md:px-10">
      <div className="text-6xl font-semibold tracking-tight text-line">404</div>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink md:text-3xl">
        This page doesn&apos;t exist.
      </h1>
      <p className="mt-2 text-sm text-muted">
        It may have been removed in this session, or the link is stale.
      </p>
      <Link
        href="/"
        className="mt-6 border border-black bg-black px-4 py-2 text-sm font-medium text-paper hover:bg-ink"
      >
        Back to Home
      </Link>
    </div>
  );
}
