import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { DocumentSummary, ShareSummary } from "@secureview/shared";
import { apiFetch } from "../../lib/api";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";
import { Alert } from "../../components/ui/Alert";
import { ShareForm } from "../../components/ShareForm";
import { ShareList } from "../../components/ShareList";

export function DocumentDetailPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const [document, setDocument] = useState<DocumentSummary | null>(null);
  const [shares, setShares] = useState<ShareSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!documentId) return;
    try {
      const [doc, shareList] = await Promise.all([
        apiFetch<DocumentSummary>(`/documents/${documentId}`),
        apiFetch<ShareSummary[]>(`/documents/${documentId}/shares`),
      ]);
      setDocument(doc);
      setShares(shareList);
    } catch {
      setError("Impossible de charger ce document.");
    }
  }, [documentId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!document || !shares) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size={24} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link to="/dashboard" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
          ← Documents
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--color-text)]">{document.title}</h1>
          <Badge tone={document.status === "READY" ? "success" : "neutral"}>{document.status}</Badge>
        </div>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {document.originalFilename} · {document.pageCount} pages
        </p>
        {document.status === "FAILED" && document.processingError && (
          <Alert tone="danger">{`Échec du traitement : ${document.processingError}`}</Alert>
        )}
      </div>

      <Card className="p-6">
        <h2 className="mb-4 text-[15px] font-medium text-[var(--color-text)]">Nouveau destinataire</h2>
        <ShareForm
          documentId={document.id}
          onCreated={(share) => setShares((prev) => [share, ...(prev ?? [])])}
        />
      </Card>

      <div>
        <h2 className="mb-4 text-[15px] font-medium text-[var(--color-text)]">Destinataires</h2>
        <ShareList
          shares={shares}
          onChange={(updated) => setShares((prev) => prev?.map((s) => (s.id === updated.id ? updated : s)) ?? [])}
        />
      </div>
    </div>
  );
}
