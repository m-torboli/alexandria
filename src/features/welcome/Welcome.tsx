import { CircleAlert, Folder } from "lucide-react";
import { useState } from "react";

import { Button } from "../../components/Button";
import { api, type AppStatus, type LibraryLocation } from "../../lib/api";
import { inUseMessage, openLibrary, pickLibraryLocation } from "../../lib/library";
import { resetAllData } from "../../lib/queries";
import { showError } from "../../store/toast";
import { Logo } from "./Logo";
import styles from "./Welcome.module.css";

/** Primo avvio (o libreria non disponibile): si sceglie dove conservare la libreria. */
export function Welcome({ status }: { status: AppStatus }) {
  const issue = status.startupIssue;
  const [location, setLocation] = useState<LibraryLocation>(
    issue ? { path: issue.path, exists: true } : status.defaultLocation,
  );
  const [busy, setBusy] = useState(false);

  const choose = async () => {
    try {
      const picked = await pickLibraryLocation("Scegli dove conservare la libreria");
      if (picked) setLocation(picked);
    } catch (error) {
      showError(error);
    }
  };

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      if (await action()) await resetAllData();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  const openChosen = () => run(() => openLibrary(location.path));
  const openAnyway = () =>
    run(async () => (await api.openLibrary(location.path, true)).status === "opened");

  const inUseHere = issue?.kind === "inUse" && issue.path === location.path;

  return (
    <main className={styles.screen} data-tauri-drag-region>
      <div className={styles.card}>
        <Logo className={styles.logo} />
        <h1 className={styles.title}>{issue ? "Alexandria" : "Benvenuto in Alexandria"}</h1>
        <p className={styles.lead}>
          {issue
            ? "La tua biblioteca personale di articoli scientifici."
            : "La tua biblioteca personale di articoli scientifici. Per iniziare, scegli dove conservarla."}
        </p>

        {issue && (
          <div className={styles.warning} role="alert">
            <CircleAlert size={15} />
            <span>
              {issue.kind === "inUse"
                ? inUseMessage(issue.device, issue.minutesAgo)
                : `Impossibile aprire la libreria in “${issue.path}”. ${issue.message}`}
            </span>
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

        {!issue && (
          <p className={styles.hint}>
            Puoi scegliere anche una cartella sincronizzata (iCloud Drive, Dropbox, Google Drive) per ritrovare la
            libreria su più computer.
          </p>
        )}

        <div className={styles.actions}>
          {inUseHere ? (
            <Button variant="primary" size="lg" className={styles.cta} disabled={busy} onClick={openAnyway}>
              Apri comunque
            </Button>
          ) : (
            <Button variant="primary" size="lg" className={styles.cta} disabled={busy} onClick={openChosen}>
              {location.exists ? "Apri libreria" : "Crea libreria"}
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
