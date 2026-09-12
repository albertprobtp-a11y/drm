import type { ReactNode } from "react";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] border-[var(--color-border-strong)]",
  accent: "bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)] border-transparent",
  success: "bg-[var(--color-success-soft)] text-[var(--color-success)] border-transparent",
  warning: "bg-[var(--color-warning-soft)] text-[var(--color-warning)] border-transparent",
  danger: "bg-[var(--color-danger-soft)] text-[var(--color-danger)] border-transparent",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
