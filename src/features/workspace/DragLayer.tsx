// Contesto unico di trascinamento per tutta la finestra: le sezioni si
// riordinano nell'albero e gli articoli passano dall'elenco alle sezioni.
// I singoli componenti reagiscono con useDndMonitor.

import { DndContext, DragOverlay, PointerSensor, pointerWithin, useSensor, useSensors } from "@dnd-kit/core";
import { FileText, Folder } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { plural } from "../../lib/format";
import { dragItem, useDragMode, type DragItem } from "../../store/drag";
import { useUi } from "../../store/ui";
import styles from "./Workspace.module.css";

export function DragLayer({ children }: { children: ReactNode }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [active, setActive] = useState<DragItem | null>(null);
  useCopyModifier(active !== null);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={({ active }) => setActive(dragItem(active.data.current))}
      onDragEnd={() => setActive(null)}
      onDragCancel={() => setActive(null)}
    >
      {children}
      <DragOverlay dropAnimation={null}>{active && <DragPreview item={active} />}</DragOverlay>
    </DndContext>
  );
}

function DragPreview({ item }: { item: DragItem }) {
  const copy = useDragMode((s) => s.copy);
  const fromSection = useUi((s) => s.view.kind === "section");

  if (item.type === "section") {
    return (
      <div className={styles.dragPreview}>
        <Folder size={14} />
        <span className={styles.dragLabel}>{item.label}</span>
      </div>
    );
  }
  const moving = fromSection && !copy;
  return (
    <div className={styles.dragPreview}>
      <FileText size={14} />
      <span className={styles.dragLabel}>
        {item.articleIds.length > 1 ? plural(item.articleIds.length, "articolo", "articoli") : item.label}
      </span>
      <span className={styles.dragMode}>{moving ? "Sposta" : "Aggiungi"}</span>
    </div>
  );
}

/** Segue il tasto Ctrl/⌥ durante il trascinamento. */
function useCopyModifier(dragging: boolean) {
  useEffect(() => {
    const setCopy = useDragMode.getState().setCopy;
    if (!dragging) {
      setCopy(false);
      return;
    }
    const update = (e: KeyboardEvent | PointerEvent) => setCopy(e.ctrlKey || e.altKey);
    window.addEventListener("keydown", update);
    window.addEventListener("keyup", update);
    window.addEventListener("pointermove", update);
    return () => {
      window.removeEventListener("keydown", update);
      window.removeEventListener("keyup", update);
      window.removeEventListener("pointermove", update);
    };
  }, [dragging]);
}
