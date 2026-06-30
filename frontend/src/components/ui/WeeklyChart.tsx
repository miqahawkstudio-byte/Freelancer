import type { DayStats } from '../../types';
import { midpoint, formatDayShort, isToday } from '../../lib/utils';

interface Props {
  weekStats: DayStats[];
  target: number;
}

export default function WeeklyChart({ weekStats, target }: Props) {
  const maxKcal = Math.max(target * 1.2, ...weekStats.map(d => d.totals.kcal.max || 0), 100);
  const chartH = 120;
  const barW = 28;
  const gap = 12;
  const totalW = weekStats.length * (barW + gap) - gap;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="text-sm font-semibold text-gray-800 mb-4">Ten tydzień</p>
      <svg width="100%" viewBox={`0 0 ${totalW + 8} ${chartH + 32}`} className="overflow-visible">
        {/* Target line */}
        {target > 0 && (
          <>
            <line
              x1="0"
              y1={chartH - (target / maxKcal) * chartH}
              x2={totalW + 8}
              y2={chartH - (target / maxKcal) * chartH}
              stroke="#22c55e"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              opacity="0.6"
            />
            <text
              x={totalW + 10}
              y={chartH - (target / maxKcal) * chartH + 4}
              fontSize="8"
              fill="#22c55e"
              opacity="0.8"
            >
              cel
            </text>
          </>
        )}

        {weekStats.map((day, i) => {
          const mid = midpoint(day.totals.kcal);
          const barH = mid > 0 ? Math.max(4, (mid / maxKcal) * chartH) : 2;
          const x = i * (barW + gap);
          const today = isToday(day.date);
          const over = target > 0 && mid > target * 1.05;
          const fill = mid === 0 ? '#e5e7eb' : over ? '#f87171' : today ? '#22c55e' : '#86efac';

          return (
            <g key={day.date}>
              <rect
                x={x}
                y={chartH - barH}
                width={barW}
                height={barH}
                rx="5"
                fill={fill}
              />
              {mid > 0 && (
                <text
                  x={x + barW / 2}
                  y={chartH - barH - 4}
                  fontSize="8"
                  textAnchor="middle"
                  fill="#6b7280"
                >
                  {mid}
                </text>
              )}
              <text
                x={x + barW / 2}
                y={chartH + 16}
                fontSize="10"
                textAnchor="middle"
                fill={today ? '#22c55e' : '#9ca3af'}
                fontWeight={today ? '700' : '400'}
              >
                {formatDayShort(day.date)}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded bg-green-400 inline-block" />
          W normie
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded bg-red-400 inline-block" />
          Powyżej celu
        </span>
        <span className="flex items-center gap-1">
          <span className="w-6 border-t-2 border-dashed border-green-500 inline-block" />
          Cel
        </span>
      </div>
    </div>
  );
}
