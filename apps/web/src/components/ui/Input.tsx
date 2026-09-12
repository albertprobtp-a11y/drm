import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, id, className = "", ...props }: InputProps) {
  const inputId = id ?? props.name;
  return (
    <label className="flex flex-col gap-1.5" htmlFor={inputId}>
      {label && <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>}
      <input
        id={inputId}
        className={`rounded-lg border bg-[var(--color-surface-raised)] px-3.5 py-2.5 text-[15px] text-[var(--color-text)] outline-none transition-colors duration-150 placeholder:text-[var(--color-text-muted)] ${
          error
            ? "border-[var(--color-danger)]"
            : "border-[var(--color-border-strong)] focus:border-[var(--color-accent)]"
        } ${className}`}
        {...props}
      />
      {error && <span className="text-sm text-[var(--color-danger)]">{error}</span>}
    </label>
  );
}
