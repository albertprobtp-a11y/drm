import type { ReactNode } from "react";

type Tone = "danger" | "success" | "warning" | "neutral";

const toneClasses: Record<Tone, string> = {
  danger: "bg-[var(--color-danger-soft)] text-[var(--color-danger)] border-[var(--color-danger)]/30",
  success: "bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success)]/30",
  warning: "bg-[var(--color-warning-soft)] text-[var(--color-warning)] border-[var(--color-warning)]/30",
  neutral: "bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] border-[var(--color-border-strong)]",
};

export function Alert({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${toneClasses[tone]}`} role="alert">
      {children}
    </div>
  );
}
