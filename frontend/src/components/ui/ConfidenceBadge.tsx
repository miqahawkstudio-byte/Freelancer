import { confidenceLabel, confidenceColor } from '../../lib/utils';

interface Props {
  confidence: number;
  size?: 'sm' | 'xs';
}

const colorClasses = {
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  orange: 'bg-orange-100 text-orange-700',
  red: 'bg-red-100 text-red-700',
};

export default function ConfidenceBadge({ confidence, size = 'sm' }: Props) {
  const color = confidenceColor(confidence);
  const label = confidenceLabel(confidence);
  const pct = Math.round(confidence * 100);
  const cls = size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${cls} ${colorClasses[color]}`}>
      {label} {pct}%
    </span>
  );
}
