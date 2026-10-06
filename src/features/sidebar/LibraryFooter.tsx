import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { ChevronsUpDown, Download, FolderOpen, Library, Repeat } from "lucide-react";

import {
  DropdownContent,
  DropdownItem,
  DropdownRoot,
  DropdownSeparator,
  DropdownTrigger,
} from "../../components/Menu";
import { exportView } from "../../lib/export";
import { openLibrary, pickLibraryLocation } from "../../lib/library";
import { resetAllData, useAppStatus } from "../../lib/queries";
import { showError, useToasts } from "../../store/toast";
import { useUi } from "../../store/ui";
import styles from "./Sidebar.module.css";

export function LibraryFooter() {
  const library = useAppStatus().data?.library;
  const setView = useUi((s) => s.setView);
  if (!library) return null;

  const switchLibrary = async () => {
    try {
      const location = await pickLibraryLocation("Apri o crea una libreria");
      if (!location || location.path === library.path) return;
      const opened = await openLibrary(location.path);
      if (!opened) return;
      setView({ kind: "all" });
      await resetAllData();
      useToasts
        .getState()
        .show(location.exists ? `Libreria “${opened.name}” aperta.` : `Nuova libreria creata in ${opened.path}.`);
    } catch (error) {
      showError(error);
    }
  };

  return (
    <DropdownRoot>
      <DropdownTrigger asChild>
        <button type="button" className={styles.footer} title={library.path}>
          <Library size={15} className={styles.footerIcon} />
          <span className={styles.footerName}>{library.name}</span>
          <ChevronsUpDown size={13} className={styles.footerChevron} />
        </button>
      </DropdownTrigger>
      <DropdownContent side="top" align="start">
        <DropdownItem
          icon={<FolderOpen size={14} />}
          onSelect={() => revealItemInDir(library.path).catch(showError)}
        >
          Mostra nella cartella
        </DropdownItem>
        <DropdownItem icon={<Download size={14} />} onSelect={() => exportView({ kind: "all" }, library.name)}>
          Esporta la libreria in BibTeX…
        </DropdownItem>
        <DropdownSeparator />
        <DropdownItem icon={<Repeat size={14} />} onSelect={switchLibrary}>
          Apri o crea un'altra libreria…
        </DropdownItem>
      </DropdownContent>
    </DropdownRoot>
  );
}
