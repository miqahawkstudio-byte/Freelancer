import { SubtitleSettings, LANGUAGES, MODEL_SIZES } from "../types";

interface Props {
  settings: SubtitleSettings;
  onChange: (s: SubtitleSettings) => void;
  disabled: boolean;
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-gray-300 mb-1.5">{children}</label>;
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-gray-500 mt-1">{children}</p>;
}

function Select({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string | number;
  onChange: (v: string) => void;
  options: { value: string | number; label: string }[];
  disabled: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition-colors disabled:opacity-50"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-gray-900">
          {o.label}
        </option>
      ))}
    </select>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="flex-1 accent-brand-500 disabled:opacity-50"
      />
      <span className="text-sm font-mono w-10 text-right text-gray-300">{value}</span>
    </div>
  );
}

export default function SettingsPanel({ settings, onChange, disabled }: Props) {
  const set = <K extends keyof SubtitleSettings>(key: K, value: SubtitleSettings[K]) =>
    onChange({ ...settings, [key]: value });

  return (
    <div className="glass rounded-2xl p-6 space-y-6">
      <h2 className="text-base font-semibold text-gray-200">Ustawienia napisów</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Language */}
        <div>
          <Label>Język nagrania</Label>
          <Select
            value={settings.language}
            onChange={(v) => set("language", v)}
            options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
            disabled={disabled}
          />
          <Hint>Wybierz język lub zostaw "Wykryj automatycznie".</Hint>
        </div>

        {/* Model */}
        <div>
          <Label>Model AI (Whisper)</Label>
          <Select
            value={settings.modelSize}
            onChange={(v) => set("modelSize", v)}
            options={MODEL_SIZES.map((m) => ({ value: m.code, label: m.label }))}
            disabled={disabled}
          />
          <Hint>Większy model = lepsza dokładność, ale wolniej.</Hint>
        </div>
      </div>

      <hr className="border-white/5" />

      {/* Words per line */}
      <div>
        <Label>Maks. słów w jednej linii: {settings.maxWordsPerLine}</Label>
        <NumberInput
          value={settings.maxWordsPerLine}
          onChange={(v) => set("maxWordsPerLine", v)}
          min={1}
          max={15}
          step={1}
          disabled={disabled}
        />
        <Hint>Zalecane 5–8 słów dla dobrej czytelności napisów.</Hint>
      </div>

      {/* Lines per block */}
      <div>
        <Label>Linie w jednym napisie: {settings.maxLinesPerBlock}</Label>
        <NumberInput
          value={settings.maxLinesPerBlock}
          onChange={(v) => set("maxLinesPerBlock", v)}
          min={1}
          max={3}
          step={1}
          disabled={disabled}
        />
        <Hint>Premiere Pro / DaVinci Resolve zwykle wyświetlają 1–2 linie.</Hint>
      </div>

      {/* Chars per line */}
      <div>
        <Label>Maks. znaków w linii: {settings.maxCharsPerLine}</Label>
        <NumberInput
          value={settings.maxCharsPerLine}
          onChange={(v) => set("maxCharsPerLine", v)}
          min={20}
          max={80}
          step={1}
          disabled={disabled}
        />
        <Hint>Standard dla wideo: 42 znaki. Dla mobilnych zmniejsz do 32.</Hint>
      </div>

      {/* Max duration */}
      <div>
        <Label>Maks. czas trwania napisu: {settings.maxSegmentDuration}s</Label>
        <NumberInput
          value={settings.maxSegmentDuration}
          onChange={(v) => set("maxSegmentDuration", v)}
          min={1}
          max={10}
          step={0.5}
          disabled={disabled}
        />
        <Hint>Jak długo (sekundy) jeden napis jest widoczny na ekranie.</Hint>
      </div>

      {/* Preset buttons */}
      <div>
        <Label>Szybkie ustawienia (presety)</Label>
        <div className="flex flex-wrap gap-2 mt-1">
          {[
            {
              label: "YouTube",
              s: { maxWordsPerLine: 8, maxLinesPerBlock: 2, maxCharsPerLine: 42, maxSegmentDuration: 5 },
            },
            {
              label: "Instagram Reels",
              s: { maxWordsPerLine: 4, maxLinesPerBlock: 1, maxCharsPerLine: 28, maxSegmentDuration: 3 },
            },
            {
              label: "Kino / Film",
              s: { maxWordsPerLine: 10, maxLinesPerBlock: 2, maxCharsPerLine: 60, maxSegmentDuration: 7 },
            },
            {
              label: "Podcast",
              s: { maxWordsPerLine: 6, maxLinesPerBlock: 2, maxCharsPerLine: 42, maxSegmentDuration: 4 },
            },
          ].map((p) => (
            <button
              key={p.label}
              disabled={disabled}
              onClick={() => onChange({ ...settings, ...p.s })}
              className="px-3 py-1.5 text-xs rounded-lg border border-white/10 bg-white/5 hover:bg-brand-600/20 hover:border-brand-500/50 transition-colors disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
