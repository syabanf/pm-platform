export default function Template({ children }: { children: React.ReactNode }) {
  // Re-mounts on every route change, replaying the page enter animation.
  return <div className="animate-page">{children}</div>;
}
