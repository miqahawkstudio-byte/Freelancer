import type { Range } from '../../types';
import { midpoint } from '../../lib/utils';

interface Props {
  label: string;
  range: Range;
  target: number;
  color: 'blue' | 'amber' | 'red';
}

const colorMap = {
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
};

export default function MacroBar({ label, range, target, color }: Props) {
  const mid = midpoint(range);
  const pct = target > 0 ? Math.min(100, (mid / target) * 100) : 0;

  return (
    <div className="mb-2 last:mb-0">
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span className="font-medium">{label}</span>
        <span>
          {range.min === range.max
            ? `${mid} g`
            : `${range.min}–${range.max} g`}{' '}
          / {target} g
        </span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${colorMap[color]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
