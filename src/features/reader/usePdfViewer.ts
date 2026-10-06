// Collega il visualizzatore di PDF.js a un contenitore React.
// L'ordine degli import conta: lib/pdfjs registra la libreria che pdf_viewer usa.
import { loadPdf } from "../../lib/pdfjs";
import {
  EventBus,
  PDFFindController,
  PDFLinkService,
  PDFViewer,
} from "pdfjs-dist/legacy/web/pdf_viewer.mjs";
import "pdfjs-dist/legacy/web/pdf_viewer.css";

import { openUrl } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import { api } from "../../lib/api";

export interface ViewerState {
  status: "loading" | "ready" | "error";
  error?: string;
  page: number;
  pages: number;
  /** Ingrandimento corrente (1 = 100%). */
  scale: number;
  find: { total: number; current: number };
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 5;

// L'ultima pagina letta di ogni articolo, per riprendere da lì.
const PAGES_KEY = "alexandria.lastPages";
function lastPages(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(PAGES_KEY) ?? "{}");
  } catch {
    return {};
  }
}
function rememberPage(id: number, page: number) {
  try {
    localStorage.setItem(PAGES_KEY, JSON.stringify({ ...lastPages(), [id]: page }));
  } catch {
    /* ignorato */
  }
}

export function usePdfViewer(articleId: number, containerRef: RefObject<HTMLDivElement | null>) {
  const viewerRef = useRef<PDFViewer | null>(null);
  const busRef = useRef<EventBus | null>(null);
  const [state, setState] = useState<ViewerState>({
    status: "loading",
    page: 1,
    pages: 0,
    scale: 1,
    find: { total: 0, current: 0 },
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const eventBus = new EventBus();
    const linkService = new PDFLinkService({ eventBus });
    const findController = new PDFFindController({ eventBus, linkService });
    const viewer = new PDFViewer({ container, eventBus, linkService, findController });
    linkService.setViewer(viewer);
    viewerRef.current = viewer;
    busRef.current = eventBus;

    eventBus.on("pagesinit", () => {
      // "auto": larghezza della finestra, ma senza ingrandire troppo su schermi ampi.
      viewer.currentScaleValue = "auto";
      const saved = lastPages()[articleId];
      if (saved > 1) viewer.currentPageNumber = Math.min(saved, viewer.pagesCount);
      setState((s) => ({ ...s, status: "ready", pages: viewer.pagesCount, page: viewer.currentPageNumber }));
    });
    eventBus.on("pagechanging", ({ pageNumber }: { pageNumber: number }) => {
      setState((s) => ({ ...s, page: pageNumber }));
      rememberPage(articleId, pageNumber);
    });
    eventBus.on("scalechanging", ({ scale }: { scale: number }) => setState((s) => ({ ...s, scale })));
    eventBus.on(
      "updatefindmatchescount",
      ({ matchesCount }: { matchesCount: { current: number; total: number } }) =>
        setState((s) => ({ ...s, find: matchesCount })),
    );
    eventBus.on(
      "updatefindcontrolstate",
      ({ matchesCount }: { matchesCount?: { current: number; total: number } }) =>
        matchesCount && setState((s) => ({ ...s, find: matchesCount })),
    );

    // I link esterni del PDF si aprono nel browser, non dentro l'app.
    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
      if (link && /^(https?|mailto):/i.test(link.href)) {
        e.preventDefault();
        openUrl(link.href).catch(() => undefined);
      }
    };
    container.addEventListener("click", onClick, true);

    // Ctrl + rotella (o pizzico sul trackpad) per ingrandire.
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      viewer.updateScale({ steps: e.deltaY < 0 ? 1 : -1 });
    };
    container.addEventListener("wheel", onWheel, { passive: false });

    let cancelled = false;
    let task: ReturnType<typeof loadPdf> | null = null;
    (async () => {
      try {
        const data = await api.readArticlePdf(articleId);
        if (cancelled) return;
        task = loadPdf(data);
        const doc = await task.promise;
        if (cancelled) return;
        viewer.setDocument(doc);
        linkService.setDocument(doc, null);
      } catch (error) {
        if (!cancelled) {
          setState((s) => ({ ...s, status: "error", error: error instanceof Error ? error.message : String(error) }));
        }
      }
    })();

    return () => {
      cancelled = true;
      container.removeEventListener("click", onClick, true);
      container.removeEventListener("wheel", onWheel);
      viewer.setDocument(null as never);
      linkService.setDocument(null);
      task?.destroy();
      viewerRef.current = null;
      busRef.current = null;
    };
  }, [articleId, containerRef]);

  const goToPage = useCallback((page: number) => {
    const viewer = viewerRef.current;
    if (viewer && page >= 1 && page <= viewer.pagesCount) viewer.currentPageNumber = page;
  }, []);

  const zoom = useCallback((direction: 1 | -1) => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const next = viewer.currentScale * (direction > 0 ? 1.15 : 1 / 1.15);
    viewer.currentScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
  }, []);

  const fitWidth = useCallback(() => {
    if (viewerRef.current) viewerRef.current.currentScaleValue = "page-width";
  }, []);

  /** Cerca nel documento; `again` passa alla corrispondenza successiva (o precedente). */
  const find = useCallback((query: string, again?: "next" | "previous") => {
    busRef.current?.dispatch("find", {
      source: null,
      type: again ? "again" : "",
      query,
      caseSensitive: false,
      entireWord: false,
      highlightAll: true,
      findPrevious: again === "previous",
      matchDiacritics: false,
    });
  }, []);

  return { state, goToPage, zoom, fitWidth, find };
}
