import { Trash2, Camera, PenLine, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { Meal } from '../../types';
import { formatTime, formatKcal, formatGrams, midpoint } from '../../lib/utils';
import ConfidenceBadge from './ConfidenceBadge';

interface Props {
  meal: Meal;
  onDelete: () => void;
}

export default function MealCard({ meal, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const time = formatTime(meal.timestamp);
  const itemNames = meal.items.map(i => i.name).join(', ');
  const kcalStr = formatKcal(meal.totals.kcal);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left p-4"
      >
        <div className="flex items-start gap-3">
          {meal.imageDataUrl ? (
            <img
              src={meal.imageDataUrl}
              alt="posiłek"
              className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
              {meal.source === 'photo' ? (
                <Camera size={22} className="text-gray-400" />
              ) : (
                <PenLine size={22} className="text-gray-400" />
              )}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-400">{time}</span>
              <ConfidenceBadge confidence={meal.overall_confidence} size="xs" />
            </div>
            <p className="text-sm font-semibold text-gray-800 mt-0.5 truncate">
              {meal.name || itemNames || 'Posiłek'}
            </p>
            <p className="text-xs text-gray-500 truncate">{itemNames}</p>
            <p className="text-sm font-bold text-green-600 mt-1">{kcalStr}</p>
          </div>
          <div className="flex-shrink-0 text-gray-400">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4">
          {/* Macro summary */}
          <div className="flex gap-4 py-3 text-xs">
            <div className="text-center">
              <p className="text-gray-400">Białko</p>
              <p className="font-semibold text-gray-700">{formatGrams(meal.totals.protein_g)}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-400">Węgle</p>
              <p className="font-semibold text-gray-700">{formatGrams(meal.totals.carbs_g)}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-400">Tłuszcze</p>
              <p className="font-semibold text-gray-700">{formatGrams(meal.totals.fat_g)}</p>
            </div>
          </div>

          {/* Items list */}
          <div className="space-y-1.5 mb-3">
            {meal.items.map(item => (
              <div key={item.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-700 truncate flex-1 mr-2">{item.name}</span>
                <span className="text-gray-400 flex-shrink-0">
                  ~{midpoint(item.quantity_g)}g · {midpoint(item.kcal)} kcal
                </span>
              </div>
            ))}
          </div>

          {meal.notes && (
            <p className="text-xs text-gray-400 italic mb-3">{meal.notes}</p>
          )}

          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 font-medium"
          >
            <Trash2 size={14} />
            Usuń posiłek
          </button>
        </div>
      )}
    </div>
  );
}
