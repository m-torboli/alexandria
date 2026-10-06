// Evidenziazione dei termini cercati, con le stesse regole del motore:
// maiuscole e accenti non contano, una parola trova anche quelle che iniziano così.

export interface Segment {
  text: string;
  match: boolean;
}

/** Carattere ridotto alla forma di confronto ("É" → "e"), sempre lungo uno. */
function fold(char: string): string {
  const folded = char.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  return folded.length === 1 ? folded : char.toLowerCase();
}

const isWordChar = (char: string) => /[\p{L}\p{N}]/u.test(char);

/** Termini di ricerca dal testo digitato (anche quelli tra virgolette). */
export function searchTerms(query: string): string[] {
  const words = query.match(/[\p{L}\p{N}]+/gu) ?? [];
  return [...new Set(words.map((w) => [...w].map(fold).join("")))];
}

/** Divide il testo in parti, segnando quelle che corrispondono ai termini. */
export function highlight(text: string, terms: readonly string[]): Segment[] {
  if (terms.length === 0 || !text) return [{ text, match: false }];

  const chars = [...text];
  const folded = chars.map(fold);
  const marked = new Array<boolean>(chars.length).fill(false);

  for (let i = 0; i < chars.length; i++) {
    if (!isWordChar(chars[i]) || (i > 0 && isWordChar(chars[i - 1]))) continue; // solo a inizio parola
    for (const term of terms) {
      const termChars = [...term];
      if (termChars.every((c, k) => folded[i + k] === c)) {
        for (let k = 0; k < termChars.length; k++) marked[i + k] = true;
      }
    }
  }

  const segments: Segment[] = [];
  for (let i = 0; i < chars.length; i++) {
    const last = segments[segments.length - 1];
    if (last && last.match === marked[i]) last.text += chars[i];
    else segments.push({ text: chars[i], match: marked[i] });
  }
  return segments;
}

/** Estratto del motore: i termini sono racchiusi tra \u0002 e \u0003. */
export function parseSnippet(snippet: string): Segment[] {
  const segments: Segment[] = [];
  for (const [i, part] of snippet.split(/[\u0002\u0003]/).entries()) {
    if (part) segments.push({ text: part, match: i % 2 === 1 });
  }
  return segments;
}

/** Testo semplice dell'estratto, per confrontarlo con titolo e autori. */
export const snippetText = (snippet: string) =>
  snippet.replace(/[\u0002\u0003]/g, "").replace(/…/g, "").trim();
