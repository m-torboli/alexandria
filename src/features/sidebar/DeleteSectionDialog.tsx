import { ConfirmDialog } from "../../components/ConfirmDialog";
import type { Section, SectionDeletePreview } from "../../lib/api";
import { plural } from "../../lib/format";

interface DeleteSectionDialogProps {
  target: { section: Section; preview: SectionDeletePreview } | null;
  onClose: () => void;
  onConfirm: (section: Section) => void;
}

export function DeleteSectionDialog({ target, onClose, onConfirm }: DeleteSectionDialogProps) {
  if (!target) return null;
  const { section, preview } = target;

  const contents = [
    preview.subsections > 0 && plural(preview.subsections, "sottosezione", "sottosezioni"),
    preview.articles > 0 && plural(preview.articles, "articolo", "articoli"),
  ].filter(Boolean);

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Eliminare “${section.name}”?`}
      confirmLabel="Elimina sezione"
      destructive
      onConfirm={() => onConfirm(section)}
    >
      <p>La sezione contiene {contents.join(" e ")}.</p>
      {preview.subsections > 0 && <p>Anche le sottosezioni verranno eliminate.</p>}
      {preview.articles > 0 && (
        <p>
          Gli articoli <strong>non verranno eliminati</strong>
          {preview.orphaned > 0
            ? `: ${plural(preview.orphaned, "articolo", "articoli")} senza altre sezioni ${
                preview.orphaned === 1 ? "finirà" : "finiranno"
              } in Non classificati.`
            : " e restano nelle altre sezioni a cui appartengono."}
        </p>
      )}
    </ConfirmDialog>
  );
}
