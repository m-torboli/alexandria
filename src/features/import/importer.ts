// Flusso di importazione di un PDF:
// copia nella libreria → lettura del testo → ricerca del DOI → metadati online.
// Ogni passo dopo la copia è facoltativo: se fallisce, l'articolo resta
// comunque nella libreria e i dati si possono completare a mano.

import { open } from "@tauri-apps/plugin-dialog";

import { api } from "../../lib/api";
import { findDoi, plausibleTitle } from "../../lib/doi";
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

  const { doi, problem } = await extractText(articleId);

  if (!doi) {
    const note = problem
      ? `PDF non leggibile (${problem}): completa i dati a mano`
      : "DOI non trovato: completa i dati a mano";
    update(job, { stage: "done", note });
  } else {
    update(job, { stage: "metadata" });
    try {
      await api.lookupDoi(articleId, doi);
      update(job, { stage: "done", note: problem ? `Testo non salvato: ${problem}` : undefined });
    } catch (error) {
      update(job, { stage: "done", note: `DOI ${doi} trovato, ma dati non recuperati: ${messageOf(error)}` });
    }
  }
  await refreshArticles();
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

interface Extraction {
  doi: string | null;
  /** Perché la lettura non è riuscita del tutto, da mostrare all'utente. */
  problem?: string;
}

/**
 * Estrae testo e titolo dal PDF e cerca il DOI. Un errore non interrompe
 * l'importazione (l'articolo resta, senza testo), ma viene segnalato invece
 * di essere ignorato: senza un messaggio i problemi sono impossibili da capire.
 */
async function extractText(articleId: number): Promise<Extraction> {
  let pdf;
  try {
    // PDF.js è pesante: si carica alla prima importazione, non all'avvio.
    const { readPdf } = await import("../../lib/pdf");
    pdf = await readPdf(await api.readArticlePdf(articleId));
  } catch (error) {
    console.error("Lettura del PDF non riuscita", error);
    return { doi: null, problem: messageOf(error) };
  }

  const doi = findDoi([pdf.metadataText, ...pdf.pages.slice(0, 2)]);
  try {
    await api.savePdfInfo(articleId, pdf.pages.join("\n\n"), pdf.pageCount, plausibleTitle(pdf.title));
    return { doi };
  } catch (error) {
    // Il DOI trovato resta valido anche se il salvataggio del testo non è riuscito.
    console.error("Salvataggio del testo non riuscito", error);
    return { doi, problem: messageOf(error) };
  }
}
