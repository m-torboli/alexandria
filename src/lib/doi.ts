// Riconoscimento di DOI e titoli plausibili nel testo estratto dai PDF.

const DOI_PATTERN = /\b10\.\d{4,9}\/[^\s"<>]+/gi;
const ARXIV_PATTERN = /\barXiv:\s*(\d{4}\.\d{4,5})(?:v\d+)?/i;
/** Quanti caratteri prima del DOI cercare un'etichetta come "DOI:" o "doi.org/". */
const LABEL_WINDOW = 12;

/** Toglie la punteggiatura del testo circostante (stessa logica del motore). */
export function cleanDoi(raw: string): string {
  let doi = raw.trim();
  for (;;) {
    let next = doi.replace(/[.,;\]}>"']+$/, "");
    const opens = (next.match(/\(/g) ?? []).length;
    const closes = (next.match(/\)/g) ?? []).length;
    if (next.endsWith(")") && closes > opens) next = next.slice(0, -1);
    if (next === doi) return doi;
    doi = next;
  }
}

/**
 * Cerca il DOI dell'articolo nei testi indicati, in ordine di affidabilità
 * (metadati del PDF, prima pagina, seconda pagina…). Nello stesso testo
 * preferisce un DOI preceduto da un'etichetta ("DOI:", "doi.org/").
 * In mancanza di DOI, un identificativo arXiv diventa il DOI corrispondente.
 */
export function findDoi(sources: readonly string[]): string | null {
  for (const text of sources) {
    const matches = [...text.matchAll(DOI_PATTERN)];
    if (matches.length === 0) continue;
    const labelled = matches.find((m) =>
      /doi/i.test(text.slice(Math.max(0, m.index - LABEL_WINDOW), m.index)),
    );
    const doi = cleanDoi((labelled ?? matches[0])[0]);
    if (doi.includes("/") && doi.length > 8) return doi;
  }
  for (const text of sources) {
    const arxiv = text.match(ARXIV_PATTERN);
    if (arxiv) return `10.48550/arXiv.${arxiv[1]}`;
  }
  return null;
}

const JUNK_TITLE = /^(microsoft (word|powerpoint)|untitled|document\d*|manuscript|layout|title|pdf|tmp)\b/i;
const FILE_LIKE = /\.(pdf|docx?|tex|dvi|ps|indd|rtf)$/i;

/** Il titolo interno del PDF è spesso spazzatura ("Microsoft Word - bozza3.docx"). */
export function plausibleTitle(raw: string | null | undefined): string | null {
  const title = raw?.replace(/\s+/g, " ").trim() ?? "";
  if (title.length < 8 || title.length > 300) return null;
  if (JUNK_TITLE.test(title) || FILE_LIKE.test(title)) return null;
  if (!title.includes(" ")) return null; // un nome di file o un codice, non un titolo
  if ((title.match(/\p{L}/gu) ?? []).length < title.length / 2) return null;
  return title;
}
