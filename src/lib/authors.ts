import type { Author } from "./api";

/** "Rossi", "Rossi e Bianchi", "Rossi et al.". */
export function shortAuthors(authors: readonly Author[]): string {
  switch (authors.length) {
    case 0:
      return "";
    case 1:
      return authors[0].family;
    case 2:
      return `${authors[0].family} e ${authors[1].family}`;
    default:
      return `${authors[0].family} et al.`;
  }
}

/** Forma modificabile: "Rossi, Mario; Bianchi, Luca". */
export function formatAuthors(authors: readonly Author[]): string {
  return authors.map((a) => (a.given ? `${a.family}, ${a.given}` : a.family)).join("; ");
}

/**
 * Interpreta l'elenco scritto a mano. Accetta "Cognome, Nome" oppure
 * "Nome Cognome", separati da punto e virgola o a capo.
 */
export function parseAuthors(text: string): Author[] {
  return text
    .split(/[;\n]/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part && !/^et\.? al\.?$/i.test(part))
    .map((part) => {
      const comma = part.indexOf(",");
      if (comma !== -1) {
        return { family: part.slice(0, comma).trim(), given: part.slice(comma + 1).trim() };
      }
      const words = part.split(" ");
      return { family: words.pop()!, given: words.join(" ") };
    })
    .filter((a) => a.family);
}
