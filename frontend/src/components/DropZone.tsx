import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FileVideo, FileAudio, X } from "lucide-react";

interface Props {
  file: File | null;
  onFile: (file: File) => void;
  onClear: () => void;
  disabled: boolean;
}

export default function DropZone({ file, onFile, onClear, disabled }: Props) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) onFile(accepted[0]);
    },
    [onFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "audio/mpeg": [".mp3"],
      "audio/wav": [".wav"],
      "audio/ogg": [".ogg"],
      "audio/mp4": [".m4a"],
      "video/mp4": [".mp4"],
      "video/webm": [".webm"],
    },
    maxFiles: 1,
    disabled,
  });

  if (file) {
    const isVideo = file.type.startsWith("video/");
    const sizeLabel =
      file.size > 1024 * 1024
        ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
        : `${(file.size / 1024).toFixed(0)} KB`;

    return (
      <div className="glass rounded-2xl p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-brand-600/20 flex items-center justify-center shrink-0">
          {isVideo ? (
            <FileVideo className="text-brand-400" size={24} />
          ) : (
            <FileAudio className="text-brand-400" size={24} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{file.name}</p>
          <p className="text-sm text-gray-400">{sizeLabel}</p>
        </div>
        {!disabled && (
          <button
            onClick={onClear}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1"
            title="Usuń plik"
          >
            <X size={20} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all
        ${isDragActive ? "border-brand-500 bg-brand-500/10" : "border-white/10 hover:border-brand-500/50 hover:bg-white/5"}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      <input {...getInputProps()} />
      <UploadCloud className="mx-auto mb-4 text-gray-500" size={40} />
      <p className="text-lg font-medium text-gray-300">
        {isDragActive ? "Upuść plik tutaj..." : "Przeciągnij plik lub kliknij"}
      </p>
      <p className="text-sm text-gray-500 mt-1">MP3, MP4, WAV, M4A, OGG, WEBM</p>
    </div>
  );
}
