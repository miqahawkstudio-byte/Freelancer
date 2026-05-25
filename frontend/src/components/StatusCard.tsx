import { Loader2, CheckCircle2, AlertCircle, Download } from "lucide-react";
import { Job, LANGUAGES } from "../types";

interface Props {
  job: Job;
  fileName: string;
  onDownload: () => void;
  onReset: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  queued: "W kolejce...",
  transcribing: "Transkrypcja audio...",
  generating: "Generowanie SRT...",
  done: "Gotowe!",
  error: "Błąd",
};

export default function StatusCard({ job, fileName, onDownload, onReset }: Props) {
  const langLabel =
    LANGUAGES.find((l) => l.code === job.detectedLanguage)?.label ?? job.detectedLanguage ?? "–";

  const durationLabel = job.duration
    ? job.duration >= 60
      ? `${Math.floor(job.duration / 60)}m ${Math.round(job.duration % 60)}s`
      : `${Math.round(job.duration)}s`
    : null;

  return (
    <div className="glass rounded-2xl p-6 space-y-5">
      <div className="flex items-start gap-4">
        <div className="shrink-0 mt-0.5">
          {job.status === "done" ? (
            <CheckCircle2 className="text-green-400" size={28} />
          ) : job.status === "error" ? (
            <AlertCircle className="text-red-400" size={28} />
          ) : (
            <Loader2 className="text-brand-400 animate-spin" size={28} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-lg">{STATUS_LABELS[job.status] ?? job.status}</p>
          <p className="text-sm text-gray-400 truncate mt-0.5">{fileName}</p>
          {job.status === "error" && (
            <p className="text-sm text-red-400 mt-2 bg-red-500/10 rounded-lg px-3 py-2">
              {job.error}
            </p>
          )}
        </div>
      </div>

      {job.status === "done" && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-white/5 rounded-xl px-4 py-3">
            <p className="text-gray-500 text-xs mb-1">Wykryty język</p>
            <p className="font-medium">{langLabel}</p>
          </div>
          {durationLabel && (
            <div className="bg-white/5 rounded-xl px-4 py-3">
              <p className="text-gray-500 text-xs mb-1">Czas nagrania</p>
              <p className="font-medium">{durationLabel}</p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        {job.status === "done" && (
          <button
            onClick={onDownload}
            className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 transition-colors rounded-xl py-3 font-semibold"
          >
            <Download size={18} />
            Pobierz SRT
          </button>
        )}
        <button
          onClick={onReset}
          className="flex-1 border border-white/10 hover:bg-white/5 transition-colors rounded-xl py-3 text-gray-300"
        >
          {job.status === "error" ? "Spróbuj ponownie" : "Nowe nagranie"}
        </button>
      </div>
    </div>
  );
}
