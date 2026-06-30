import type { Range } from '../types';

export function midpoint(r: Range): number {
  return Math.round((r.min + r.max) / 2);
}

export function formatRange(r: Range, unit = ''): string {
  if (r.min === r.max) return `${r.min}${unit}`;
  return `${r.min}–${r.max}${unit}`;
}

export function formatKcal(r: Range): string {
  return formatRange(r, ' kcal');
}

export function formatGrams(r: Range): string {
  return formatRange(r, ' g');
}

export function confidenceLabel(c: number): string {
  if (c >= 0.85) return 'Wysoka';
  if (c >= 0.65) return 'Średnia';
  if (c >= 0.4) return 'Niska';
  return 'Bardzo niska';
}

export function confidenceColor(c: number): 'green' | 'yellow' | 'orange' | 'red' {
  if (c >= 0.85) return 'green';
  if (c >= 0.65) return 'yellow';
  if (c >= 0.4) return 'orange';
  return 'red';
}

export function toDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('pl-PL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('pl-PL', { month: 'short', day: 'numeric' });
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const DAY_SHORT = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];

export function formatDayShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return DAY_SHORT[new Date(y, m - 1, d).getDay()];
}

export function isToday(dateStr: string): boolean {
  return dateStr === toDateString();
}

export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function calcBMR(weight: number, height: number, age: number, gender: 'male' | 'female'): number {
  return gender === 'male'
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;
}

const ACTIVITY_MULT = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
} as const;

export function calcTDEE(bmr: number, activity: keyof typeof ACTIVITY_MULT): number {
  return Math.round(bmr * ACTIVITY_MULT[activity]);
}

export function calcCalorieTarget(tdee: number, goal: 'lose' | 'maintain' | 'gain'): number {
  if (goal === 'lose') return Math.max(1200, tdee - 500);
  if (goal === 'gain') return tdee + 300;
  return tdee;
}

export function calcMacros(kcalTarget: number, weight: number, goal: 'lose' | 'maintain' | 'gain') {
  const proteinPerKg = goal === 'lose' ? 2.0 : goal === 'gain' ? 1.8 : 1.6;
  const protein = Math.round(weight * proteinPerKg);
  const fat = Math.round((kcalTarget * 0.27) / 9);
  const carbs = Math.round((kcalTarget - protein * 4 - fat * 9) / 4);
  return { protein, carbs: Math.max(50, carbs), fat };
}
