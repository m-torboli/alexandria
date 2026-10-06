// Citazioni: stile APA (7ª edizione) ed esportazione BibTeX.

import type { Author, Metadata } from "./api";

// ── APA ─────────────────────────────────────────────────────────────────────

/** "Jean-Paul Mario" → "J.-P. M." */
export function initials(given: string): string {
  return given
    .split(/\s+/)
    .filter(Boolean)
    .map((part) =>
      part
        .split("-")
        .filter(Boolean)
        .map((piece) => `${piece[0].toLocaleUpperCase("it")}.`)
        .join("-"),
    )
    .join(" ");
}

const apaAuthor = (a: Author) => (a.given ? `${a.family}, ${initials(a.given)}` : a.family);

/** Elenco degli autori secondo APA 7 (fino a 20, poi i primi 19, "…" e l'ultimo). */
export function apaAuthors(authors: readonly Author[]): string {
  const names = authors.map(apaAuthor);
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]}, & ${names[1]}`;
  if (names.length <= 20) return `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}`;
  return `${names.slice(0, 19).join(", ")}, . . . ${names[names.length - 1]}`;
}

const endWithPeriod = (text: string) => (/[.?!]$/.test(text) ? text : `${text}.`);
const enDash = (pages: string) => pages.replace(/\s*[-–—]+\s*/g, "–");

interface Formatted {
  /** Testo semplice, da incollare ovunque. */
  text: string;
  /** Versione con il corsivo, per gli editor di testo. */
  html: string;
}

export function apa(m: Metadata): Formatted {
  const authors = apaAuthors(m.authors);
  const year = `(${m.year ?? "n.d."}).`;
  const title = m.title ? endWithPeriod(m.title.trim()) : "";
  const link = m.doi ? `https://doi.org/${m.doi}` : (m.url ?? "");

  // Fonte: Rivista, volume(numero), pagine.  Rivista e volume in corsivo.
  const source = (italic: (s: string) => string) => {
    if (!m.journal) return "";
    let s = italic(m.journal);
    if (m.volume) s += `, ${italic(m.volume)}${m.issue ? `(${m.issue})` : ""}`;
    if (m.pages) s += `, ${enDash(m.pages)}`;
    return `${s}.`;
  };

  const build = (italic: (s: string) => string, escape: (s: string) => string) => {
    // Senza autori, il titolo prende il loro posto.
    const head = authors
      ? `${escape(endWithPeriod(authors))} ${year} ${escape(title)}`
      : `${escape(title)} ${year}`;
    return [head, source(italic), escape(link)].filter(Boolean).join(" ").replace(/\.\./g, ".").trim();
  };

  return {
    text: build((s) => s, (s) => s),
    html: build((s) => `<i>${escapeHtml(s)}</i>`, escapeHtml),
  };
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

// ── BibTeX ──────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set(["a", "an", "the", "il", "lo", "la", "i", "gli", "le", "un", "una", "uno", "of", "on", "in"]);

const asciiWord = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** Chiave di citazione: cognome + anno + prima parola significativa ("lecun2015deep"). */
export function citationKey(m: Metadata): string {
  const family = asciiWord(m.authors[0]?.family ?? "") || "anonimo";
  const word = (m.title.match(/[\p{L}\p{N}]+/gu) ?? []).map(asciiWord).find((w) => w && !STOP_WORDS.has(w)) ?? "";
  return `${family}${m.year ?? ""}${word}`;
}

/** Caratteri speciali di LaTeX nei valori dei campi. */
const escapeTex = (text: string) => text.replace(/([&%$#_{}])/g, "\\$1").replace(/~/g, "\\textasciitilde{}");

export function bibtexEntry(m: Metadata, key = citationKey(m)): string {
  const fields: [string, string | null | undefined][] = [
    // Doppie graffe: BibTeX non deve cambiare le maiuscole del titolo.
    ["title", m.title ? `{${escapeTex(m.title)}}` : null],
    // Un ente ("WHO") va tra graffe, altrimenti BibTeX lo legge come un cognome.
    ["author", m.authors.map((a) => (a.given ? escapeTex(`${a.family}, ${a.given}`) : `{${escapeTex(a.family)}}`)).join(" and ")],
    ["journal", m.journal && escapeTex(m.journal)],
    ["year", m.year?.toString()],
    ["volume", m.volume && escapeTex(m.volume)],
    ["number", m.issue && escapeTex(m.issue)],
    ["pages", m.pages && enDash(m.pages).replace(/–/g, "--")],
    ["publisher", m.journal ? null : m.publisher && escapeTex(m.publisher)],
    ["doi", m.doi],
    ["url", m.doi ? null : m.url],
  ];
  const body = fields
    .filter(([, value]) => value)
    .map(([name, value]) => `  ${name} = {${value}},`)
    .join("\n");
  return `@${m.journal ? "article" : "misc"}{${key},\n${body}\n}`;
}

/** Bibliografia completa, con chiavi rese uniche (lecun2015deep, lecun2015deepb…). */
export function bibtex(items: readonly Metadata[]): string {
  const used = new Map<string, number>();
  return (
    items
      .map((m) => {
        const base = citationKey(m);
        const n = used.get(base) ?? 0;
        used.set(base, n + 1);
        return bibtexEntry(m, n === 0 ? base : `${base}${String.fromCharCode(97 + n)}`);
      })
      .join("\n\n") + "\n"
  );
}
