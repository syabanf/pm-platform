import type { VelocityEntry } from "@/lib/types";

export function VelocityChart({ data }: { data: VelocityEntry[] }) {
  const width = 640;
  const height = 280;
  const pad = { top: 16, right: 16, bottom: 32, left: 40 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const maxY = Math.max(...data.map((d) => d.committed), ...data.map((d) => d.completed));
  const groupW = innerW / data.length;
  const barW = Math.min(36, groupW / 3);

  const y = (value: number) => pad.top + (1 - value / maxY) * innerH;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label="Velocity per sprint: committed versus completed points"
    >
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const value = Math.round(maxY * f);
        return (
          <g key={f}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(value)}
              y2={y(value)}
              stroke="#E6E6E1"
              strokeWidth={1}
            />
            <text
              x={pad.left - 8}
              y={y(value) + 3}
              textAnchor="end"
              fontSize={10}
              fill="#737373"
            >
              {value}
            </text>
          </g>
        );
      })}
      {data.map((entry, i) => {
        const cx = pad.left + groupW * i + groupW / 2;
        return (
          <g key={entry.sprint}>
            {/* committed: outline bar */}
            <rect
              x={cx - barW - 2}
              y={y(entry.committed)}
              width={barW}
              height={innerH + pad.top - y(entry.committed)}
              fill="none"
              stroke="#737373"
              strokeWidth={1}
            />
            {/* completed: solid bar */}
            <rect
              x={cx + 2}
              y={y(entry.completed)}
              width={barW}
              height={innerH + pad.top - y(entry.completed)}
              fill="#000000"
            />
            <text
              x={cx}
              y={height - 10}
              textAnchor="middle"
              fontSize={10}
              fill="#737373"
            >
              {entry.sprint}
            </text>
            <text
              x={cx + 2 + barW / 2}
              y={y(entry.completed) - 6}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              fill="#111111"
            >
              {entry.completed}
            </text>
          </g>
        );
      })}
      <g transform={`translate(${pad.left}, ${pad.top})`} fontSize={10} fill="#737373">
        <rect x={0} y={0} width={10} height={10} fill="#000000" />
        <text x={16} y={8}>Completed</text>
        <rect x={90} y={0} width={10} height={10} fill="none" stroke="#737373" />
        <text x={106} y={8}>Committed</text>
      </g>
    </svg>
  );
}
