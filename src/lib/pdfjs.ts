// Configurazione unica di PDF.js, condivisa da lettore ed estrazione del testo.
// La build "legacy" funziona anche sulle versioni meno recenti di macOS.
// Questo modulo va importato prima del visualizzatore (pdf_viewer.mjs), che si
// appoggia alla libreria registrata globalmente da pdf.mjs.

import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

/** Risorse copiate in public/pdfjs da scripts/copy-pdfjs-assets.mjs. */
const ASSETS = "/pdfjs/";

type LoadOptions = Omit<Parameters<typeof getDocument>[0] & object, "data">;

export function loadPdf(data: Uint8Array, options: LoadOptions = {}) {
  return getDocument({
    data,
    cMapUrl: `${ASSETS}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${ASSETS}standard_fonts/`,
    wasmUrl: `${ASSETS}wasm/`,
    iccUrl: `${ASSETS}iccs/`,
    verbosity: 0,
    ...options,
  });
}
