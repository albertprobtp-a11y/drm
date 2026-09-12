import { useCallback, useEffect, useRef, useState } from "react";
import type { VerifyOtpResponse } from "@secureview/shared";
import { apiFetch } from "../../lib/api";
import { usePageLoader } from "../../hooks/usePageLoader";
import { useRevocationSocket } from "../../hooks/useRevocationSocket";
import { Spinner } from "../../components/ui/Spinner";

const ZOOM_STEPS = [0.75, 1, 1.25, 1.5, 2];

interface ViewerReaderProps {
  session: VerifyOtpResponse;
  onCut: (reason: string) => void;
}

export function ViewerReader({ session, onCut }: ViewerReaderProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomIndex, setZoomIndex] = useState(1);
  const [thumbnailsOpen, setThumbnailsOpen] = useState(false);
  const [privacyBlur, setPrivacyBlur] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageStartRef = useRef<number>(Date.now());
  const blurLoggedRef = useRef(false);

  const { loadPage, prefetch, getCached } = usePageLoader({
    sessionToken: session.sessionToken,
    pageCount: session.pageCount,
  });

  useRevocationSocket(session.sessionToken, onCut);

  const reportPageView = useCallback(
    (pageNumber: number, durationMs: number) => {
      if (durationMs < 300) return;
      void apiFetch("/viewer/page-views", {
        method: "POST",
        sessionToken: session.sessionToken,
        body: { pageNumber, durationMs },
      }).catch(() => undefined);
    },
    [session.sessionToken],
  );

  // Chargement + dessin de la page courante, préchargement des suivantes.
  useEffect(() => {
    let cancelled = false;
    setLoadError(null);

    async function render() {
      const cached = getCached(currentPage);
      const bitmap = cached ?? (await loadPage(currentPage).catch(() => null));
      if (cancelled || !bitmap) {
        if (!cancelled && !bitmap) setLoadError("Impossible de charger cette page.");
        return;
      }
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(bitmap, 0, 0);
    }

    void render();
    prefetch(currentPage);

    return () => {
      cancelled = true;
    };
  }, [currentPage, loadPage, prefetch, getCached]);

  // Suivi du temps passé par page.
  useEffect(() => {
    pageStartRef.current = Date.now();
    return () => {
      reportPageView(currentPage, Date.now() - pageStartRef.current);
    };
  }, [currentPage, reportPageView]);

  // Floutage immédiat si l'onglet perd le focus ou passe en arrière-plan.
  useEffect(() => {
    function logBlur() {
      if (blurLoggedRef.current) return;
      blurLoggedRef.current = true;
      void apiFetch("/viewer/events", {
        method: "POST",
        sessionToken: session.sessionToken,
        body: { type: "BLURRED" },
      }).catch(() => undefined);
    }

    function handleVisibility() {
      if (document.hidden) {
        setPrivacyBlur(true);
        logBlur();
      } else {
        setPrivacyBlur(false);
        blurLoggedRef.current = false;
      }
    }
    function handleBlur() {
      setPrivacyBlur(true);
      logBlur();
    }
    function handleFocus() {
      setPrivacyBlur(false);
      blurLoggedRef.current = false;
    }

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, [session.sessionToken]);

  // Tentative d'impression : journalisée, la CSS masque déjà le contenu.
  useEffect(() => {
    function handleBeforePrint() {
      void apiFetch("/viewer/events", {
        method: "POST",
        sessionToken: session.sessionToken,
        body: { type: "PRINT_ATTEMPT" },
      }).catch(() => undefined);
    }
    window.addEventListener("beforeprint", handleBeforePrint);
    return () => window.removeEventListener("beforeprint", handleBeforePrint);
  }, [session.sessionToken]);

  // Navigation clavier.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        setCurrentPage((p) => Math.min(session.pageCount, p + 1));
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        setCurrentPage((p) => Math.max(1, p - 1));
      } else if (event.key === "+" || event.key === "=") {
        setZoomIndex((z) => Math.min(ZOOM_STEPS.length - 1, z + 1));
      } else if (event.key === "-") {
        setZoomIndex((z) => Math.max(0, z - 1));
      } else if (event.key === "Escape") {
        setThumbnailsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [session.pageCount]);

  const zoom = ZOOM_STEPS[zoomIndex] ?? 1;

  return (
    <div
      ref={containerRef}
      className="sv-viewer-noselect flex h-screen flex-col bg-[var(--color-bg)]"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="sv-print-warning fixed inset-0 z-50 hidden items-center justify-center bg-white p-8 text-center text-black">
        <div>
          <p className="text-lg font-semibold">Impression non autorisée</p>
          <p className="mt-2 text-sm">Ce document ne peut pas être imprimé depuis SecureView.</p>
        </div>
      </div>

      <header className="sv-block-print flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setThumbnailsOpen((v) => !v)}
            className="rounded-md p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)] lg:hidden"
            aria-label="Miniatures"
          >
            ☰
          </button>
          <span className="hidden text-sm font-medium text-[var(--color-text)] sm:inline">
            {session.documentTitle}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
          <button
            onClick={() => setZoomIndex((z) => Math.max(0, z - 1))}
            className="rounded-md px-2 py-1 hover:bg-[var(--color-surface-raised)]"
            aria-label="Zoom arrière"
          >
            −
          </button>
          <span className="w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoomIndex((z) => Math.min(ZOOM_STEPS.length - 1, z + 1))}
            className="rounded-md px-2 py-1 hover:bg-[var(--color-surface-raised)]"
            aria-label="Zoom avant"
          >
            +
          </button>
          <span className="mx-1 h-4 w-px bg-[var(--color-border-strong)]" />
          <span className="tabular-nums">
            {currentPage} / {session.pageCount}
          </span>
        </div>
      </header>

      <div className="sv-block-print flex flex-1 overflow-hidden">
        <aside
          className={`${
            thumbnailsOpen ? "absolute inset-y-0 left-0 z-20 w-48" : "hidden"
          } overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-surface)] py-3 lg:static lg:block lg:w-40`}
        >
          {Array.from({ length: session.pageCount }, (_, i) => i + 1).map((pageNumber) => (
            <button
              key={pageNumber}
              onClick={() => {
                setCurrentPage(pageNumber);
                setThumbnailsOpen(false);
              }}
              className={`mx-2 mb-2 flex aspect-[210/297] w-[calc(100%-1rem)] items-center justify-center rounded-md border text-xs transition-colors duration-150 ${
                pageNumber === currentPage
                  ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                  : "border-[var(--color-border-strong)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]"
              }`}
            >
              {pageNumber}
            </button>
          ))}
        </aside>

        <div className="relative flex flex-1 items-center justify-center overflow-auto p-4">
          {loadError ? (
            <p className="text-sm text-[var(--color-danger)]">{loadError}</p>
          ) : (
            <canvas
              ref={canvasRef}
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              className={`max-w-full rounded-sm shadow-2xl transition-[filter] duration-150 ${
                privacyBlur ? "blur-2xl" : ""
              }`}
              style={{ width: `${zoom * 100}%` }}
            />
          )}
          {!getCached(currentPage) && !loadError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner size={28} />
            </div>
          )}
        </div>
      </div>

      <footer className="sv-block-print flex shrink-0 items-center justify-center border-t border-[var(--color-border)] px-4 py-2 text-center text-xs text-[var(--color-text-muted)]">
        Document confidentiel — consultation tracée au nom de {session.recipientEmail}
      </footer>
    </div>
  );
}
