import { useState, useCallback, useRef } from "react";
import { Captions } from "lucide-react";
import DropZone from "./components/DropZone";
import SettingsPanel from "./components/SettingsPanel";
import StatusCard from "./components/StatusCard";
import { SubtitleSettings, Job, JobStatus } from "./types";

const DEFAULT_SETTINGS: SubtitleSettings = {
  language: "auto",
  maxWordsPerLine: 7,
  maxLinesPerBlock: 2,
  maxCharsPerLine: 42,
  maxSegmentDuration: 5,
  modelSize: "small",
};

const POLL_INTERVAL_MS = 2000;

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [settings, setSettings] = useState<SubtitleSettings>(DEFAULT_SETTINGS);
  const [job, setJob] = useState<Job | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const pollStatus = useCallback((jobId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/status/${jobId}`);
        if (!res.ok) return;
        const data = await res.json();
        setJob((prev) => ({
          ...prev!,
          status: data.status as JobStatus,
          detectedLanguage: data.detected_language,
          duration: data.duration,
          error: data.error,
        }));
        if (data.status === "done" || data.status === "error") {
          stopPolling();
        }
      } catch {
        // silently ignore network blips
      }
    }, POLL_INTERVAL_MS);
  }, []);

  const handleSubmit = async () => {
    if (!file) return;

    setJob({ id: "", status: "uploading" });
    stopPolling();

    const formData = new FormData();
    formData.append("file", file);
    formData.append("language", settings.language);
    formData.append("max_words_per_line", String(settings.maxWordsPerLine));
    formData.append("max_lines_per_block", String(settings.maxLinesPerBlock));
    formData.append("max_chars_per_line", String(settings.maxCharsPerLine));
    formData.append("max_segment_duration", String(settings.maxSegmentDuration));
    formData.append("model_size", settings.modelSize);

    try {
      const res = await fetch("/api/transcribe", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Nieznany błąd" }));
        setJob({ id: "", status: "error", error: err.detail });
        return;
      }
      const { job_id } = await res.json();
      setJob({ id: job_id, status: "queued" });
      pollStatus(job_id);
    } catch (e: unknown) {
      setJob({ id: "", status: "error", error: String(e) });
    }
  };

  const handleDownload = () => {
    if (!job?.id) return;
    const baseName = file?.name.replace(/\.[^.]+$/, "") ?? "subtitles";
    const a = document.createElement("a");
    a.href = `/api/download/${job.id}?filename=${encodeURIComponent(baseName + ".srt")}`;
    a.click();
  };

  const handleReset = () => {
    stopPolling();
    setJob(null);
    setFile(null);
  };

  const isProcessing =
    job !== null && job.status !== "done" && job.status !== "error";

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/20 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center">
            <Captions size={18} />
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight">SRT Generator</h1>
            <p className="text-xs text-gray-500">Napisy AI dla Premiere Pro i DaVinci Resolve</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 space-y-5">
        {/* Drop zone */}
        <DropZone
          file={file}
          onFile={setFile}
          onClear={() => setFile(null)}
          disabled={isProcessing}
        />

        {/* Settings */}
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          disabled={isProcessing}
        />

        {/* Generate button */}
        {!job && (
          <button
            onClick={handleSubmit}
            disabled={!file}
            className="w-full py-4 rounded-2xl font-semibold text-base bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Generuj napisy SRT
          </button>
        )}

        {/* Status / result */}
        {job && (
          <StatusCard
            job={job}
            fileName={file?.name ?? ""}
            onDownload={handleDownload}
            onReset={handleReset}
          />
        )}
      </main>

      <footer className="text-center text-xs text-gray-600 py-6">
        Działa lokalnie – Twoje pliki nie są wysyłane na zewnętrzne serwery.
      </footer>
    </div>
  );
}
