import { useState } from 'react';
import { Settings, ChevronRight, Save } from 'lucide-react';
import type { Screen, Profile } from '../../types';
import { getProfile, saveProfile } from '../../lib/storage';
import { calcBMR, calcTDEE, calcCalorieTarget, calcMacros } from '../../lib/utils';

interface Props {
  onNavigate: (s: Screen) => void;
}

const ACTIVITY_LABELS = {
  sedentary: 'Siedzący (brak ruchu)',
  light: 'Lekki (1–2 treningi/tydz.)',
  moderate: 'Umiarkowany (3–4 treningi)',
  active: 'Aktywny (5+ treningów)',
  very_active: 'Bardzo aktywny (praca fizyczna)',
};

const GOAL_LABELS = {
  lose: 'Redukcja wagi',
  maintain: 'Utrzymanie wagi',
  gain: 'Przyrost masy',
};

export default function ProfileScreen({ onNavigate }: Props) {
  const [profile, setProfile] = useState<Profile>(getProfile);
  const [saved, setSaved] = useState(false);

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile(p => ({ ...p, [key]: value }));
    setSaved(false);
  }

  function recalculate() {
    const bmr = calcBMR(profile.weight, profile.height, profile.age, profile.gender);
    const tdee = calcTDEE(bmr, profile.activityLevel);
    const kcal = calcCalorieTarget(tdee, profile.goal);
    const macros = calcMacros(kcal, profile.weight, profile.goal);
    setProfile(p => ({
      ...p,
      dailyCalorieTarget: kcal,
      targetProtein: macros.protein,
      targetCarbs: macros.carbs,
      targetFat: macros.fat,
    }));
    setSaved(false);
  }

  function handleSave() {
    saveProfile({ ...profile, setupComplete: true });
    setSaved(true);
  }

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="bg-white px-4 pt-10 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Profil</h1>
          <button
            onClick={() => onNavigate('settings')}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <Settings size={16} />
            Ustawienia
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="px-4 mt-5 space-y-5">
        {/* Personal info */}
        <section>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Dane osobowe
          </p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
            <Field label="Imię (opcjonalne)">
              <input
                className="text-sm text-gray-700 text-right bg-transparent outline-none w-32"
                placeholder="Jan"
                value={profile.name}
                onChange={e => update('name', e.target.value)}
              />
            </Field>
            <Field label="Waga (kg)">
              <input
                type="number" min="30" max="300"
                className="text-sm text-gray-700 text-right bg-transparent outline-none w-20"
                value={profile.weight}
                onChange={e => update('weight', parseFloat(e.target.value) || 70)}
              />
            </Field>
            <Field label="Wzrost (cm)">
              <input
                type="number" min="100" max="250"
                className="text-sm text-gray-700 text-right bg-transparent outline-none w-20"
                value={profile.height}
                onChange={e => update('height', parseFloat(e.target.value) || 170)}
              />
            </Field>
            <Field label="Wiek">
              <input
                type="number" min="10" max="120"
                className="text-sm text-gray-700 text-right bg-transparent outline-none w-20"
                value={profile.age}
                onChange={e => update('age', parseInt(e.target.value) || 30)}
              />
            </Field>
            <Field label="Płeć">
              <select
                className="text-sm text-gray-700 bg-transparent outline-none"
                value={profile.gender}
                onChange={e => update('gender', e.target.value as Profile['gender'])}
              >
                <option value="male">Mężczyzna</option>
                <option value="female">Kobieta</option>
              </select>
            </Field>
          </div>
        </section>

        {/* Activity & goal */}
        <section>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Aktywność i cel
          </p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
            <Field label="Aktywność">
              <select
                className="text-sm text-gray-700 bg-transparent outline-none max-w-[180px]"
                value={profile.activityLevel}
                onChange={e => update('activityLevel', e.target.value as Profile['activityLevel'])}
              >
                {Object.entries(ACTIVITY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Cel">
              <select
                className="text-sm text-gray-700 bg-transparent outline-none"
                value={profile.goal}
                onChange={e => update('goal', e.target.value as Profile['goal'])}
              >
                {Object.entries(GOAL_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
          </div>
          <button
            onClick={recalculate}
            className="mt-2 text-sm text-green-600 font-medium flex items-center gap-1 ml-1"
          >
            ↻ Przelicz cel automatycznie
          </button>
        </section>

        {/* Calorie targets */}
        <section>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Cele dzienne
          </p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
            <Field label="Kalorie (kcal)">
              <input
                type="number" min="800" max="6000"
                className="text-sm text-gray-700 text-right bg-transparent outline-none w-24"
                value={profile.dailyCalorieTarget}
                onChange={e => update('dailyCalorieTarget', parseInt(e.target.value) || 2000)}
              />
            </Field>
            <Field label="Białko (g)">
              <input
                type="number" min="30" max="400"
                className="text-sm text-gray-700 text-right bg-transparent outline-none w-20"
                value={profile.targetProtein}
                onChange={e => update('targetProtein', parseInt(e.target.value) || 150)}
              />
            </Field>
            <Field label="Węglowodany (g)">
              <input
                type="number" min="0" max="600"
                className="text-sm text-gray-700 text-right bg-transparent outline-none w-20"
                value={profile.targetCarbs}
                onChange={e => update('targetCarbs', parseInt(e.target.value) || 200)}
              />
            </Field>
            <Field label="Tłuszcze (g)">
              <input
                type="number" min="20" max="300"
                className="text-sm text-gray-700 text-right bg-transparent outline-none w-20"
                value={profile.targetFat}
                onChange={e => update('targetFat', parseInt(e.target.value) || 67)}
              />
            </Field>
          </div>
        </section>

        {/* Save */}
        <button
          onClick={handleSave}
          className="w-full bg-green-600 text-white rounded-2xl py-4 font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-200"
        >
          {saved ? '✓ Zapisano!' : <><Save size={18} /> Zapisz profil</>}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <span className="text-sm text-gray-700">{label}</span>
      {children}
    </div>
  );
}
