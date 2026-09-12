import type { ShareState } from "@secureview/shared";

const CONTENT: Record<Exclude<ShareState, "ACTIVE">, { title: string; description: string }> = {
  REVOKED: {
    title: "Cet accès n'est plus disponible",
    description: "L'expéditeur a révoqué ce partage. Contactez-le directement si vous pensez qu'il s'agit d'une erreur.",
  },
  EXPIRED: {
    title: "Ce lien a expiré",
    description: "La période de consultation de ce document est terminée. Demandez un nouveau lien à l'expéditeur si besoin.",
  },
  VIEW_LIMIT_REACHED: {
    title: "Nombre de consultations atteint",
    description: "Ce document a déjà été consulté le nombre de fois autorisé. Demandez un nouveau lien à l'expéditeur si besoin.",
  },
};

export function ShareUnavailableScreen({ state, reason }: { state: Exclude<ShareState, "ACTIVE">; reason?: string }) {
  const content = CONTENT[state];
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-raised)]">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-text-muted)]" />
        </div>
        <h1 className="text-lg font-semibold text-[var(--color-text)]">{content.title}</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">{reason ?? content.description}</p>
      </div>
    </div>
  );
}
