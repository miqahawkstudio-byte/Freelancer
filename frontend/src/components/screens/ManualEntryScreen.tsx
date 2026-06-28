import { useState } from 'react';
import { ArrowLeft, Plus, Trash2, Check } from 'lucide-react';
import type { FoodItem } from '../../types';
import { saveMeal, computeTotals } from '../../lib/storage';
import { toDateString, generateId, formatKcal } from '../../lib/utils';

interface Props {
  onSave: () => void;
  onBack: () => void;
}

const EMPTY_ITEM = (): Partial<FoodItem> => ({
  id: generateId(),
  name: '',
  quantity_g: { min: 100, max: 100 },
  kcal: { min: 0, max: 0 },
  protein_g: { min: 0, max: 0 },
  carbs_g: { min: 0, max: 0 },
  fat_g: { min: 0, max: 0 },
  confidence: 1,
  edited: true,
});

interface ItemForm {
  id: string;
  name: string;
  quantity: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
}

function newForm(): ItemForm {
  return { id: generateId(), name: '', quantity: '100', kcal: '', protein: '', carbs: '', fat: '' };
}

function formToItem(f: ItemForm): FoodItem {
  const n = (s: string) => Math.max(0, parseFloat(s) || 0);
  const exact = (v: number) => ({ min: v, max: v });
  return {
    id: f.id,
    name: f.name || 'Produkt',
    quantity_g: exact(n(f.quantity)),
    kcal: exact(n(f.kcal)),
    protein_g: exact(n(f.protein)),
    carbs_g: exact(n(f.carbs)),
    fat_g: exact(n(f.fat)),
    confidence: 1,
    edited: true,
  };
}

export default function ManualEntryScreen({ onSave, onBack }: Props) {
  const [mealName, setMealName] = useState('');
  const [forms, setForms] = useState<ItemForm[]>([newForm()]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function updateForm(id: string, key: keyof ItemForm, value: string) {
    setForms(prev => prev.map(f => f.id === id ? { ...f, [key]: value } : f));
    setErrors(prev => { const e = { ...prev }; delete e[`${id}-${key}`]; return e; });
  }

  function addForm() {
    setForms(prev => [...prev, newForm()]);
  }

  function removeForm(id: string) {
    setForms(prev => prev.filter(f => f.id !== id));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    forms.forEach(f => {
      if (!f.name.trim()) e[`${f.id}-name`] = 'Wpisz nazwę';
      if (!f.kcal) e[`${f.id}-kcal`] = 'Wpisz kalorie';
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    setSaving(true);
    const items = forms.map(formToItem);
    const totals = computeTotals(items);
    saveMeal({
      id: generateId(),
      date: toDateString(),
      timestamp: Date.now(),
      name: mealName || undefined,
      items,
      overall_confidence: 1,
      source: 'manual',
      totals,
    });
    setSaving(false);
    onSave();
  }

  const preview = computeTotals(forms.map(formToItem));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white px-4 pt-10 pb-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-500">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Ręczne dodanie</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {/* Meal name */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Nazwa posiłku (opcjonalna)
          </label>
          <input
            className="w-full mt-2 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-500"
            placeholder="np. Obiad, Śniadanie..."
            value={mealName}
            onChange={e => setMealName(e.target.value)}
          />
        </div>

        {/* Items */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Produkty</p>
          <div className="space-y-4">
            {forms.map((form, idx) => (
              <div key={form.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-700">Produkt {idx + 1}</p>
                  {forms.length > 1 && (
                    <button
                      onClick={() => removeForm(form.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <input
                      className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-500 ${
                        errors[`${form.id}-name`] ? 'border-red-300' : 'border-gray-200'
                      }`}
                      placeholder="Nazwa produktu *"
                      value={form.name}
                      onChange={e => updateForm(form.id, 'name', e.target.value)}
                    />
                    {errors[`${form.id}-name`] && (
                      <p className="text-xs text-red-500 mt-1">{errors[`${form.id}-name`]}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <NumField
                      label="Gramatura (g)"
                      value={form.quantity}
                      onChange={v => updateForm(form.id, 'quantity', v)}
                    />
                    <NumField
                      label="Kalorie (kcal) *"
                      value={form.kcal}
                      error={errors[`${form.id}-kcal`]}
                      onChange={v => updateForm(form.id, 'kcal', v)}
                    />
                    <NumField
                      label="Białko (g)"
                      value={form.protein}
                      onChange={v => updateForm(form.id, 'protein', v)}
                    />
                    <NumField
                      label="Węgle (g)"
                      value={form.carbs}
                      onChange={v => updateForm(form.id, 'carbs', v)}
                    />
                    <NumField
                      label="Tłuszcze (g)"
                      value={form.fat}
                      onChange={v => updateForm(form.id, 'fat', v)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Add product */}
        <button
          onClick={addForm}
          className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-3 flex items-center justify-center gap-2 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500"
        >
          <Plus size={16} />
          Dodaj kolejny produkt
        </button>

        {/* Preview totals */}
        {preview.kcal.min > 0 && (
          <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
            <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Łącznie</p>
            <p className="text-xl font-black text-gray-900">{formatKcal(preview.kcal)}</p>
            <div className="flex gap-3 mt-1 text-xs text-gray-500">
              <span>B: {preview.protein_g.min}g</span>
              <span>W: {preview.carbs_g.min}g</span>
              <span>T: {preview.fat_g.min}g</span>
            </div>
          </div>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-green-600 text-white rounded-2xl py-4 font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-200 disabled:opacity-50"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Check size={20} />
          )}
          Zapisz posiłek
        </button>
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs text-gray-400">{label}</label>
      <input
        type="number"
        min="0"
        step="0.1"
        className={`w-full mt-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500 ${
          error ? 'border-red-300' : 'border-gray-200'
        }`}
        value={value}
        placeholder="0"
        onChange={e => onChange(e.target.value)}
      />
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}
