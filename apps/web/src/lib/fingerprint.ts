/**
 * Empreinte device simple et non intrusive : combine quelques signaux stables
 * du navigateur pour distinguer les appareils dans l'historique de
 * consultation. Ce n'est pas un mécanisme de sécurité, seulement un signal
 * d'audit supplémentaire — le destinataire est déjà identifié par OTP.
 */
export async function computeDeviceFingerprint(): Promise<string> {
  const parts = [
    navigator.userAgent,
    navigator.language,
    String(screen.width),
    String(screen.height),
    String(screen.colorDepth),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ];
  const data = new TextEncoder().encode(parts.join("|"));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}
