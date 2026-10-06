import { FIXED_VIEWS, READING_STATUS } from "../../lib/views";
import { useViewCounts } from "../../lib/queries";
import { sameView, useUi } from "../../store/ui";
import { LibraryFooter } from "./LibraryFooter";
import { SectionTree } from "./SectionTree";
import styles from "./Sidebar.module.css";
import { SidebarRow } from "./SidebarRow";
import { TagList } from "./TagList";

export function Sidebar() {
  const counts = useViewCounts().data;
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.titlebar} data-tauri-drag-region />
      <nav className={styles.scroll} aria-label="Navigazione">
        <div role="tree" aria-label="Libreria" className={styles.group}>
          {FIXED_VIEWS.map(({ kind, label, icon: Icon, count, status }) => (
            <SidebarRow
              key={kind}
              icon={<Icon size={16} style={status !== undefined ? { color: READING_STATUS[status].color } : undefined} />}
              label={label}
              count={counts?.[count]}
              selected={sameView(view, { kind })}
              onClick={() => setView({ kind })}
            />
          ))}
        </div>
        <SectionTree />
        <TagList />
      </nav>
      <LibraryFooter />
    </aside>
  );
}
