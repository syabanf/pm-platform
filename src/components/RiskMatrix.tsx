"use client";

import { useRouter } from "next/navigation";
import { productPath } from "@/lib/data";
import { usePrototype } from "@/lib/store";

const riskY: Record<string, number> = { high: 0, medium: 1, low: 2 };
const riskLabels = ["High risk", "Medium risk", "Low risk"];

/** Products plotted by health (x) and risk band (y) — where to look first. */
export function RiskMatrix({ compact = false }: { compact?: boolean }) {
  const { products } = usePrototype();
  const router = useRouter();

  const width = 640;
  const height = compact ? 220 : 300;
  const pad = { top: 16, right: 20, bottom: 30, left: 92 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const x = (health: number) => pad.left + (health / 100) * innerW;
  const bandH = innerH / 3;
  const y = (risk: string) => pad.top + (riskY[risk] ?? 2) * bandH + bandH / 2;

  return (
    <div className="border border-line p-4 md:p-6">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label="Portfolio risk matrix: product health versus risk"
      >
        {/* attention quadrant: health < 60 and high/medium risk */}
        <rect
          x={pad.left}
          y={pad.top}
          width={(60 / 100) * innerW}
          height={bandH * 2}
          fill="#F7F7F4"
        />
        <text
          x={pad.left + 6}
          y={pad.top + 14}
          fontSize={10}
          fill="#737373"
          style={{ textTransform: "uppercase", letterSpacing: 1 }}
        >
          Look here first
        </text>

        {/* risk bands */}
        {riskLabels.map((label, i) => (
          <g key={label}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={pad.top + i * bandH}
              y2={pad.top + i * bandH}
              stroke="#E6E6E1"
            />
            <text
              x={pad.left - 8}
              y={pad.top + i * bandH + bandH / 2 + 3}
              textAnchor="end"
              fontSize={10}
              fill="#737373"
            >
              {label}
            </text>
          </g>
        ))}
        <line
          x1={pad.left}
          x2={width - pad.right}
          y1={pad.top + innerH}
          y2={pad.top + innerH}
          stroke="#000000"
        />

        {/* health axis ticks */}
        {[0, 25, 50, 75, 100].map((tick) => (
          <text
            key={tick}
            x={x(tick)}
            y={height - 10}
            textAnchor="middle"
            fontSize={10}
            fill="#737373"
          >
            {tick}%
          </text>
        ))}
        <text
          x={width - pad.right}
          y={height - 10}
          textAnchor="end"
          fontSize={10}
          fill="#111111"
          dy={-14}
        >
          Health →
        </text>

        {/* product dots */}
        {products.map((product) => {
          const blocked = product.blockedCount > 1;
          return (
            <g
              key={product.id}
              className="cursor-pointer"
              onClick={() => router.push(productPath(product))}
            >
              <circle
                cx={x(product.health)}
                cy={y(product.risk)}
                r={compact ? 5 : 6}
                fill={blocked ? "#D92D20" : "#000000"}
              >
                <title>
                  {product.name} — health {product.health}%, {product.risk} risk
                  {blocked ? ", blocked" : ""}
                </title>
              </circle>
              {!compact && (
                <text
                  x={x(product.health)}
                  y={y(product.risk) - 10}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#111111"
                >
                  {product.name.length > 22
                    ? product.name.slice(0, 20) + "…"
                    : product.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-xs text-muted">
        Each dot is a product{compact ? "" : " — click to open it"}. Red dots
        have active blockers. The shaded zone (low health, elevated risk) is
        where attention pays off most.
      </p>
    </div>
  );
}
