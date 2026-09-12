import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { ShareStatus, VerifyOtpResponse } from "@secureview/shared";
import { apiFetch } from "../../lib/api";
import { Spinner } from "../../components/ui/Spinner";
import { OtpScreen } from "./OtpScreen";
import { ViewerReader } from "./ViewerReader";
import { ShareUnavailableScreen } from "./ShareUnavailableScreen";

function sessionStorageKey(shareId: string) {
  return `secureview:session:${shareId}`;
}

export function ViewerPage() {
  const { shareId } = useParams<{ shareId: string }>();
  const [status, setStatus] = useState<ShareStatus | null>(null);
  const [session, setSession] = useState<VerifyOtpResponse | null>(null);
  const [cutReason, setCutReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareId) return;
    apiFetch<ShareStatus>(`/shares/${shareId}/status`)
      .then(setStatus)
      .catch(() => setError("Ce lien n'existe pas ou n'est plus disponible."));

    const stored = sessionStorage.getItem(sessionStorageKey(shareId));
    if (stored) {
      try {
        const parsed: VerifyOtpResponse = JSON.parse(stored);
        if (new Date(parsed.expiresAt).getTime() > Date.now()) setSession(parsed);
      } catch {
        sessionStorage.removeItem(sessionStorageKey(shareId));
      }
    }
  }, [shareId]);

  function handleVerified(newSession: VerifyOtpResponse) {
    if (shareId) sessionStorage.setItem(sessionStorageKey(shareId), JSON.stringify(newSession));
    setSession(newSession);
  }

  function handleCut(reason: string) {
    if (shareId) sessionStorage.removeItem(sessionStorageKey(shareId));
    setCutReason(reason);
    setSession(null);
  }

  if (error) return <ShareUnavailableScreen state="REVOKED" reason={error} />;

  if (cutReason) return <ShareUnavailableScreen state="REVOKED" reason={cutReason} />;

  if (session) return <ViewerReader session={session} onCut={handleCut} />;

  if (!status || !shareId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
        <Spinner size={28} />
      </div>
    );
  }

  if (status.state !== "ACTIVE") {
    return <ShareUnavailableScreen state={status.state} />;
  }

  return (
    <OtpScreen
      shareToken={shareId}
      documentTitle={status.documentTitle}
      recipientName={status.recipientName}
      onVerified={handleVerified}
    />
  );
}
