import { describe, expect, it } from "vitest";

import type { Section } from "./api";
import { ancestorIds, dropZoneAt, resolveDrop, subtreeIds, visibleRows } from "./sectionTree";

const s = (id: number, parentId: number | null, position: number, name = `S${id}`): Section => ({
  id,
  parentId,
  name,
  position,
  articleCount: 0,
});

// 1 Medicina
// ├─ 2 Cardiologia
// │  └─ 4 Aritmie
// └─ 3 Neurologia
// 5 Statistica
const tree = [s(1, null, 0), s(2, 1, 0), s(3, 1, 1), s(4, 2, 0), s(5, null, 1)];

describe("visibleRows", () => {
  it("mostra solo i figli delle sezioni espanse", () => {
    const rows = visibleRows(tree, (id) => id === 1);
    expect(rows.map((r) => [r.section.id, r.depth, r.hasChildren])).toEqual([
      [1, 0, true],
      [2, 1, true],
      [3, 1, false],
      [5, 0, false],
    ]);
  });
});

describe("subtreeIds / ancestorIds", () => {
  it("trova discendenti e antenati", () => {
    expect([...subtreeIds(tree, 1)].sort()).toEqual([1, 2, 3, 4]);
    expect(ancestorIds(tree, 4)).toEqual([2, 1]);
    expect(ancestorIds(tree, 5)).toEqual([]);
  });
});

describe("dropZoneAt", () => {
  it("divide la riga in tre fasce", () => {
    expect(dropZoneAt(101, 100, 28)).toBe("before");
    expect(dropZoneAt(114, 100, 28)).toBe("inside");
    expect(dropZoneAt(127, 100, 28)).toBe("after");
  });
});

describe("resolveDrop", () => {
  it("annida dentro una sezione, in fondo", () => {
    expect(resolveDrop(tree, 5, 1, "inside")).toEqual({ parentId: 1, index: 2 });
  });

  it("riordina tra sorelle senza contare la sezione trascinata", () => {
    expect(resolveDrop(tree, 3, 2, "before")).toEqual({ parentId: 1, index: 0 });
    expect(resolveDrop(tree, 1, 5, "after")).toEqual({ parentId: null, index: 1 });
  });

  it("porta al primo livello quando il bersaglio è la radice", () => {
    expect(resolveDrop(tree, 4, null, "inside")).toEqual({ parentId: null, index: 2 });
  });

  it("rifiuta di spostare una sezione dentro sé stessa o una discendente", () => {
    expect(resolveDrop(tree, 1, 1, "inside")).toBeNull();
    expect(resolveDrop(tree, 1, 4, "after")).toBeNull();
  });

  it("ignora gli spostamenti che non cambiano nulla", () => {
    expect(resolveDrop(tree, 2, 3, "before")).toBeNull();
    expect(resolveDrop(tree, 4, 2, "inside")).toBeNull();
  });
});
