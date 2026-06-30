import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Screen, DayStats } from '../../types';
import { getWeekStats, getProfile } from '../../lib/storage';
import { formatDateShort, formatKcal, isToday, midpoint } from '../../lib/utils';
import WeeklyChart from '../ui/WeeklyChart';
import MealCard from '../ui/MealCard';
import { deleteMeal, getDayStats } from '../../lib/storage';

interface Props {
  onNavigate: (s: Screen) => void;
}

export default function HistoryScreen(_props?: { onNavigate?: (s: Screen) => void }) {
  const profile = getProfile();
  const [weekStats, setWeekStats] = useState<DayStats[]>(() => getWeekStats());
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  function handleDeleteMeal(date: string, id: string) {
    if (!confirm('Usunąć ten posiłek?')) return;
    deleteMeal(id);
    setWeekStats(prev =>
      prev.map(d => d.date === date ? getDayStats(date) : d),
    );
  }

  const daysWithMeals = weekStats.filter(d => d.meals.length > 0);

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="bg-white px-4 pt-10 pb-4 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">Historia</h1>
        <p className="text-sm text-gray-400 mt-0.5">Ten tydzień</p>
      </div>

      <div className="px-4 mt-4 space-y-4">
        {/* Weekly chart */}
        <WeeklyChart weekStats={weekStats} target={profile.dailyCalorieTarget} />

        {/* Per-day list */}
        <div className="space-y-3">
          {weekStats
            .slice()
            .reverse()
            .map(day => {
              const today = isToday(day.date);
              const mid = midpoint(day.totals.kcal);
              const expanded = expandedDay === day.date;

              return (
                <div
                  key={day.date}
                  className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                    today ? 'border-green-200' : 'border-gray-100'
                  }`}
                >
                  <button
                    onClick={() => {
                      if (day.meals.length > 0) setExpandedDay(expanded ? null : day.date);
                    }}
                    className="w-full flex items-center justify-between p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                        today ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {formatDateShort(day.date).split(' ')[0]}
                      </div>
                      <div className="text-left">
                        <p className={`text-sm font-semibold ${today ? 'text-green-700' : 'text-gray-800'}`}>
                          {today ? 'Dzisiaj' : formatDateShort(day.date)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {day.meals.length === 0
                            ? 'Brak posiłków'
                            : `${day.meals.length} posiłk${day.meals.length === 1 ? '' : day.meals.length < 5 ? 'i' : 'ów'}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {mid > 0 && (
                        <span className="text-sm font-bold text-gray-700">{mid} kcal</span>
                      )}
                      {day.meals.length > 0 && (
                        expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />
                      )}
                    </div>
                  </button>

                  {expanded && day.meals.length > 0 && (
                    <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                      {day.meals.map(meal => (
                        <MealCard
                          key={meal.id}
                          meal={meal}
                          onDelete={() => handleDeleteMeal(day.date, meal.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {daysWithMeals.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-gray-500 font-medium">Brak danych w tym tygodniu</p>
            <p className="text-gray-400 text-sm mt-1">Zacznij dodawać posiłki</p>
          </div>
        )}
      </div>
    </div>
  );
}
