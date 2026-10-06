// Lettura dei PDF con PDF.js: testo delle pagine e metadati interni.
// La build "legacy" funziona anche sulle versioni meno recenti di macOS.

import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

/** Oltre questa soglia (libri, tesi) il testo serve poco alla ricerca e costa molto. */
const MAX_PAGES = 400;

export interface PdfContent {
  /** Testo di ciascuna pagina. */
  pages: string[];
  pageCount: number;
  /** Titolo dichiarato nei metadati del PDF (spesso inaffidabile). */
  title: string | null;
  /** Metadati interni serializzati, utili per cercarvi un DOI. */
  metadataText: string;
}

export async function readPdf(data: Uint8Array): Promise<PdfContent> {
  const task = getDocument({ data, disableFontFace: true, verbosity: 0 });
  try {
    const doc = await task.promise;
    const meta = await doc.getMetadata().catch(() => null);
    const info = (meta?.info ?? {}) as Record<string, unknown>;
    const xmp: unknown = meta?.metadata?.getRaw() ?? "";

    const pages: string[] = [];
    for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : ""))
          .join("")
          .replace(/[ \t]+/g, " "),
      );
      page.cleanup();
    }

    return {
      pages,
      pageCount: doc.numPages,
      title: typeof info.Title === "string" ? info.Title : null,
      metadataText: JSON.stringify([info, xmp]),
    };
  } finally {
    await task.destroy();
  }
}
