import styles from "./Articles.module.css";

export function DetailPane() {
  return (
    <aside className={styles.detail} aria-label="Dettaglio articolo">
      <div className={styles.titlebarSpacer} data-tauri-drag-region />
      <p className={styles.detailEmpty}>Seleziona un articolo per vederne i dettagli.</p>
    </aside>
  );
}
