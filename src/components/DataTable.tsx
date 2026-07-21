export function DataTable({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    // break-words on cells so one pathologically long unbroken value (a pasted
    // id, a URL) wraps instead of stretching its column off-screen.
    <div className="overflow-x-auto">
      <table className="w-full text-sm [&_td]:break-words">
        <thead>
          <tr className="border-b border-black">
            {headers.map((h) => (
              <th key={h} className="label py-3 pr-6 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="animate-stagger divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}
