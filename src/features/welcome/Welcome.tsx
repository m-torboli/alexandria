import { CircleAlert, Folder } from "lucide-react";
import { useState } from "react";

import { Button } from "../../components/Button";
import { api, type AppStatus, type LibraryLocation } from "../../lib/api";
import { pickLibraryLocation } from "../../lib/library";
import { resetAllData } from "../../lib/queries";
import { showError } from "../../store/toast";
import { Logo } from "./Logo";
import styles from "./Welcome.module.css";

/** Primo avvio: si sceglie dove conservare la libreria. */
export function Welcome({ status }: { status: AppStatus }) {
  const [location, setLocation] = useState<LibraryLocation>(status.defaultLocation);
  const [busy, setBusy] = useState(false);

  const choose = async () => {
    try {
      const picked = await pickLibraryLocation("Scegli dove conservare la libreria");
      if (picked) setLocation(picked);
    } catch (error) {
      showError(error);
    }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      await api.openLibrary(location.path);
      await resetAllData();
    } catch (error) {
      showError(error);
      setBusy(false);
    }
  };

  return (
    <main className={styles.screen} data-tauri-drag-region>
      <div className={styles.card}>
        <Logo className={styles.logo} />
        <h1 className={styles.title}>Benvenuto in Alexandria</h1>
        <p className={styles.lead}>
          La tua biblioteca personale di articoli scientifici. Per iniziare, scegli dove conservarla.
        </p>

        {status.startupError && (
          <div className={styles.warning} role="alert">
            <CircleAlert size={15} />
            <span>{status.startupError}</span>
          </div>
        )}

        <div className={styles.location}>
          <Folder size={16} className={styles.folderIcon} />
          <div className={styles.locationText}>
            <span className={styles.locationLabel}>
              {location.exists ? "Libreria esistente" : "Nuova libreria in"}
            </span>
            <span className={styles.path} title={location.path}>
              {location.path}
            </span>
          </div>
          <Button variant="ghost" onClick={choose}>
            Cambia…
          </Button>
        </div>

        <p className={styles.hint}>
          Puoi scegliere anche una cartella sincronizzata (iCloud Drive, Dropbox, Google Drive) per ritrovare la
          libreria su più computer.
        </p>

        <Button variant="primary" size="lg" className={styles.cta} disabled={busy} onClick={confirm}>
          {location.exists ? "Apri libreria" : "Crea libreria"}
        </Button>
      </div>
    </main>
  );
}
