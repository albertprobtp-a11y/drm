import { useRef, useState, type DragEvent } from "react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface UploadDropzoneProps {
  onUploaded: () => void;
}

function uploadWithProgress(file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("title", file.name.replace(/\.pdf$/i, ""));
    form.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/api/documents`);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        try {
          const parsed = JSON.parse(xhr.responseText);
          reject(new Error(parsed.error ?? "Échec du téléversement."));
        } catch {
          reject(new Error("Échec du téléversement."));
        }
      }
    };
    xhr.onerror = () => reject(new Error("Échec du téléversement (réseau)."));
    xhr.send(form);
  });
}

export function UploadDropzone({ onUploaded }: UploadDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (file.type !== "application/pdf") {
      setError("Seuls les fichiers PDF sont acceptés.");
      return;
    }
    setError(null);
    setProgress(0);
    try {
      await uploadWithProgress(file, setProgress);
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du téléversement.");
    } finally {
      setProgress(null);
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  const isUploading = progress !== null;

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors duration-150 ${
          dragging
            ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
            : "border-[var(--color-border-strong)] hover:border-[var(--color-text-muted)]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
        {isUploading ? (
          <div className="w-full max-w-xs">
            <p className="mb-2 text-sm text-[var(--color-text-secondary)]">Téléversement… {progress}%</p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-raised)]">
              <div
                className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <p className="text-[15px] font-medium text-[var(--color-text)]">
              Glissez un PDF ici, ou cliquez pour sélectionner
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">100 Mo maximum</p>
          </>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
