import { FileText } from "lucide-react";

import { plural } from "../../lib/format";
import { useSections, useTags, useViewCounts } from "../../lib/queries";
import { ancestorIds } from "../../lib/sectionTree";
import { fixedView } from "../../lib/views";
import { useUi, type View } from "../../store/ui";
import { TagDot } from "../sidebar/TagList";
import styles from "./Articles.module.css";

interface Heading {
  title: string;
  /** Percorso delle sezioni madri, es. "Medicina › Cardiologia". */
  trail?: string;
  count: number;
  empty: string;
  tagColor?: Parameters<typeof TagDot>[0]["color"];
}

function useHeading(view: View): Heading | null {
  const counts = useViewCounts().data;
  const sections = useSections().data;
  const tags = useTags().data;

  switch (view.kind) {
    case "section": {
      const section = sections?.find((s) => s.id === view.id);
      if (!section || !sections) return null;
      const trail = ancestorIds(sections, section.id)
        .reverse()
        .map((id) => sections.find((s) => s.id === id)?.name)
        .join(" › ");
      return { title: section.name, trail, count: section.articleCount, empty: "Questa sezione è ancora vuota." };
    }
    case "tag": {
      const tag = tags?.find((t) => t.id === view.id);
      if (!tag) return null;
      return { title: tag.name, count: tag.articleCount, empty: "Nessun articolo con questo tag.", tagColor: tag.color };
    }
    default: {
      const info = fixedView(view.kind);
      return { title: info.label, count: counts?.[info.count] ?? 0, empty: info.empty };
    }
  }
}

export function ArticlePane() {
  const view = useUi((s) => s.view);
  const heading = useHeading(view);

  return (
    <section className={styles.pane} aria-label="Articoli">
      <header className={styles.header} data-tauri-drag-region>
        {heading && (
          <div className={styles.heading} data-tauri-drag-region>
            {heading.trail && <span className={styles.trail}>{heading.trail}</span>}
            <h1 className={styles.title}>
              {heading.tagColor && <TagDot color={heading.tagColor} />}
              {heading.title}
            </h1>
            <span className={styles.subtitle}>{plural(heading.count, "articolo", "articoli")}</span>
          </div>
        )}
      </header>

      <div className={styles.empty}>
        <FileText size={40} strokeWidth={1.2} className={styles.emptyIcon} />
        <p className={styles.emptyTitle}>Nessun articolo</p>
        <p className={styles.emptyText}>{heading?.empty}</p>
      </div>
    </section>
  );
}
