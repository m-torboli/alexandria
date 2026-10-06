// Logica pura dell'albero delle sezioni: costruzione, visita e spostamenti.

import type { Section } from "./api";

export interface TreeRow {
  section: Section;
  depth: number;
  hasChildren: boolean;
}

export type DropZone = "before" | "inside" | "after";

export interface DropTarget {
  parentId: number | null;
  index: number;
}

export function childrenOf(sections: readonly Section[], parentId: number | null): Section[] {
  return sections
    .filter((s) => s.parentId === parentId)
    .sort((a, b) => a.position - b.position || a.id - b.id);
}

/** Righe visibili dell'albero, in ordine, rispettando le sezioni espanse. */
export function visibleRows(
  sections: readonly Section[],
  isExpanded: (id: number) => boolean,
): TreeRow[] {
  const rows: TreeRow[] = [];
  const visit = (parentId: number | null, depth: number) => {
    for (const section of childrenOf(sections, parentId)) {
      const hasChildren = sections.some((s) => s.parentId === section.id);
      rows.push({ section, depth, hasChildren });
      if (hasChildren && isExpanded(section.id)) visit(section.id, depth + 1);
    }
  };
  visit(null, 0);
  return rows;
}

/** Id della sezione e di tutte le sue discendenti. */
export function subtreeIds(sections: readonly Section[], rootId: number): Set<number> {
  const ids = new Set([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const s of sections) {
      if (s.parentId !== null && ids.has(s.parentId) && !ids.has(s.id)) {
        ids.add(s.id);
        grew = true;
      }
    }
  }
  return ids;
}

/** Catena dei genitori, dal più vicino alla radice. */
export function ancestorIds(sections: readonly Section[], id: number): number[] {
  const byId = new Map(sections.map((s) => [s.id, s]));
  const chain: number[] = [];
  let current = byId.get(id)?.parentId ?? null;
  while (current !== null && !chain.includes(current)) {
    chain.push(current);
    current = byId.get(current)?.parentId ?? null;
  }
  return chain;
}

/** Zona di rilascio in base alla posizione verticale del puntatore sulla riga. */
export function dropZoneAt(pointerY: number, rowTop: number, rowHeight: number): DropZone {
  const ratio = (pointerY - rowTop) / rowHeight;
  if (ratio < 0.25) return "before";
  if (ratio > 0.75) return "after";
  return "inside";
}

/**
 * Dove finisce la sezione `draggedId` rilasciata su `targetId` nella zona
 * indicata (`targetId` null = primo livello, in fondo). Restituisce null se
 * lo spostamento non è valido o non cambierebbe nulla.
 */
export function resolveDrop(
  sections: readonly Section[],
  draggedId: number,
  targetId: number | null,
  zone: DropZone,
): DropTarget | null {
  const dragged = sections.find((s) => s.id === draggedId);
  if (!dragged) return null;

  const siblingsWithout = (parentId: number | null) =>
    childrenOf(sections, parentId).filter((s) => s.id !== draggedId);

  let result: DropTarget;
  if (targetId === null) {
    result = { parentId: null, index: siblingsWithout(null).length };
  } else {
    if (subtreeIds(sections, draggedId).has(targetId)) return null;
    const target = sections.find((s) => s.id === targetId);
    if (!target) return null;

    if (zone === "inside") {
      result = { parentId: target.id, index: siblingsWithout(target.id).length };
    } else {
      const siblings = siblingsWithout(target.parentId);
      const at = siblings.findIndex((s) => s.id === target.id);
      result = { parentId: target.parentId, index: zone === "before" ? at : at + 1 };
    }
  }

  const unchanged =
    result.parentId === dragged.parentId &&
    childrenOf(sections, dragged.parentId).findIndex((s) => s.id === draggedId) === result.index;
  return unchanged ? null : result;
}
