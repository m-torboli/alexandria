import { Palette, Pencil, Trash2 } from "lucide-react";
import { useState, type CSSProperties } from "react";

import { ConfirmDialog } from "../../components/ConfirmDialog";
import { InlineEdit } from "../../components/InlineEdit";
import {
  ContextCheckItem,
  ContextContent,
  ContextItem,
  ContextRoot,
  ContextSeparator,
  ContextSub,
  ContextTrigger,
} from "../../components/Menu";
import { api, TAG_COLORS, type Tag, type TagColor } from "../../lib/api";
import { plural } from "../../lib/format";
import { keys, useAction, useTags } from "../../lib/queries";
import { useUi } from "../../store/ui";
import { GroupHeader } from "./GroupHeader";
import styles from "./Sidebar.module.css";
import { SidebarRow } from "./SidebarRow";

const COLOR_NAMES: Record<TagColor, string> = {
  red: "Rosso",
  orange: "Arancione",
  yellow: "Giallo",
  green: "Verde",
  teal: "Turchese",
  blue: "Blu",
  purple: "Viola",
  gray: "Grigio",
};

export function TagDot({ color }: { color: TagColor }) {
  return <span className={styles.tagDot} style={{ "--tag": `var(--tag-${color})` } as CSSProperties} />;
}

export function TagList() {
  const tags = useTags().data ?? [];
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);

  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<Tag | null>(null);

  const create = useAction(api.createTag, [keys.tags]);
  const update = useAction(api.updateTag, [keys.tags]);
  const remove = useAction(api.deleteTag, [keys.tags]);

  // Ogni nuovo tag prende il colore successivo, così restano distinguibili.
  const nextColor = TAG_COLORS[tags.length % TAG_COLORS.length];

  const performDelete = async (tag: Tag) => {
    await remove(tag.id);
    if (view.kind === "tag" && view.id === tag.id) setView({ kind: "all" });
  };

  return (
    <>
      <GroupHeader title="Tag" addLabel="Nuovo tag" onAdd={() => setCreating(true)} />
      <div role="tree" aria-label="Tag" className={styles.group}>
        {tags.map((tag) =>
          renamingId === tag.id ? (
            <div key={tag.id} className={styles.row}>
              <span className={styles.chevronSlot} />
              <span className={styles.rowIcon}>
                <TagDot color={tag.color} />
              </span>
              <InlineEdit
                initialValue={tag.name}
                className={styles.inlineInput}
                onCommit={(name) => {
                  setRenamingId(null);
                  update(tag.id, name, tag.color);
                }}
                onCancel={() => setRenamingId(null)}
              />
            </div>
          ) : (
            <ContextRoot key={tag.id}>
              <ContextTrigger asChild>
                <SidebarRow
                  icon={<TagDot color={tag.color} />}
                  label={tag.name}
                  count={tag.articleCount}
                  selected={view.kind === "tag" && view.id === tag.id}
                  onClick={() => setView({ kind: "tag", id: tag.id })}
                  onDoubleClick={() => setRenamingId(tag.id)}
                  onKeyDown={(e) => {
                    if (e.key === "F2" || e.key === "Enter") setRenamingId(tag.id);
                    if (e.key === "Delete") setDeleting(tag);
                  }}
                />
              </ContextTrigger>
              <ContextContent>
                <ContextItem icon={<Pencil size={14} />} onSelect={() => setRenamingId(tag.id)}>
                  Rinomina
                </ContextItem>
                <ContextSub icon={<Palette size={14} />} label="Colore">
                  {TAG_COLORS.map((color) => (
                    <ContextCheckItem
                      key={color}
                      icon={<TagDot color={color} />}
                      checked={tag.color === color}
                      onSelect={() => update(tag.id, tag.name, color)}
                    >
                      {COLOR_NAMES[color]}
                    </ContextCheckItem>
                  ))}
                </ContextSub>
                <ContextSeparator />
                <ContextItem
                  icon={<Trash2 size={14} />}
                  destructive
                  onSelect={() => (tag.articleCount > 0 ? setDeleting(tag) : performDelete(tag))}
                >
                  Elimina tag…
                </ContextItem>
              </ContextContent>
            </ContextRoot>
          ),
        )}

        {creating && (
          <div className={styles.row}>
            <span className={styles.chevronSlot} />
            <span className={styles.rowIcon}>
              <TagDot color={nextColor} />
            </span>
            <InlineEdit
              initialValue=""
              placeholder="Nome del tag"
              className={styles.inlineInput}
              onCommit={(name) => {
                setCreating(false);
                create(name, nextColor);
              }}
              onCancel={() => setCreating(false)}
            />
          </div>
        )}

        {tags.length === 0 && !creating && (
          <button type="button" className={styles.emptyHint} onClick={() => setCreating(true)}>
            Crea un tag
          </button>
        )}
      </div>

      {deleting && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          title={`Eliminare il tag “${deleting.name}”?`}
          confirmLabel="Elimina tag"
          destructive
          onConfirm={() => performDelete(deleting)}
        >
          <p>
            Il tag verrà rimosso da {plural(deleting.articleCount, "articolo", "articoli")}. Gli articoli non verranno
            eliminati.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
