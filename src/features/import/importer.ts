// Flusso di importazione di un PDF:
// copia nella libreria → lettura del testo → ricerca del DOI → metadati online.
// Ogni passo dopo la copia è facoltativo: se fallisce, l'articolo resta
// comunque nella libreria e i dati si possono completare a mano.

import { open } from "@tauri-apps/plugin-dialog";

import { api } from "../../lib/api";
import { findDoi, plausibleTitle } from "../../lib/doi";
import { readPdf } from "../../lib/pdf";
import { refreshArticles } from "../../lib/queries";
import { useImports } from "../../store/imports";
import { useToasts } from "../../store/toast";

const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;
const isPdf = (path: string) => path.toLowerCase().endsWith(".pdf");

/** Apre la finestra di selezione dei file e importa i PDF scelti. */
export async function pickAndImport(sectionId: number | null) {
  const paths = await open({
    multiple: true,
    title: "Aggiungi articoli",
    filters: [{ name: "Documenti PDF", extensions: ["pdf", "PDF"] }],
  });
  if (paths?.length) await importFiles(paths, sectionId);
}

export async function importFiles(paths: readonly string[], sectionId: number | null) {
  const pdfs = paths.filter(isPdf);
  if (pdfs.length < paths.length) {
    useToasts.getState().show("Alcuni file sono stati ignorati: si possono aggiungere solo PDF.");
  }
  if (pdfs.length === 0) return;

  const jobIds = useImports.getState().enqueue(pdfs.map(fileName));
  for (const [i, path] of pdfs.entries()) {
    await importOne(jobIds[i], path, sectionId);
  }
}

async function importOne(job: number, path: string, sectionId: number | null) {
  const update = useImports.getState().update;

  update(job, { stage: "copying" });
  let articleId: number;
  try {
    const outcome = await api.importPdf(path, sectionId);
    articleId = outcome.articleId;
    if (outcome.status !== "added") {
      const where = outcome.status === "duplicateInTrash" ? "nel Cestino" : "nella libreria";
      update(job, { stage: "duplicate", articleId, note: `Già presente ${where}` });
      await refreshArticles();
      return;
    }
  } catch (error) {
    update(job, { stage: "error", note: error instanceof Error ? error.message : String(error) });
    return;
  }
  update(job, { stage: "reading", articleId });
  await refreshArticles();

  const doi = await extractText(articleId);

  if (!doi) {
    update(job, { stage: "done", note: "DOI non trovato: completa i dati a mano" });
  } else {
    update(job, { stage: "metadata" });
    try {
      await api.lookupDoi(articleId, doi);
      update(job, { stage: "done" });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      update(job, { stage: "done", note: `Dati non recuperati: ${reason}` });
    }
  }
  await refreshArticles();
}

/** Estrae testo e titolo dal PDF; restituisce il DOI se lo trova. */
async function extractText(articleId: number): Promise<string | null> {
  try {
    const pdf = await readPdf(await api.readArticlePdf(articleId));
    const doi = findDoi([pdf.metadataText, ...pdf.pages.slice(0, 2)]);
    await api.savePdfInfo(articleId, pdf.pages.join("\n\n"), pdf.pageCount, plausibleTitle(pdf.title));
    return doi;
  } catch {
    // PDF protetto o danneggiato: si tiene l'articolo, senza testo.
    return null;
  }
}
