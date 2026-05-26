/**
 * Lightweight SVG line chart. No external deps.
 * - Optional second series (used for ADVANCED RPE overlay).
 * - Optional PR markers (flame icon at peaks).
 */
import { cn } from '@/lib/ui/cn';

export interface SparkPoint {
  x: number | string;     // index, ISO date, or any sortable
  y: number;              // primary value
  y2?: number;            // optional second-series value (e.g. RPE 6..10)
  isPR?: boolean;
  label?: string;         // tooltip text (browser native title)
}

interface Props {
  data: SparkPoint[];
  /** Pixel size. Width adapts to container if you wrap it. */
  width?: number;
  height?: number;
  /** Show the optional second series (RPE overlay). */
  showSecond?: boolean;
  /** Y-axis label (small caps in corner). */
  yLabel?: string;
  className?: string;
}

export function Sparkline({
  data,
  width = 320,
  height = 140,
  showSecond,
  yLabel,
  className,
}: Props) {
  if (data.length === 0) {
    return (
      <div className={cn('flex items-center justify-center text-ink-mute text-sm h-32', className)}>
        Not enough data yet.
      </div>
    );
  }

  const PAD_L = 28, PAD_R = 12, PAD_T = 16, PAD_B = 22;
  const innerW = width - PAD_L - PAD_R;
  const innerH = height - PAD_T - PAD_B;

  const ys = data.map((d) => d.y);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const yPad = Math.max(1, (yMax - yMin) * 0.15);
  const yLo = yMin - yPad;
  const yHi = yMax + yPad;

  // x evenly spaced (don't compute real date scales for a sparkline).
  const xAt = (i: number) =>
    data.length === 1 ? PAD_L + innerW / 2 : PAD_L + (i / (data.length - 1)) * innerW;
  const yAt = (v: number) => PAD_T + (1 - (v - yLo) / (yHi - yLo || 1)) * innerH;

  // Second series scale (RPE) — 5..10 fixed for stable overlay.
  const y2Lo = 5, y2Hi = 10;
  const y2At = (v: number) => PAD_T + (1 - (v - y2Lo) / (y2Hi - y2Lo)) * innerH;

  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(d.y).toFixed(1)}`)
    .join(' ');

  const y2Path = showSecond
    ? data
        .filter((d) => d.y2 != null)
        .map((d, i, arr) => {
          const idx = data.indexOf(d);
          return `${i === 0 ? 'M' : 'L'} ${xAt(idx).toFixed(1)} ${y2At(d.y2!).toFixed(1)}`;
        })
        .join(' ')
    : '';

  // Y gridlines: min/mid/max
  const yTicks = [yLo, (yLo + yHi) / 2, yHi];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn('w-full h-auto', className)}
      role="img"
      aria-label={yLabel ? `${yLabel} over time` : 'Progress chart'}
    >
      {/* gridlines */}
      {yTicks.map((t, i) => {
        const y = yAt(t);
        return (
          <g key={i}>
            <line x1={PAD_L} x2={width - PAD_R} y1={y} y2={y} stroke="#2a2a2a" strokeWidth={1} />
            <text x={PAD_L - 4} y={y + 3} fontSize={9} textAnchor="end" fill="#6b6b6b" className="tnum">
              {Math.round(t)}
            </text>
          </g>
        );
      })}

      {/* second series (RPE) */}
      {showSecond && y2Path && (
        <>
          <path d={y2Path} fill="none" stroke="#f59e0b" strokeWidth={1.4} strokeDasharray="3 3" />
          {data.map((d, i) => d.y2 != null && (
            <circle key={`y2-${i}`} cx={xAt(i)} cy={y2At(d.y2!)} r={2.2} fill="#f59e0b" />
          ))}
        </>
      )}

      {/* primary line */}
      <path d={linePath} fill="none" stroke="#e53e3e" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {/* dots + PR flames */}
      {data.map((d, i) => (
        <g key={`p-${i}`}>
          <title>{d.label ?? `${d.y}`}</title>
          <circle cx={xAt(i)} cy={yAt(d.y)} r={d.isPR ? 4 : 3} fill={d.isPR ? '#ff5b3d' : '#e53e3e'} />
          {d.isPR && (
            <text x={xAt(i)} y={yAt(d.y) - 7} fontSize={10} textAnchor="middle">🔥</text>
          )}
        </g>
      ))}

      {/* axis labels */}
      {yLabel && (
        <text x={PAD_L} y={12} fontSize={9} fill="#9a9a9a" className="tnum tracking-widest2">
          {yLabel.toUpperCase()}
        </text>
      )}
      {showSecond && (
        <text x={width - PAD_R} y={12} fontSize={9} textAnchor="end" fill="#f59e0b" className="tnum tracking-widest2">
          RPE
        </text>
      )}
    </svg>
  );
}
