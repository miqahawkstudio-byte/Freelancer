import { useState, useEffect } from 'react';
import { Settings, Camera, PenLine, AlertTriangle } from 'lucide-react';
import type { Screen, DayStats } from '../../types';
import { getDayStats, getProfile, getSettings } from '../../lib/storage';
import { deleteMeal } from '../../lib/storage';
import { toDateString, formatDate, formatKcal, formatGrams, midpoint } from '../../lib/utils';
import CalorieBar from '../ui/CalorieBar';
import MacroBar from '../ui/MacroBar';
import MealCard from '../ui/MealCard';

interface Props {
  onNavigate: (s: Screen) => void;
}

export default function DiaryScreen({ onNavigate }: Props) {
  const today = toDateString();
  const [stats, setStats] = useState<DayStats>(() => getDayStats(today));
  const profile = getProfile();
  const settings = getSettings();

  useEffect(() => {
    setStats(getDayStats(today));
  }, [today]);

  function handleDelete(id: string) {
    if (!confirm('Usunąć ten posiłek?')) return;
    deleteMeal(id);
    setStats(getDayStats(today));
  }

  const { totals } = stats;
  const kcalMid = midpoint(totals.kcal);
  const target = profile.dailyCalorieTarget;
  const pct = target > 0 ? Math.round((kcalMid / target) * 100) : 0;

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="bg-white px-4 pt-10 pb-4 border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dziennik</h1>
            <p className="text-sm text-gray-400 mt-0.5 capitalize">{formatDate(today)}</p>
          </div>
          <button
            onClick={() => onNavigate('settings')}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* No API key banner */}
      {!settings.apiKey && (
        <div className="mx-4 mt-4">
          <button
            onClick={() => onNavigate('settings')}
            className="w-full flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-left"
          >
            <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">Brak klucza API</p>
              <p className="text-xs text-amber-600">Skonfiguruj klucz, aby analizować zdjęcia →</p>
            </div>
          </button>
        </div>
      )}

      {/* Profile setup banner */}
      {!profile.setupComplete && (
        <div className="mx-4 mt-3">
          <button
            onClick={() => onNavigate('profile')}
            className="w-full flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3 text-left"
          >
            <span className="text-lg">👤</span>
            <div>
              <p className="text-sm font-medium text-blue-800">Ustaw swój profil</p>
              <p className="text-xs text-blue-600">Spersonalizuj cel kaloryczny →</p>
            </div>
          </button>
        </div>
      )}

      {/* Calorie card */}
      <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Kalorie dzisiaj</p>
            <p className="text-3xl font-black text-gray-900">{formatKcal(totals.kcal)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">cel</p>
            <p className="text-xl font-bold text-gray-500">{target}</p>
          </div>
        </div>
        <CalorieBar value={kcalMid} target={target} />
        <p className="text-xs text-gray-400 mt-2 text-right">{pct}% celu dziennego</p>
      </div>

      {/* Macro card */}
      <div className="mx-4 mt-3 bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Makroskładniki
        </p>
        <MacroBar label="Białko" range={totals.protein_g} target={profile.targetProtein} color="blue" />
        <MacroBar label="Węglowodany" range={totals.carbs_g} target={profile.targetCarbs} color="amber" />
        <MacroBar label="Tłuszcze" range={totals.fat_g} target={profile.targetFat} color="red" />
      </div>

      {/* Meals section */}
      <div className="mx-4 mt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-800">Posiłki</h2>
          <div className="flex gap-3">
            <button
              onClick={() => onNavigate('manual')}
              className="flex items-center gap-1 text-sm text-green-600 font-medium"
            >
              <PenLine size={14} />
              Ręcznie
            </button>
            <button
              onClick={() => onNavigate('camera')}
              className="flex items-center gap-1 text-sm text-green-600 font-medium"
            >
              <Camera size={14} />
              Zdjęcie
            </button>
          </div>
        </div>

        {stats.meals.length === 0 ? (
          <div className="text-center py-14">
            <div className="text-5xl mb-3">🍽️</div>
            <p className="text-gray-500 font-medium">Brak posiłków na dziś</p>
            <p className="text-gray-400 text-sm mt-1">Zrób zdjęcie lub wpisz ręcznie</p>
          </div>
        ) : (
          <div className="space-y-3">
            {stats.meals.map(meal => (
              <MealCard key={meal.id} meal={meal} onDelete={() => handleDelete(meal.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Add meal button */}
      <div className="mx-4 mt-6">
        <button
          onClick={() => onNavigate('camera')}
          className="w-full bg-green-600 text-white rounded-2xl py-4 font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-green-200 active:scale-98 transition-transform"
        >
          <Camera size={20} />
          Zrób zdjęcie posiłku
        </button>
      </div>

      {/* Disclaimer */}
      <div className="mx-4 mt-4 bg-amber-50 rounded-xl p-3 border border-amber-100">
        <p className="text-xs text-amber-700 leading-relaxed">
          ⚠️ Szacunki kalorii są <strong>orientacyjne (±20–30%)</strong>. Aplikacja nie zastępuje porady
          dietetyka ani lekarza. Zawsze możesz ręcznie poprawić wartości.
        </p>
      </div>
    </div>
  );
}
