import { Plus } from "lucide-react";
import type { Ref } from "react";
import clsx from "clsx";

import { IconButton } from "../../components/Button";
import styles from "./Sidebar.module.css";

interface GroupHeaderProps {
  title: string;
  addLabel: string;
  onAdd: () => void;
  /** Evidenziato quando è il bersaglio di un trascinamento. */
  highlighted?: boolean;
  ref?: Ref<HTMLDivElement>;
}

export function GroupHeader({ title, addLabel, onAdd, highlighted, ref }: GroupHeaderProps) {
  return (
    <div ref={ref} className={clsx(styles.groupHeader, highlighted && styles.groupHeaderDrop)}>
      <span>{title}</span>
      <IconButton label={addLabel} className={styles.addButton} onClick={onAdd}>
        <Plus size={14} />
      </IconButton>
    </div>
  );
}
