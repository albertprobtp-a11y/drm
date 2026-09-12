import { useState } from "react";
import { Link } from "react-router-dom";
import type { ShareSummary } from "@secureview/shared";
import { apiFetch } from "../lib/api";
import { Card } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";

function shareTone(share: ShareSummary): { label: string; tone: "success" | "danger" | "warning" | "neutral" } {
  if (share.revokedAt) return { label: "Révoqué", tone: "danger" };
  if (share.isExpired) return { label: "Expiré", tone: "warning" };
  if (share.maxViews !== null && share.viewCount >= share.maxViews) {
    return { label: "Limite de vues atteinte", tone: "warning" };
  }
  return { label: "Actif", tone: "success" };
}

interface ShareListProps {
  shares: ShareSummary[];
  onChange: (share: ShareSummary) => void;
}

export function ShareList({ shares, onChange }: ShareListProps) {
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleRevoke(shareId: string) {
    setRevokingId(shareId);
    try {
      const updated = await apiFetch<ShareSummary>(`/shares/${shareId}/revoke`, { method: "POST" });
      onChange(updated);
    } finally {
      setRevokingId(null);
    }
  }

  function handleCopyLink(shareId: string) {
    const url = `${window.location.origin}/viewer/${shareId}`;
    void navigator.clipboard.writeText(url);
    setCopiedId(shareId);
    setTimeout(() => setCopiedId((current) => (current === shareId ? null : current)), 2000);
  }

  if (shares.length === 0) {
    return <EmptyState title="Aucun destinataire" description="Ajoutez un premier destinataire ci-dessus." />;
  }

  return (
    <div className="flex flex-col gap-2">
      {shares.map((share) => {
        const status = shareTone(share);
        return (
          <Card key={share.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-medium text-[var(--color-text)]">{share.recipientName}</span>
                <Badge tone={status.tone}>{status.label}</Badge>
                {share.canPrint && <Badge tone="neutral">Impression autorisée</Badge>}
              </div>
              <span className="text-sm text-[var(--color-text-muted)]">
                {share.recipientEmail} · {share.viewCount} ouverture{share.viewCount > 1 ? "s" : ""}
                {share.expiresAt && ` · expire le ${new Date(share.expiresAt).toLocaleDateString("fr-FR")}`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => handleCopyLink(share.id)}>
                {copiedId === share.id ? "Copié !" : "Copier le lien"}
              </Button>
              <Link to={`/shares/${share.id}/analytics`}>
                <Button variant="secondary" size="sm">
                  Statistiques
                </Button>
              </Link>
              {!share.revokedAt && (
                <Button
                  variant="danger"
                  size="sm"
                  loading={revokingId === share.id}
                  onClick={() => handleRevoke(share.id)}
                >
                  Révoquer
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
