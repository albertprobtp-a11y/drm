import { useState, type FormEvent } from "react";
import type { ShareSummary } from "@secureview/shared";
import { apiFetch, ApiError } from "../lib/api";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { Alert } from "./ui/Alert";

interface ShareFormProps {
  documentId: string;
  onCreated: (share: ShareSummary) => void;
}

export function ShareForm({ documentId, onCreated }: ShareFormProps) {
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [canPrint, setCanPrint] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [maxViews, setMaxViews] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const share = await apiFetch<ShareSummary>(`/documents/${documentId}/shares`, {
        method: "POST",
        body: {
          recipientName,
          recipientEmail,
          canPrint,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          maxViews: maxViews ? Number(maxViews) : null,
        },
      });
      onCreated(share);
      setRecipientName("");
      setRecipientEmail("");
      setCanPrint(false);
      setExpiresAt("");
      setMaxViews("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de créer le partage.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          name="recipientName"
          label="Nom du destinataire"
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
          required
        />
        <Input
          name="recipientEmail"
          label="Email du destinataire"
          type="email"
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
          required
        />
        <Input
          name="expiresAt"
          label="Expiration (optionnel)"
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
        />
        <Input
          name="maxViews"
          label="Nombre de vues max (optionnel)"
          type="number"
          min={1}
          value={maxViews}
          onChange={(e) => setMaxViews(e.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
        <input
          type="checkbox"
          checked={canPrint}
          onChange={(e) => setCanPrint(e.target.checked)}
          className="h-4 w-4 rounded border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] accent-[var(--color-accent)]"
        />
        Autoriser l'impression
      </label>
      <Button type="submit" loading={loading} className="self-start">
        Créer le partage
      </Button>
    </form>
  );
}
