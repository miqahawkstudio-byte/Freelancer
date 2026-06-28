import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, RefreshCw, Check, X, Pencil, Trash2, Plus, AlertCircle, AlertTriangle, Settings } from 'lucide-react';
import type { FoodItem, AnalysisResult } from '../../types';
import type { CompressedImage } from '../../lib/imageUtils';
import { getSettings, saveMeal, computeTotals } from '../../lib/storage';
import { toDateString, generateId, formatKcal, formatGrams, midpoint } from '../../lib/utils';
import { analyzeImage } from '../../lib/visionApi';
import ConfidenceBadge from '../ui/ConfidenceBadge';

interface Props {
  image: CompressedImage;
  onSave: () => void;
  onBack: () => void;
  onGoSettings: () => void;
}

interface EditState {
  name: string;
  quantity: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
}

function itemToEdit(item: FoodItem): EditState {
  return {
    name: item.name,
    quantity: String(midpoint(item.quantity_g)),
    kcal: String(midpoint(item.kcal)),
    protein: String(midpoint(item.protein_g)),
    carbs: String(midpoint(item.carbs_g)),
    fat: String(midpoint(item.fat_g)),
  };
}

function editToItem(e: EditState, original: FoodItem): FoodItem {
  const n = (s: string, fallback = 0) => { const v = parseFloat(s); return isNaN(v) ? fallback : Math.max(0, v); };
  const exact = (v: number) => ({ min: v, max: v });
  return {
    ...original,
    name: e.name.trim() || original.name,
    quantity_g: exact(n(e.quantity, midpoint(original.quantity_g))),
    kcal: exact(n(e.kcal, midpoint(original.kcal))),
    protein_g: exact(n(e.protein, midpoint(original.protein_g))),
    carbs_g: exact(n(e.carbs, midpoint(original.carbs_g))),
    fat_g: exact(n(e.fat, midpoint(original.fat_g))),
    edited: true,
    confidence: original.confidence,
  };
}

export default function ResultScreen({ image, onSave, onBack, onGoSettings }: Props) {
  const settings = getSettings();
  const [items, setItems] = useState<FoodItem[]>([]);
  const [confidence, setConfidence] = useState(0.7);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const analyzed = useRef(false);

  useEffect(() => {
    if (!analyzed.current) {
      analyzed.current = true;
      analyze();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function analyze() {
    if (!settings.apiKey) {
      setStatus('error');
      setErrorMsg('NO_KEY');
      return;
    }
    setStatus('loading');
    setErrorMsg('');
    try {
      const result = await analyzeImage(
        image.base64,
        image.mediaType,
        settings.apiKey,
        settings.provider,
        settings.model || '',
      );
      if (!result.success) {
        setStatus('error');
        setErrorMsg(result.error || 'Nie rozpoznano jedzenia na zdjęciu');
        return;
      }
      setItems(result.items);
      setConfidence(result.overall_confidence ?? 0.7);
      setNotes(result.notes || '');
      setStatus('success');
    } catch (e) {
      setStatus('error');
      setErrorMsg(String(e).replace('Error: ', ''));
    }
  }

  function startEdit(item: FoodItem) {
    setEditingId(item.id);
    setEditState(itemToEdit(item));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditState(null);
  }

  function confirmEdit(item: FoodItem) {
    if (!editState) return;
    const updated = editToItem(editState, item);
    setItems(prev => prev.map(i => i.id === item.id ? updated : i));
    setEditingId(null);
    setEditState(null);
  }

  function deleteItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
  }

  function addItem() {
    const blank: FoodItem = {
      id: generateId(),
      name: 'Nowa pozycja',
      quantity_g: { min: 100, max: 100 },
      kcal: { min: 0, max: 0 },
      protein_g: { min: 0, max: 0 },
      carbs_g: { min: 0, max: 0 },
      fat_g: { min: 0, max: 0 },
      confidence: 1,
      edited: true,
    };
    setItems(prev => [...prev, blank]);
    setEditingId(blank.id);
    setEditState(itemToEdit(blank));
  }

  async function handleSave() {
    if (items.length === 0) return;
    setSaving(true);
    const totals = computeTotals(items);
    const meal = {
      id: generateId(),
      date: toDateString(),
      timestamp: Date.now(),
      imageDataUrl: image.dataUrl,
      items,
      notes,
      overall_confidence: confidence,
      source: 'photo' as const,
      totals,
    };
    saveMeal(meal);
    setSaving(false);
    onSave();
  }

  const totals = computeTotals(items);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white px-4 pt-10 pb-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-500">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Wynik analizy</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Image */}
        <img
          src={image.dataUrl}
          alt="zdjęcie posiłku"
          className="w-full max-h-60 object-cover"
        />

        <div className="px-4 py-5 space-y-4">
          {/* Loading */}
          {status === 'loading' && (
            <div className="flex flex-col items-center py-10 gap-4">
              <div className="w-10 h-10 border-3 border-green-500 border-t-transparent rounded-full animate-spin" />
              <div className="text-center">
                <p className="font-semibold text-gray-800">Analizuję zdjęcie...</p>
                <p className="text-sm text-gray-400 mt-1">Model vision rozpoznaje produkty</p>
              </div>
            </div>
          )}

          {/* No API key */}
          {status === 'error' && errorMsg === 'NO_KEY' && (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                <AlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-800">Brak klucza API</p>
                  <p className="text-sm text-amber-600 mt-1">
                    Aby analizować zdjęcia, skonfiguruj klucz Claude lub OpenAI w ustawieniach.
                  </p>
                </div>
              </div>
              <button
                onClick={onGoSettings}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 text-white rounded-2xl py-4 font-bold"
              >
                <Settings size={18} />
                Przejdź do ustawień
              </button>
            </div>
          )}

          {/* Other error */}
          {status === 'error' && errorMsg !== 'NO_KEY' && (
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-800">Nie udało się przeanalizować</p>
                  <p className="text-sm text-red-600 mt-1">{errorMsg}</p>
                </div>
              </div>
              <button
                onClick={() => { analyzed.current = false; analyze(); }}
                className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-700 rounded-2xl py-3 font-medium hover:bg-gray-50"
              >
                <RefreshCw size={16} />
                Spróbuj ponownie
              </button>
            </div>
          )}

          {/* Results */}
          {status === 'success' && (
            <>
              {/* Confidence + notes */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">Rozpoznane produkty</p>
                <ConfidenceBadge confidence={confidence} />
              </div>
              {notes && (
                <p className="text-xs text-gray-400 italic -mt-2">{notes}</p>
              )}

              {/* Food items */}
              <div className="space-y-3">
                {items.map(item => (
                  <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    {editingId === item.id && editState ? (
                      /* Edit form */
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs text-gray-500">Nazwa</label>
                          <input
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:border-green-500"
                            value={editState.name}
                            onChange={e => setEditState(s => s ? { ...s, name: e.target.value } : s)}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: 'Gramatura (g)', key: 'quantity' as const },
                            { label: 'Kalorie (kcal)', key: 'kcal' as const },
                            { label: 'Białko (g)', key: 'protein' as const },
                            { label: 'Węgle (g)', key: 'carbs' as const },
                            { label: 'Tłuszcze (g)', key: 'fat' as const },
                          ].map(({ label, key }) => (
                            <div key={key}>
                              <label className="text-xs text-gray-500">{label}</label>
                              <input
                                type="number"
                                min="0"
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:border-green-500"
                                value={editState[key]}
                                onChange={e => setEditState(s => s ? { ...s, [key]: e.target.value } : s)}
                              />
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => confirmEdit(item)}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 text-white rounded-xl py-2.5 text-sm font-semibold"
                          >
                            <Check size={16} /> Zapisz
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm"
                          >
                            <X size={16} /> Anuluj
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Display mode */
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-gray-800 text-sm">{item.name}</p>
                              {item.edited && (
                                <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">
                                  edytowano
                                </span>
                              )}
                              <ConfidenceBadge confidence={item.confidence} size="xs" />
                            </div>
                            {item.description && (
                              <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{item.description}</p>
                            )}
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              onClick={() => startEdit(item)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => deleteItem(item.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <span>~{midpoint(item.quantity_g)} g</span>
                          <span className="font-bold text-gray-800">{formatKcal(item.kcal)}</span>
                          <span>B: {formatGrams(item.protein_g)}</span>
                          <span>W: {formatGrams(item.carbs_g)}</span>
                          <span>T: {formatGrams(item.fat_g)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add item button */}
                <button
                  onClick={addItem}
                  className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-3 flex items-center justify-center gap-2 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors"
                >
                  <Plus size={16} />
                  Dodaj pozycję ręcznie
                </button>
              </div>

              {/* Totals */}
              {items.length > 0 && (
                <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">
                    Łącznie
                  </p>
                  <p className="text-2xl font-black text-gray-900">{formatKcal(totals.kcal)}</p>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    <span>Białko: <strong>{formatGrams(totals.protein_g)}</strong></span>
                    <span>Węgle: <strong>{formatGrams(totals.carbs_g)}</strong></span>
                    <span>Tłuszcze: <strong>{formatGrams(totals.fat_g)}</strong></span>
                  </div>
                </div>
              )}

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={items.length === 0 || saving}
                className="w-full bg-green-600 text-white rounded-2xl py-4 font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-green-200 disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check size={20} />
                )}
                Zapisz posiłek
              </button>

              <p className="text-xs text-center text-gray-400">
                Zakresy kcal to szacunki — możesz edytować każdą pozycję przed zapisem
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
