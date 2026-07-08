import type { BurndownPoint } from "@/lib/types";

export function BurndownChart({ data }: { data: BurndownPoint[] }) {
  const width = 640;
  const height = 280;
  const pad = { top: 16, right: 16, bottom: 32, left: 40 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const maxY = Math.max(...data.map((d) => d.ideal), ...data.map((d) => d.actual ?? 0));
  const days = data.length;

  const x = (day: number) => pad.left + ((day - 1) / (days - 1)) * innerW;
  const y = (value: number) => pad.top + (1 - value / maxY) * innerH;

  const idealPath = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${x(d.day)},${y(d.ideal)}`)
    .join(" ");
  const actualData = data.filter((d) => d.actual !== null);
  const actualPath = actualData
    .map((d, i) => `${i === 0 ? "M" : "L"}${x(d.day)},${y(d.actual as number)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label="Sprint burndown chart: ideal versus actual remaining work"
    >
      {/* y gridlines */}
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
      {/* x labels */}
      {data.map((d) => (
        <text
          key={d.day}
          x={x(d.day)}
          y={height - 10}
          textAnchor="middle"
          fontSize={10}
          fill="#737373"
        >
          {d.day}
        </text>
      ))}
      {/* ideal line */}
      <path d={idealPath} fill="none" stroke="#737373" strokeWidth={1.5} strokeDasharray="4 4" />
      {/* actual line */}
      <path d={actualPath} fill="none" stroke="#000000" strokeWidth={2} />
      {actualData.map((d) => (
        <circle key={d.day} cx={x(d.day)} cy={y(d.actual as number)} r={3} fill="#000000" />
      ))}
      {/* legend */}
      <g transform={`translate(${pad.left}, ${pad.top})`} fontSize={10} fill="#737373">
        <line x1={0} x2={20} y1={4} y2={4} stroke="#000000" strokeWidth={2} />
        <text x={26} y={7}>Actual remaining</text>
        <line x1={120} x2={140} y1={4} y2={4} stroke="#737373" strokeWidth={1.5} strokeDasharray="4 4" />
        <text x={146} y={7}>Ideal remaining</text>
      </g>
    </svg>
  );
}
