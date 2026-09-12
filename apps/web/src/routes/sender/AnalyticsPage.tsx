import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { ShareAnalytics } from "@secureview/shared";
import { apiFetch } from "../../lib/api";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";
import { Alert } from "../../components/ui/Alert";
import { PageHeatmap } from "../../components/PageHeatmap";

const EVENT_LABELS: Record<string, string> = {
  OTP_SENT: "Code envoyé",
  OTP_FAILED: "Code incorrect",
  OTP_VERIFIED: "Code vérifié",
  OPENED: "Document ouvert",
  PAGE_VIEWED: "Page consultée",
  BLURRED: "Fenêtre quittée",
  PRINT_ATTEMPT: "Tentative d'impression",
  DENIED: "Accès refusé",
  EXPIRED: "Lien expiré",
  REVOKED: "Accès révoqué",
};

export function AnalyticsPage() {
  const { shareId } = useParams<{ shareId: string }>();
  const [data, setData] = useState<ShareAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareId) return;
    apiFetch<ShareAnalytics>(`/shares/${shareId}/analytics`)
      .then(setData)
      .catch(() => setError("Impossible de charger les statistiques."));
  }, [shareId]);

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!data) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size={24} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          to={`/documents/${data.share.documentId}`}
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          ← Retour au document
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-[var(--color-text)]">
          {data.share.recipientName}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{data.share.recipientEmail}</p>
      </div>

      <Card className="p-6">
        <h2 className="mb-4 text-[15px] font-medium text-[var(--color-text)]">Temps de lecture par page</h2>
        <PageHeatmap pageHeat={data.pageHeat} />
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-[15px] font-medium text-[var(--color-text)]">Ouvertures</h2>
        {data.sessions.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">Aucune ouverture pour l'instant.</p>
        ) : (
          <div className="flex flex-col divide-y divide-[var(--color-border)]">
            {data.sessions.map((session) => (
              <div key={session.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col">
                  <span className="text-sm text-[var(--color-text)]">
                    {new Date(session.createdAt).toLocaleString("fr-FR")}
                  </span>
                  <span className="text-sm text-[var(--color-text-muted)]">
                    {session.ip} · {session.userAgent}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {session.revokedAt && <Badge tone="danger">Révoquée</Badge>}
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    {Math.round(session.totalDurationMs / 1000)}s de lecture
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-[15px] font-medium text-[var(--color-text)]">Journal d'activité</h2>
        {data.events.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">Aucun événement pour l'instant.</p>
        ) : (
          <div className="flex flex-col divide-y divide-[var(--color-border)]">
            {data.events.map((event) => (
              <div key={event.id} className="flex items-center justify-between py-2.5">
                <span className="text-sm text-[var(--color-text)]">{EVENT_LABELS[event.type] ?? event.type}</span>
                <span className="text-sm text-[var(--color-text-muted)]">
                  {new Date(event.createdAt).toLocaleString("fr-FR")}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
