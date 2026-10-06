// Estrazione di testo e metadati interni dai PDF importati.

import { loadPdf } from "./pdfjs";

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
  const task = loadPdf(data, { disableFontFace: true });
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
