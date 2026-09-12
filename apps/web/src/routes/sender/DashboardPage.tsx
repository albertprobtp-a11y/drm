import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { DocumentSummary } from "@secureview/shared";
import { apiFetch } from "../../lib/api";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { Spinner } from "../../components/ui/Spinner";
import { Alert } from "../../components/ui/Alert";
import { UploadDropzone } from "../../components/UploadDropzone";

const STATUS_LABELS: Record<DocumentSummary["status"], { label: string; tone: "neutral" | "accent" | "success" | "danger" }> = {
  PENDING: { label: "En attente", tone: "neutral" },
  PROCESSING: { label: "Traitement…", tone: "accent" },
  READY: { label: "Prêt", tone: "success" },
  FAILED: { label: "Échec", tone: "danger" },
};

export function DashboardPage() {
  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const docs = await apiFetch<DocumentSummary[]>("/documents");
      setDocuments(docs);
      setError(null);
    } catch {
      setError("Impossible de charger vos documents.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const hasPending = documents?.some((d) => d.status === "PENDING" || d.status === "PROCESSING");
    if (hasPending && !pollRef.current) {
      pollRef.current = setInterval(load, 3000);
    } else if (!hasPending && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [documents, load]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--color-text)]">Documents</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Téléversez un PDF, puis partagez-le en lecture seule avec un ou plusieurs destinataires.
        </p>
      </div>

      <UploadDropzone onUploaded={load} />

      {error && <Alert tone="danger">{error}</Alert>}

      {documents === null ? (
        <div className="flex justify-center py-16">
          <Spinner size={24} />
        </div>
      ) : documents.length === 0 ? (
        <EmptyState
          title="Aucun document pour l'instant"
          description="Téléversez votre premier PDF pour commencer à le partager en toute confidentialité."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {documents.map((doc) => {
            const status = STATUS_LABELS[doc.status];
            return (
              <Link key={doc.id} to={`/documents/${doc.id}`}>
                <Card className="flex items-center justify-between px-5 py-4 transition-colors duration-150 hover:border-[var(--color-border-strong)]">
                  <div className="flex flex-col gap-1">
                    <span className="text-[15px] font-medium text-[var(--color-text)]">{doc.title}</span>
                    <span className="text-sm text-[var(--color-text-muted)]">
                      {doc.pageCount > 0 ? `${doc.pageCount} pages` : "…"} · {doc.shareCount}{" "}
                      {doc.shareCount > 1 ? "partages" : "partage"} · {doc.totalViews}{" "}
                      {doc.totalViews > 1 ? "ouvertures" : "ouverture"}
                    </span>
                  </div>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
