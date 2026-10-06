import { describe, expect, it } from "vitest";

import type { Metadata } from "./api";
import { apa, apaAuthors, bibtex, bibtexEntry, citationKey, initials } from "./citation";

const lecun: Metadata = {
  title: "Deep learning",
  authors: [
    { family: "LeCun", given: "Yann" },
    { family: "Bengio", given: "Yoshua" },
    { family: "Hinton", given: "Geoffrey" },
  ],
  year: 2015,
  journal: "Nature",
  volume: "521",
  issue: "7553",
  pages: "436-444",
  publisher: "Springer",
  doi: "10.1038/nature14539",
  url: null,
  abstract: null,
};

describe("APA", () => {
  it("abbrevia i nomi propri", () => {
    expect(initials("Jean-Paul Mario")).toBe("J.-P. M.");
    expect(initials("Fernando P.")).toBe("F. P.");
  });

  it("elenca gli autori secondo le regole APA 7", () => {
    const a = (n: number) => Array.from({ length: n }, (_, i) => ({ family: `A${i + 1}`, given: "" }));
    expect(apaAuthors(a(1))).toBe("A1");
    expect(apaAuthors(a(2))).toBe("A1, & A2");
    expect(apaAuthors(a(3))).toBe("A1, A2, & A3");
    expect(apaAuthors(a(25))).toBe(`${a(19).map((x) => x.family).join(", ")}, . . . A25`);
  });

  it("formatta un articolo di rivista", () => {
    const { text, html } = apa(lecun);
    expect(text).toBe(
      "LeCun, Y., Bengio, Y., & Hinton, G. (2015). Deep learning. Nature, 521(7553), 436–444. https://doi.org/10.1038/nature14539",
    );
    expect(html).toContain("<i>Nature</i>, <i>521</i>(7553)");
  });

  it("gestisce dati mancanti", () => {
    const text = apa({ ...lecun, authors: [], year: null, journal: null, doi: null, url: "https://x.org" }).text;
    expect(text).toBe("Deep learning. (n.d.). https://x.org");
  });
});

describe("BibTeX", () => {
  it("costruisce la chiave da cognome, anno e prima parola utile", () => {
    expect(citationKey(lecun)).toBe("lecun2015deep");
    expect(citationKey({ ...lecun, title: "The Perché of things", authors: [{ family: "Pérez", given: "" }] })).toBe(
      "perez2015perche",
    );
  });

  it("scrive una voce completa con caratteri speciali protetti", () => {
    const entry = bibtexEntry({ ...lecun, title: "Costs & benefits: 50% of R_0" });
    expect(entry).toBe(
      [
        "@article{lecun2015costs,",
        "  title = {{Costs \\& benefits: 50\\% of R\\_0}},",
        "  author = {LeCun, Yann and Bengio, Yoshua and Hinton, Geoffrey},",
        "  journal = {Nature},",
        "  year = {2015},",
        "  volume = {521},",
        "  number = {7553},",
        "  pages = {436--444},",
        "  doi = {10.1038/nature14539},",
        "}",
      ].join("\n"),
    );
  });

  it("rende uniche le chiavi ripetute", () => {
    const out = bibtex([lecun, lecun]);
    expect(out).toContain("@article{lecun2015deep,");
    expect(out).toContain("@article{lecun2015deepb,");
  });

  it("usa @misc senza rivista e protegge i nomi di enti", () => {
    const entry = bibtexEntry({ ...lecun, journal: null, authors: [{ family: "WHO", given: "" }] });
    expect(entry.startsWith("@misc{who2015deep,")).toBe(true);
    expect(entry).toContain("author = {{WHO}},");
    expect(entry).toContain("publisher = {Springer},");
  });
});
