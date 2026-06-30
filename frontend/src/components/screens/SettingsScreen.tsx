import { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Trash2, Save, AlertTriangle } from 'lucide-react';
import type { Settings } from '../../types';
import { getSettings, saveSettings, clearAllData } from '../../lib/storage';

interface Props {
  onBack: () => void;
}

export default function SettingsScreen({ onBack }: Props) {
  const [settings, setSettings] = useState<Settings>(getSettings);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings(s => ({ ...s, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    saveSettings(settings);
    setSaved(true);
  }

  function handleClearData() {
    if (!confirm('Usunąć WSZYSTKIE dane? (profil, posiłki, ustawienia)\n\nTej operacji nie można cofnąć.')) return;
    clearAllData();
    window.location.reload();
  }

  const claudeModels = [
    { value: '', label: 'claude-sonnet-4-6 (domyślny)' },
    { value: 'claude-opus-4-8', label: 'claude-opus-4-8 (najdokładniejszy)' },
    { value: 'claude-haiku-4-5-20251001', label: 'claude-haiku-4-5-20251001 (najszybszy)' },
  ];

  const openaiModels = [
    { value: '', label: 'gpt-4o (domyślny)' },
    { value: 'gpt-4o-mini', label: 'gpt-4o-mini (szybszy)' },
  ];

  const models = settings.provider === 'claude' ? claudeModels : openaiModels;

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="bg-white px-4 pt-10 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-500">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Ustawienia</h1>
        </div>
      </div>

      <div className="px-4 mt-5 space-y-5">
        {/* API Section */}
        <section>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Model Vision API
          </p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
            {/* Provider */}
            <div className="px-4 py-3.5">
              <p className="text-sm text-gray-700 mb-2">Provider</p>
              <div className="flex gap-3">
                {(['claude', 'openai'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => { update('provider', p); update('model', ''); }}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                      settings.provider === p
                        ? 'bg-green-600 text-white border-green-600'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {p === 'claude' ? 'Claude (Anthropic)' : 'GPT-4o (OpenAI)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Model */}
            <div className="px-4 py-3.5">
              <p className="text-sm text-gray-700 mb-2">Model</p>
              <select
                className="w-full text-sm text-gray-700 border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:border-green-500"
                value={settings.model}
                onChange={e => update('model', e.target.value)}
              >
                {models.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* API Key */}
            <div className="px-4 py-3.5">
              <p className="text-sm text-gray-700 mb-2">Klucz API</p>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 pr-10 focus:outline-none focus:border-green-500 font-mono"
                  placeholder={settings.provider === 'claude' ? 'sk-ant-...' : 'sk-...'}
                  value={settings.apiKey}
                  onChange={e => update('apiKey', e.target.value)}
                />
                <button
                  onClick={() => setShowKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                {settings.provider === 'claude'
                  ? 'Pobierz klucz: console.anthropic.com'
                  : 'Pobierz klucz: platform.openai.com'}
              </p>
            </div>
          </div>

          {/* Security note */}
          <div className="mt-2 flex items-start gap-2 px-1">
            <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400">
              Klucz przechowywany jest w localStorage przeglądarki. Na urządzeniu współdzielonym używaj z ostrożnością.
            </p>
          </div>
        </section>

        {/* Save */}
        <button
          onClick={handleSave}
          className="w-full bg-green-600 text-white rounded-2xl py-4 font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-200"
        >
          {saved ? '✓ Zapisano!' : <><Save size={18} /> Zapisz ustawienia</>}
        </button>

        {/* Danger zone */}
        <section>
          <p className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-3">
            Strefa niebezpieczna
          </p>
          <button
            onClick={handleClearData}
            className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-500 rounded-2xl py-4 font-medium hover:bg-red-50"
          >
            <Trash2 size={18} />
            Usuń wszystkie dane
          </button>
        </section>

        {/* About */}
        <div className="text-center text-xs text-gray-400 pb-2 space-y-1">
          <p className="font-semibold text-gray-600">CalorieVision</p>
          <p>Szacowanie kalorii z fotografii posiłku</p>
          <p className="mt-2">Szacunki kaloryczne mogą być niedokładne o ±20–30%.</p>
          <p>Nie są podstawą decyzji medycznych.</p>
        </div>
      </div>
    </div>
  );
}
