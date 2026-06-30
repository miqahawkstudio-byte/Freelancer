import type { Profile, Meal, Settings, DayStats, MealTotals, FoodItem } from '../types';
import { toDateString } from './utils';

const KEY = {
  PROFILE: 'cv_profile',
  MEALS: 'cv_meals',
  SETTINGS: 'cv_settings',
};

export const DEFAULT_PROFILE: Profile = {
  name: '',
  weight: 70,
  height: 170,
  age: 30,
  gender: 'male',
  activityLevel: 'moderate',
  goal: 'maintain',
  dailyCalorieTarget: 2000,
  targetProtein: 150,
  targetCarbs: 200,
  targetFat: 67,
  setupComplete: false,
};

const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  provider: 'claude',
  model: '',
};

export function getProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY.PROFILE);
    if (!raw) return { ...DEFAULT_PROFILE };
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function saveProfile(p: Profile): void {
  localStorage.setItem(KEY.PROFILE, JSON.stringify(p));
}

export function getSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY.SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(KEY.SETTINGS, JSON.stringify(s));
}

function loadAllMeals(): Meal[] {
  try {
    const raw = localStorage.getItem(KEY.MEALS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistMeals(meals: Meal[]): void {
  localStorage.setItem(KEY.MEALS, JSON.stringify(meals));
}

export function getMealsByDate(date: string): Meal[] {
  return loadAllMeals().filter(m => m.date === date);
}

export function saveMeal(meal: Meal): void {
  const meals = loadAllMeals();
  const idx = meals.findIndex(m => m.id === meal.id);
  if (idx >= 0) meals[idx] = meal;
  else meals.push(meal);
  persistMeals(meals);
}

export function deleteMeal(id: string): void {
  persistMeals(loadAllMeals().filter(m => m.id !== id));
}

export function getDayStats(date: string): DayStats {
  const meals = getMealsByDate(date);
  return { date, meals, totals: sumMeals(meals) };
}

export function getWeekStats(): DayStats[] {
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return getDayStats(toDateString(d));
  });
}

export function sumMeals(meals: Meal[]): MealTotals {
  const sum = (key: keyof MealTotals) => ({
    min: Math.round(meals.reduce((s, m) => s + m.totals[key].min, 0)),
    max: Math.round(meals.reduce((s, m) => s + m.totals[key].max, 0)),
  });
  return {
    kcal: sum('kcal'),
    protein_g: sum('protein_g'),
    carbs_g: sum('carbs_g'),
    fat_g: sum('fat_g'),
  };
}

export function computeTotals(items: FoodItem[]): MealTotals {
  return {
    kcal: {
      min: Math.round(items.reduce((s, i) => s + i.kcal.min, 0)),
      max: Math.round(items.reduce((s, i) => s + i.kcal.max, 0)),
    },
    protein_g: {
      min: Math.round(items.reduce((s, i) => s + i.protein_g.min, 0)),
      max: Math.round(items.reduce((s, i) => s + i.protein_g.max, 0)),
    },
    carbs_g: {
      min: Math.round(items.reduce((s, i) => s + i.carbs_g.min, 0)),
      max: Math.round(items.reduce((s, i) => s + i.carbs_g.max, 0)),
    },
    fat_g: {
      min: Math.round(items.reduce((s, i) => s + i.fat_g.min, 0)),
      max: Math.round(items.reduce((s, i) => s + i.fat_g.max, 0)),
    },
  };
}

export function clearAllData(): void {
  Object.values(KEY).forEach(k => localStorage.removeItem(k));
}
