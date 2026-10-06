import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragMoveEvent,
} from "@dnd-kit/core";
import { Download, Folder, FolderPlus, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

import { ContextContent, ContextItem, ContextRoot, ContextSeparator, ContextTrigger } from "../../components/Menu";
import { InlineEdit } from "../../components/InlineEdit";
import { api, type Section, type SectionDeletePreview } from "../../lib/api";
import { exportView } from "../../lib/export";
import { keys, useAction, useSections } from "../../lib/queries";
import {
  dropZoneAt,
  resolveDrop,
  subtreeIds,
  visibleRows,
  type DropZone,
  type TreeRow,
} from "../../lib/sectionTree";
import { useImports } from "../../store/imports";
import { showError } from "../../store/toast";
import { useUi } from "../../store/ui";
import { SECTION_DROP_ATTR } from "../import/useFileDrop";
import { DeleteSectionDialog } from "./DeleteSectionDialog";
import { GroupHeader } from "./GroupHeader";
import styles from "./Sidebar.module.css";
import { SidebarRow } from "./SidebarRow";

const ROOT_DROP_ID = "sections-root";
const AUTO_EXPAND_MS = 650;

/** Dove si trova il puntatore durante il trascinamento (id null = radice). */
interface Hover {
  id: number | null;
  zone: DropZone;
}

function hoverFrom({ over, activatorEvent, delta }: Pick<DragMoveEvent, "over" | "activatorEvent" | "delta">): Hover | null {
  if (!over) return null;
  if (over.id === ROOT_DROP_ID) return { id: null, zone: "inside" };
  const pointerY = (activatorEvent as PointerEvent).clientY + delta.y;
  return { id: over.data.current?.sectionId as number, zone: dropZoneAt(pointerY, over.rect.top, over.rect.height) };
}

export function SectionTree() {
  const sections = useSections().data ?? [];
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const expanded = useUi((s) => s.expanded);
  const setExpanded = useUi((s) => s.setExpanded);

  const [renamingId, setRenamingId] = useState<number | null>(null);
  /** undefined = nessuna creazione in corso; null = nuova sezione di primo livello. */
  const [draftParent, setDraftParent] = useState<number | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<{ section: Section; preview: SectionDeletePreview } | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);

  const create = useAction(api.createSection, [keys.sections]);
  const rename = useAction(api.renameSection, [keys.sections]);
  const move = useAction(api.moveSection, [keys.sections]);
  const remove = useAction(api.deleteSection, [keys.sections, keys.counts]);

  const rows = visibleRows(sections, (id) => !!expanded[id]);
  const selectedId = view.kind === "section" ? view.id : null;

  // ── Creazione ──────────────────────────────────────────────────────────────

  const startCreate = (parentId: number | null) => {
    if (parentId !== null) setExpanded(parentId, true);
    setDraftParent(parentId);
  };

  const commitCreate = async (name: string) => {
    const parentId = draftParent ?? null;
    setDraftParent(undefined);
    const created = await create(name, parentId);
    if (created) setView({ kind: "section", id: created.id });
  };

  // ── Eliminazione ───────────────────────────────────────────────────────────

  const performDelete = async (section: Section) => {
    const removed = subtreeIds(sections, section.id);
    await remove(section.id);
    if (selectedId !== null && removed.has(selectedId)) setView({ kind: "all" });
  };

  const requestDelete = async (section: Section) => {
    try {
      const preview = await api.sectionDeletePreview(section.id);
      if (preview.subsections === 0 && preview.articles === 0) await performDelete(section);
      else setDeleting({ section, preview });
    } catch (error) {
      showError(error);
    }
  };

  // ── Trascinamento ──────────────────────────────────────────────────────────

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const endDrag = () => {
    setDraggedId(null);
    setHover(null);
  };

  const onDragMove = (event: DragMoveEvent) => {
    const next = hoverFrom(event);
    setHover((prev) => (prev?.id === next?.id && prev?.zone === next?.zone ? prev : next));
  };

  const onDragEnd = (event: DragMoveEvent) => {
    const id = event.active.data.current?.sectionId as number;
    const target = hoverFrom(event);
    endDrag();
    if (!target) return;
    const destination = resolveDrop(sections, id, target.id, target.zone);
    if (!destination) return;
    if (destination.parentId !== null) setExpanded(destination.parentId, true);
    move(id, destination.parentId, destination.index);
  };

  const isValidHover = (h: Hover | null): h is Hover =>
    h !== null && draggedId !== null && resolveDrop(sections, draggedId, h.id, h.zone) !== null;

  // Tenendo una sezione sopra una sezione chiusa, la si apre.
  const expandCandidate = hover?.zone === "inside" ? hover.id : null;
  useEffect(() => {
    if (expandCandidate === null || expanded[expandCandidate]) return;
    const timer = setTimeout(() => setExpanded(expandCandidate, true), AUTO_EXPAND_MS);
    return () => clearTimeout(timer);
  }, [expandCandidate, expanded, setExpanded]);

  // ── Righe ──────────────────────────────────────────────────────────────────

  const items: ReactNode[] = rows.map((row) =>
    renamingId === row.section.id ? (
      <EditRow
        key={row.section.id}
        depth={row.depth}
        initialValue={row.section.name}
        onCommit={(name) => {
          setRenamingId(null);
          rename(row.section.id, name);
        }}
        onCancel={() => setRenamingId(null)}
      />
    ) : (
      <SectionRow
        key={row.section.id}
        row={row}
        selected={row.section.id === selectedId}
        expanded={row.hasChildren ? !!expanded[row.section.id] : undefined}
        dropZone={hover?.id === row.section.id && isValidHover(hover) ? hover.zone : null}
        dragging={draggedId === row.section.id}
        onSelect={() => setView({ kind: "section", id: row.section.id })}
        onToggle={() => setExpanded(row.section.id, !expanded[row.section.id])}
        onRename={() => setRenamingId(row.section.id)}
        onCreateChild={() => startCreate(row.section.id)}
        onDelete={() => requestDelete(row.section)}
      />
    ),
  );

  if (draftParent !== undefined) {
    items.splice(
      draftInsertIndex(rows, draftParent),
      0,
      <EditRow
        key="draft"
        depth={draftDepth(rows, draftParent)}
        initialValue=""
        placeholder="Nome della sezione"
        onCommit={commitCreate}
        onCancel={() => setDraftParent(undefined)}
      />,
    );
  }

  const dragged = sections.find((s) => s.id === draggedId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={({ active }) => setDraggedId(active.data.current?.sectionId as number)}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={endDrag}
    >
      <RootDropHeader highlighted={hover?.id === null && isValidHover(hover)} onAdd={() => startCreate(null)} />
      <div role="tree" aria-label="Sezioni" className={styles.group}>
        {items}
        {items.length === 0 && (
          <button type="button" className={styles.emptyHint} onClick={() => startCreate(null)}>
            Crea la tua prima sezione
          </button>
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {dragged && (
          <div className={styles.dragOverlay}>
            <Folder size={14} />
            {dragged.name}
          </div>
        )}
      </DragOverlay>

      <DeleteSectionDialog target={deleting} onClose={() => setDeleting(null)} onConfirm={performDelete} />
    </DndContext>
  );
}

function RootDropHeader({ highlighted, onAdd }: { highlighted: boolean; onAdd: () => void }) {
  const { setNodeRef } = useDroppable({ id: ROOT_DROP_ID });
  return (
    <GroupHeader ref={setNodeRef} title="Sezioni" addLabel="Nuova sezione" onAdd={onAdd} highlighted={highlighted} />
  );
}

interface EditRowProps {
  depth: number;
  initialValue: string;
  placeholder?: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}

function EditRow({ depth, ...edit }: EditRowProps) {
  return (
    <div className={styles.row} style={{ "--depth": depth } as CSSProperties}>
      <span className={styles.chevronSlot} />
      <span className={styles.rowIcon}>
        <Folder size={16} />
      </span>
      <InlineEdit className={styles.inlineInput} {...edit} />
    </div>
  );
}

interface SectionRowProps {
  row: TreeRow;
  selected: boolean;
  expanded: boolean | undefined;
  dropZone: DropZone | null;
  dragging: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onRename: () => void;
  onCreateChild: () => void;
  onDelete: () => void;
}

function SectionRow({ row, onSelect, onToggle, onRename, onCreateChild, onDelete, ...state }: SectionRowProps) {
  const { section, depth } = row;
  const data = { sectionId: section.id };
  const draggable = useDraggable({ id: `section-${section.id}`, data });
  const droppable = useDroppable({ id: `section-${section.id}`, data });
  // PDF trascinati dal computer proprio su questa sezione.
  const filesOver = useImports((s) => s.dragging && s.dragSectionId === section.id);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "F2" || (e.key === "Enter" && state.selected)) onRename();
    else if (e.key === "Delete") onDelete();
    else if (e.key === "ArrowRight" && state.expanded === false) onToggle();
    else if (e.key === "ArrowLeft" && state.expanded === true) onToggle();
  };

  return (
    <ContextRoot>
      <ContextTrigger asChild>
        <SidebarRow
          ref={(node) => {
            draggable.setNodeRef(node);
            droppable.setNodeRef(node);
          }}
          {...draggable.listeners}
          {...{ [SECTION_DROP_ATTR]: section.id }}
          icon={<Folder size={16} />}
          label={section.name}
          count={section.articleCount}
          depth={depth}
          selected={state.selected}
          expanded={state.expanded}
          dropZone={filesOver ? "inside" : state.dropZone}
          dragging={state.dragging}
          onToggle={onToggle}
          onClick={onSelect}
          onDoubleClick={onRename}
          onKeyDown={onKeyDown}
        />
      </ContextTrigger>
      <ContextContent>
        <ContextItem icon={<FolderPlus size={14} />} onSelect={onCreateChild}>
          Nuova sottosezione
        </ContextItem>
        <ContextItem icon={<Pencil size={14} />} onSelect={onRename}>
          Rinomina
        </ContextItem>
        <ContextSeparator />
        <ContextItem
          icon={<Download size={14} />}
          onSelect={() => exportView({ kind: "section", id: section.id }, section.name)}
        >
          Esporta in BibTeX…
        </ContextItem>
        <ContextSeparator />
        <ContextItem icon={<Trash2 size={14} />} destructive onSelect={onDelete}>
          Elimina sezione…
        </ContextItem>
      </ContextContent>
    </ContextRoot>
  );
}

/** Posizione (tra le righe visibili) in cui mostrare la riga di creazione. */
function draftInsertIndex(rows: TreeRow[], parentId: number | null): number {
  const at = parentId === null ? -1 : rows.findIndex((r) => r.section.id === parentId);
  if (at === -1) return rows.length;
  let i = at + 1;
  while (i < rows.length && rows[i].depth > rows[at].depth) i++;
  return i;
}

function draftDepth(rows: TreeRow[], parentId: number | null): number {
  if (parentId === null) return 0;
  return (rows.find((r) => r.section.id === parentId)?.depth ?? -1) + 1;
}
