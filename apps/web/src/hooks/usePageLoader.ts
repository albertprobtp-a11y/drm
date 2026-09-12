import { useCallback, useRef, useState } from "react";
import type { SignedPageUrl } from "@secureview/shared";
import { apiFetch, assetUrl } from "../lib/api";
import { VIEWER_PREFETCH_PAGES } from "@secureview/shared";

interface UsePageLoaderOptions {
  sessionToken: string;
  pageCount: number;
}

/**
 * Charge les pages filigranées à la demande : récupère une URL signée à
 * usage unique, télécharge les octets, les décode en ImageBitmap, et met en
 * cache le résultat en mémoire pour la session en cours (pas sur disque).
 */
export function usePageLoader({ sessionToken, pageCount }: UsePageLoaderOptions) {
  const cache = useRef(new Map<number, ImageBitmap>());
  const inFlight = useRef(new Map<number, Promise<ImageBitmap>>());
  const [, forceRender] = useState(0);

  const loadPage = useCallback(
    async (pageNumber: number): Promise<ImageBitmap | null> => {
      if (pageNumber < 1 || pageNumber > pageCount) return null;

      const cached = cache.current.get(pageNumber);
      if (cached) return cached;

      const pending = inFlight.current.get(pageNumber);
      if (pending) return pending;

      const promise = (async () => {
        const { url } = await apiFetch<SignedPageUrl>(`/viewer/pages/${pageNumber}`, { sessionToken });
        const response = await fetch(assetUrl(url));
        if (!response.ok) throw new Error("Impossible de charger cette page.");
        const blob = await response.blob();
        const bitmap = await createImageBitmap(blob);
        cache.current.set(pageNumber, bitmap);
        forceRender((n) => n + 1);
        return bitmap;
      })();

      inFlight.current.set(pageNumber, promise);
      try {
        return await promise;
      } finally {
        inFlight.current.delete(pageNumber);
      }
    },
    [sessionToken, pageCount],
  );

  const prefetch = useCallback(
    (fromPage: number) => {
      for (let i = 1; i <= VIEWER_PREFETCH_PAGES; i++) {
        void loadPage(fromPage + i).catch(() => undefined);
      }
    },
    [loadPage],
  );

  const getCached = useCallback((pageNumber: number) => cache.current.get(pageNumber) ?? null, []);

  return { loadPage, prefetch, getCached };
}
