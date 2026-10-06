import { describe, expect, it } from "vitest";

import { formatAuthors, parseAuthors, shortAuthors } from "./authors";

const rossi = { family: "Rossi", given: "Mario" };
const bianchi = { family: "Bianchi", given: "Luca" };
const who = { family: "WHO", given: "" };

describe("shortAuthors", () => {
  it("abbrevia secondo il numero di autori", () => {
    expect(shortAuthors([])).toBe("");
    expect(shortAuthors([rossi])).toBe("Rossi");
    expect(shortAuthors([rossi, bianchi])).toBe("Rossi e Bianchi");
    expect(shortAuthors([rossi, bianchi, who])).toBe("Rossi et al.");
  });
});

describe("formatAuthors / parseAuthors", () => {
  it("fa andata e ritorno", () => {
    const text = formatAuthors([rossi, bianchi, who]);
    expect(text).toBe("Rossi, Mario; Bianchi, Luca; WHO");
    expect(parseAuthors(text)).toEqual([rossi, bianchi, who]);
  });

  it("accetta anche Nome Cognome, a capo ed et al.", () => {
    expect(parseAuthors("Mario Rossi\n  Luca   Bianchi ; et al.")).toEqual([rossi, bianchi]);
  });

  it("ignora le voci vuote", () => {
    expect(parseAuthors(" ; ;")).toEqual([]);
  });
});
