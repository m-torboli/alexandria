import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from "react";

import type { DropZone } from "../../lib/sectionTree";
import styles from "./Sidebar.module.css";

interface SidebarRowProps extends HTMLAttributes<HTMLDivElement> {
  icon: ReactNode;
  label: ReactNode;
  count?: number;
  selected?: boolean;
  depth?: number;
  /** undefined = nessuna freccia; altrimenti stato espanso/chiuso. */
  expanded?: boolean;
  onToggle?: () => void;
  dropZone?: DropZone | null;
  dragging?: boolean;
  ref?: Ref<HTMLDivElement>;
}

export function SidebarRow({
  icon,
  label,
  count,
  selected,
  depth = 0,
  expanded,
  onToggle,
  dropZone,
  dragging,
  className,
  style,
  ...props
}: SidebarRowProps) {
  return (
    <div
      role="treeitem"
      aria-selected={selected}
      aria-expanded={expanded}
      tabIndex={selected ? 0 : -1}
      className={clsx(styles.row, selected && styles.selected, dragging && styles.dragging, className)}
      data-drop={dropZone ?? undefined}
      style={{ ...style, "--depth": depth } as CSSProperties}
      {...props}
    >
      <span className={styles.chevronSlot}>
        {expanded !== undefined && (
          <button
            type="button"
            tabIndex={-1}
            aria-label={expanded ? "Chiudi" : "Espandi"}
            className={clsx(styles.chevron, expanded && styles.chevronOpen)}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onToggle?.();
            }}
          >
            <ChevronRight size={12} strokeWidth={2.5} />
          </button>
        )}
      </span>
      <span className={styles.rowIcon}>{icon}</span>
      <span className={styles.rowLabel}>{label}</span>
      {!!count && <span className={styles.count}>{count}</span>}
    </div>
  );
}
