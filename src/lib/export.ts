// Copia delle citazioni e esportazione delle bibliografie.

import { save } from "@tauri-apps/plugin-dialog";

import { showError, useToasts } from "../store/toast";
import type { View } from "../store/ui";
import { api, metadataOf, type Metadata } from "./api";
import { apa, bibtex } from "./citation";
import { plural } from "./format";

const toast = (message: string) => useToasts.getState().show(message);

/** Copia negli appunti sia il testo semplice sia la versione con il corsivo. */
async function copy(text: string, html?: string) {
  try {
    if (html && typeof ClipboardItem !== "undefined") {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([text], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
    } else {
      await navigator.clipboard.writeText(text);
    }
    return true;
  } catch (error) {
    showError(error);
    return false;
  }
}

export async function copyApa(m: Metadata) {
  const { text, html } = apa(m);
  if (await copy(text, html)) toast("Citazione APA copiata.");
}

export async function copyBibtex(m: Metadata) {
  if (await copy(bibtex([m]))) toast("Voce BibTeX copiata.");
}

/** Chiede dove salvare e scrive il file .bib. */
export async function exportBibtex(items: Metadata[], suggestedName: string) {
  if (items.length === 0) {
    toast("Non ci sono articoli da esportare.");
    return;
  }
  try {
    const name = suggestedName.replace(/[<>:"/\\|?*]/g, "").trim() || "Bibliografia";
    const path = await save({
      title: "Esporta bibliografia BibTeX",
      defaultPath: `${name}.bib`,
      filters: [{ name: "BibTeX", extensions: ["bib"] }],
    });
    if (!path) return;
    await api.saveBibliography(path, bibtex(items));
    const file = path.split(/[\\/]/).pop();
    toast(`${plural(items.length, "voce esportata", "voci esportate")} in ${file}.`);
  } catch (error) {
    showError(error);
  }
}

/** Esporta tutti gli articoli di una vista (sezione, tag, libreria). */
export async function exportView(view: View, suggestedName: string) {
  try {
    const articles = await api.exportArticles(view);
    await exportBibtex(articles.map(metadataOf), suggestedName);
  } catch (error) {
    showError(error);
  }
}
