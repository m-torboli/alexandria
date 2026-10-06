import { describe, expect, it } from "vitest";

import { highlight, parseSnippet, searchTerms, snippetText } from "./highlight";

const marked = (text: string, query: string) =>
  highlight(text, searchTerms(query))
    .filter((s) => s.match)
    .map((s) => s.text);

describe("searchTerms", () => {
  it("estrae le parole, senza accenti e senza doppioni", () => {
    expect(searchTerms('Perché "heart failure" perche')).toEqual(["perche", "heart", "failure"]);
    expect(searchTerms("  ,; ")).toEqual([]);
  });
});

describe("highlight", () => {
  it("evidenzia i prefissi a inizio parola, ignorando accenti e maiuscole", () => {
    expect(marked("Cardiologia e cardiovascolare", "cardio")).toEqual(["Cardio", "cardio"]);
    expect(marked("Perché funziona", "perche")).toEqual(["Perché"]);
  });

  it("non evidenzia a metà parola", () => {
    expect(marked("Pericardio", "cardio")).toEqual([]);
  });

  it("ricompone il testo senza perdere caratteri", () => {
    const text = "Deep learning — LeCun, 2015";
    expect(
      highlight(text, searchTerms("lecun 2015"))
        .map((s) => s.text)
        .join(""),
    ).toBe(text);
  });

  it("senza termini restituisce il testo intero", () => {
    expect(highlight("abc", [])).toEqual([{ text: "abc", match: false }]);
  });
});

describe("snippet", () => {
  it("interpreta i marcatori del motore", () => {
    const s = "…patients with \u0002heart\u0003 \u0002failure\u0003 were…";
    expect(parseSnippet(s)).toEqual([
      { text: "…patients with ", match: false },
      { text: "heart", match: true },
      { text: " ", match: false },
      { text: "failure", match: true },
      { text: " were…", match: false },
    ]);
    expect(snippetText(s)).toBe("patients with heart failure were");
  });
});
