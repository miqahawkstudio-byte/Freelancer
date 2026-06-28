import { useRef, useState, useCallback } from 'react';
import { ArrowLeft, Camera, Upload, PenLine, AlertCircle, Info } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import type { Screen } from '../../types';
import { compressImage, type CompressedImage } from '../../lib/imageUtils';
import { getSettings } from '../../lib/storage';

interface Props {
  onImageCaptured: (img: CompressedImage) => void;
  onManualEntry: () => void;
  onBack: () => void;
}

export default function CameraScreen({ onImageCaptured, onManualEntry, onBack }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const settings = getSettings();

  async function processFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Wybierz plik graficzny (JPG, PNG, HEIC...)');
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      setError('Plik jest za duży. Maksymalnie 30 MB.');
      return;
    }
    setError(null);
    setProcessing(true);
    try {
      const compressed = await compressImage(file);
      onImageCaptured(compressed);
    } catch (e) {
      setError(String(e));
      setProcessing(false);
    }
  }

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) processFile(accepted[0]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false,
    disabled: processing,
  });

  function handleCameraCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white px-4 pt-10 pb-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-500">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Dodaj posiłek</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {/* No API key warning */}
        {!settings.apiKey && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700">
              Nie ustawiono klucza API. Analiza zdjęcia będzie niemożliwa — skonfiguruj klucz w{' '}
              <strong>Profil → Ustawienia</strong> lub dodaj posiłek ręcznie.
            </p>
          </div>
        )}

        {/* Camera button (mobile: opens camera directly) */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleCameraCapture}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={processing}
          className="w-full bg-green-600 text-white rounded-2xl py-5 font-bold text-base flex items-center justify-center gap-3 shadow-lg shadow-green-200 disabled:opacity-50 active:scale-98 transition-transform"
        >
          <Camera size={24} />
          Zrób zdjęcie aparatem
        </button>

        {/* Drag & drop / gallery */}
        <div
          {...getRootProps()}
          className={`w-full border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-green-500 bg-green-50'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          } ${processing ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <input {...getInputProps()} />
          <Upload size={28} className="mx-auto text-gray-400 mb-3" />
          <p className="text-sm font-medium text-gray-700">
            {isDragActive ? 'Upuść zdjęcie tutaj' : 'Wybierz z galerii'}
          </p>
          <p className="text-xs text-gray-400 mt-1">lub przeciągnij i upuść</p>
        </div>

        {processing && (
          <div className="flex items-center justify-center gap-3 py-4">
            <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-600">Przetwarzanie obrazu...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Manual entry */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs text-center text-gray-400 mb-3">lub</p>
          <button
            onClick={onManualEntry}
            className="w-full border border-gray-200 text-gray-700 rounded-2xl py-4 font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
          >
            <PenLine size={18} />
            Wpisz posiłek ręcznie
          </button>
        </div>

        {/* Privacy notice */}
        <button
          onClick={() => setShowPrivacy(v => !v)}
          className="flex items-center gap-1.5 text-xs text-gray-400 mx-auto"
        >
          <Info size={13} />
          Co trafia do API?
        </button>
        {showPrivacy && (
          <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 space-y-1.5">
            <p className="font-medium text-gray-700">Prywatność</p>
            <p>
              Twoje zdjęcie jest wysyłane <strong>bezpośrednio</strong> do API modelu vision (Claude lub
              OpenAI), używając klucza API podanego przez Ciebie. Zdjęcia nie są przechowywane na żadnych
              innych serwerach poza lokalnym backendem aplikacji.
            </p>
            <p>
              Lokalne dane (dziennik, profil) są przechowywane wyłącznie w przeglądarce (localStorage).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
