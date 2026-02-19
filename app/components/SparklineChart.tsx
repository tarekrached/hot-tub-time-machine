import type { TestRange } from "shared/types";

interface SparklineChartProps {
  before: number[];
  after: number[];
  range: TestRange;
  width?: number;
  height?: number;
}

export function SparklineChart({
  before,
  after,
  range,
  width = 120,
  height = 40,
}: SparklineChartProps) {
  if (before.length === 0 && after.length === 0) {
    return (
      <svg width={width} height={height}>
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="10"
          fill="#94a3b8"
        >
          No data
        </text>
      </svg>
    );
  }

  const allValues = [...before, ...after];
  const dataMin = Math.min(...allValues);
  const dataMax = Math.max(...allValues);
  const lo = Math.min(dataMin, range.idealMin) * 0.95;
  const hi = Math.max(dataMax, range.idealMax) * 1.05;
  const spread = hi - lo || 1;

  const padX = 4;
  const padY = 4;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const toY = (v: number) => padY + chartH - ((v - lo) / spread) * chartH;
  const idealTop = toY(range.idealMax);
  const idealBot = toY(range.idealMin);

  function makeLine(data: number[]): string {
    if (data.length === 0) return "";
    const step = data.length > 1 ? chartW / (data.length - 1) : 0;
    return data
      .map((v, i) => {
        const x = padX + i * step;
        const y = toY(v);
        return `${i === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");
  }

  return (
    <svg width={width} height={height}>
      {/* Ideal range band */}
      <rect
        x={padX}
        y={idealTop}
        width={chartW}
        height={Math.max(idealBot - idealTop, 1)}
        fill="#dcfce7"
        opacity="0.6"
      />
      {/* Before line */}
      {before.length > 0 && (
        <path
          d={makeLine(before)}
          fill="none"
          stroke="#94a3b8"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {/* After line */}
      {after.length > 0 && (
        <path
          d={makeLine(after)}
          fill="none"
          stroke="#16a34a"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {/* Before dots */}
      {before.map((v, i) => {
        const step = before.length > 1 ? chartW / (before.length - 1) : 0;
        return (
          <circle
            key={`b${i}`}
            cx={padX + i * step}
            cy={toY(v)}
            r="2"
            fill="#94a3b8"
          />
        );
      })}
      {/* After dots */}
      {after.map((v, i) => {
        const step = after.length > 1 ? chartW / (after.length - 1) : 0;
        return (
          <circle
            key={`a${i}`}
            cx={padX + i * step}
            cy={toY(v)}
            r="2"
            fill="#16a34a"
          />
        );
      })}
    </svg>
  );
}
