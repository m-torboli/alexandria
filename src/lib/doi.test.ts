import { describe, expect, it } from "vitest";

import { cleanDoi, findDoi, plausibleTitle } from "./doi";

describe("cleanDoi", () => {
  it("toglie la punteggiatura finale ma non le parentesi del DOI", () => {
    expect(cleanDoi("10.1000/abc.")).toBe("10.1000/abc");
    expect(cleanDoi("10.1000/abc).")).toBe("10.1000/abc");
    expect(cleanDoi("10.1016/S0140-6736(21)00001-1")).toBe("10.1016/S0140-6736(21)00001-1");
    expect(cleanDoi("10.1002/(SICI)1097(199601))")).toBe("10.1002/(SICI)1097(199601)");
  });
});

describe("findDoi", () => {
  it("trova il DOI nella prima pagina", () => {
    const page = "Nature 521, 436–444 (2015) https://doi.org/10.1038/nature14539 Received 25 February";
    expect(findDoi(["", page])).toBe("10.1038/nature14539");
  });

  it("preferisce il DOI etichettato a quelli citati", () => {
    const page = "see 10.1000/citato for details. DOI: 10.1000/questo-articolo";
    expect(findDoi([page])).toBe("10.1000/questo-articolo");
  });

  it("rispetta l'ordine di affidabilità delle fonti", () => {
    expect(findDoi(['{"Subject":"doi:10.5555/dai-metadati"}', "doi: 10.5555/dalla-pagina"])).toBe(
      "10.5555/dai-metadati",
    );
  });

  it("usa arXiv quando manca un DOI", () => {
    expect(findDoi(["arXiv:1706.03762v5 [cs.CL] 6 Dec 2017"])).toBe("10.48550/arXiv.1706.03762");
  });

  it("restituisce null se non trova nulla", () => {
    expect(findDoi(["testo senza identificativi", ""])).toBeNull();
  });
});

describe("plausibleTitle", () => {
  it("accetta titoli veri", () => {
    expect(plausibleTitle("  Deep learning for   cardiology ")).toBe("Deep learning for cardiology");
  });

  it("scarta titoli di servizio", () => {
    expect(plausibleTitle("Microsoft Word - bozza finale")).toBeNull();
    expect(plausibleTitle("paper_final_v3.docx")).toBeNull();
    expect(plausibleTitle("S0140673621000011")).toBeNull();
    expect(plausibleTitle("Untitled document")).toBeNull();
    expect(plausibleTitle(null)).toBeNull();
  });
});
