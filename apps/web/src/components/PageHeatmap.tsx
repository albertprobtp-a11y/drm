import type { PageHeatEntry } from "@secureview/shared";
import { EmptyState } from "./ui/EmptyState";

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function PageHeatmap({ pageHeat }: { pageHeat: PageHeatEntry[] }) {
  if (pageHeat.length === 0) {
    return <EmptyState title="Pas encore de lecture" description="La répartition du temps de lecture par page apparaîtra ici après la première ouverture." />;
  }

  const max = Math.max(1, ...pageHeat.map((entry) => entry.totalDurationMs));

  return (
    <div className="flex flex-col gap-2">
      {pageHeat.map((entry) => (
        <div key={entry.pageNumber} className="flex items-center gap-3">
          <span className="w-16 shrink-0 text-sm text-[var(--color-text-muted)]">Page {entry.pageNumber}</span>
          <div className="h-6 flex-1 overflow-hidden rounded-md bg-[var(--color-surface-raised)]">
            <div
              className="h-full rounded-md bg-[var(--color-accent)] transition-all duration-200"
              style={{ width: `${Math.max((entry.totalDurationMs / max) * 100, 3)}%` }}
            />
          </div>
          <span className="w-24 shrink-0 text-right text-sm text-[var(--color-text-secondary)]">
            {formatDuration(entry.totalDurationMs)}
          </span>
        </div>
      ))}
    </div>
  );
}
