export interface Range {
  min: number;
  max: number;
}

export interface FoodItem {
  id: string;
  name: string;
  description?: string;
  quantity_g: Range;
  kcal: Range;
  protein_g: Range;
  carbs_g: Range;
  fat_g: Range;
  confidence: number;
  edited?: boolean;
}

export interface MealTotals {
  kcal: Range;
  protein_g: Range;
  carbs_g: Range;
  fat_g: Range;
}

export interface Meal {
  id: string;
  date: string;
  timestamp: number;
  name?: string;
  imageDataUrl?: string;
  items: FoodItem[];
  notes?: string;
  overall_confidence: number;
  source: 'photo' | 'manual';
  totals: MealTotals;
}

export interface Profile {
  name: string;
  weight: number;
  height: number;
  age: number;
  gender: 'male' | 'female';
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  goal: 'lose' | 'maintain' | 'gain';
  dailyCalorieTarget: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  setupComplete: boolean;
}

export interface Settings {
  apiKey: string;
  provider: 'claude' | 'openai';
  model: string;
}

export interface AnalysisResult {
  success: boolean;
  items: FoodItem[];
  overall_confidence: number;
  notes?: string;
  error?: string;
}

export type Screen =
  | 'diary'
  | 'camera'
  | 'result'
  | 'history'
  | 'profile'
  | 'settings'
  | 'manual';

export interface DayStats {
  date: string;
  meals: Meal[];
  totals: MealTotals;
}
