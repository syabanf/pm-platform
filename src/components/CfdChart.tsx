import { cfd } from "@/lib/data";

/** Cumulative flow: stacked areas of done / in progress / to do per sprint day. */
export function CfdChart() {
  const width = 640;
  const height = 280;
  const pad = { top: 16, right: 16, bottom: 32, left: 40 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const total = Math.max(...cfd.map((d) => d.done + d.inProgress + d.todo));

  const x = (i: number) => pad.left + (i / (cfd.length - 1)) * innerW;
  const y = (v: number) => pad.top + (1 - v / total) * innerH;

  const area = (upper: (d: (typeof cfd)[number]) => number, lower: (d: (typeof cfd)[number]) => number) => {
    const top = cfd.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(upper(d))}`).join(" ");
    const bottom = [...cfd]
      .reverse()
      .map((d, i) => `L${x(cfd.length - 1 - i)},${y(lower(d))}`)
      .join(" ");
    return `${top} ${bottom} Z`;
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label="Cumulative flow diagram: points per state per sprint day"
    >
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line
            x1={pad.left}
            x2={width - pad.right}
            y1={y(total * f)}
            y2={y(total * f)}
            stroke="#E6E6E1"
          />
          <text x={pad.left - 8} y={y(total * f) + 3} textAnchor="end" fontSize={10} fill="#737373">
            {Math.round(total * f)}
          </text>
        </g>
      ))}
      {/* stacked areas bottom-up: done, then in progress, then todo */}
      <path d={area((d) => d.done, () => 0)} fill="#000000" />
      <path d={area((d) => d.done + d.inProgress, (d) => d.done)} fill="#737373" />
      <path
        d={area((d) => d.done + d.inProgress + d.todo, (d) => d.done + d.inProgress)}
        fill="#E6E6E1"
      />
      {cfd.map((d, i) => (
        <text key={d.day} x={x(i)} y={height - 10} textAnchor="middle" fontSize={10} fill="#737373">
          {d.day}
        </text>
      ))}
      <g transform={`translate(${pad.left + 8}, ${pad.top + 6})`} fontSize={10}>
        <rect width={10} height={10} fill="#E6E6E1" />
        <text x={16} y={9} fill="#111111">To do</text>
        <rect x={70} width={10} height={10} fill="#737373" />
        <text x={86} y={9} fill="#111111">In progress</text>
        <rect x={170} width={10} height={10} fill="#000000" />
        <text x={186} y={9} fill="#FFFFFF" stroke="none">
          <tspan fill="#111111">Done</tspan>
        </text>
      </g>
    </svg>
  );
}
