import { useState, type FormEvent } from "react";
import type { VerifyOtpResponse } from "@secureview/shared";
import { apiFetch, ApiError } from "../../lib/api";
import { computeDeviceFingerprint } from "../../lib/fingerprint";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Alert } from "../../components/ui/Alert";

interface OtpScreenProps {
  shareToken: string;
  documentTitle: string;
  recipientName: string;
  onVerified: (session: VerifyOtpResponse) => void;
}

export function OtpScreen({ shareToken, documentTitle, recipientName, onVerified }: OtpScreenProps) {
  const [step, setStep] = useState<"request" | "verify">("request");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRequest() {
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ ok: boolean; sentTo: string }>("/recipient-auth/otp/request", {
        method: "POST",
        body: { shareToken },
      });
      setSentTo(res.sentTo);
      setStep("verify");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'envoyer le code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const deviceFingerprint = await computeDeviceFingerprint();
      const session = await apiFetch<VerifyOtpResponse>("/recipient-auth/otp/verify", {
        method: "POST",
        body: { shareToken, code, deviceFingerprint },
      });
      onVerified(session);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Code incorrect.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
          <span className="text-[15px] font-semibold tracking-tight text-[var(--color-text)]">SecureView</span>
        </div>

        <h1 className="mb-1 text-lg font-semibold text-[var(--color-text)]">{documentTitle}</h1>
        <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
          Bonjour {recipientName}, vérifiez votre identité pour accéder à ce document confidentiel.
        </p>

        {error && (
          <div className="mb-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        )}

        {step === "request" ? (
          <Button onClick={handleRequest} loading={loading} className="w-full">
            Recevoir un code par email
          </Button>
        ) : (
          <form onSubmit={handleVerify} className="flex flex-col gap-4">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Un code à 6 chiffres a été envoyé à <strong className="text-[var(--color-text)]">{sentTo}</strong>.
            </p>
            <Input
              name="code"
              label="Code de vérification"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="text-center text-lg tracking-[0.5em]"
              required
            />
            <Button type="submit" loading={loading} disabled={code.length !== 6} className="w-full">
              Vérifier
            </Button>
            <button
              type="button"
              onClick={handleRequest}
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            >
              Renvoyer un code
            </button>
          </form>
        )}

        <p className="mt-8 text-center text-xs text-[var(--color-text-muted)]">
          Document confidentiel — la consultation sera tracée à votre nom.
        </p>
      </div>
    </div>
  );
}
