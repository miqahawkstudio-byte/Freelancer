interface Props {
  value: number;
  target: number;
}

export default function CalorieBar({ value, target }: Props) {
  const pct = target > 0 ? Math.min(110, (value / target) * 100) : 0;
  const color =
    pct > 105 ? 'bg-red-500' : pct > 90 ? 'bg-amber-500' : 'bg-green-500';

  return (
    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
      <div
        className={`h-3 rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}
