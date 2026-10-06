import clsx from "clsx";
import { CircleAlert, CircleCheck, Copy, LoaderCircle, X } from "lucide-react";
import { useEffect } from "react";

import { IconButton } from "../../components/Button";
import { isFinished, useImports, type ImportJob, type ImportStage } from "../../store/imports";
import { useUi } from "../../store/ui";
import styles from "./ImportPanel.module.css";

const STAGE_LABEL: Record<ImportStage, string> = {
  waiting: "In attesa",
  copying: "Copia nella libreria…",
  reading: "Lettura del PDF…",
  metadata: "Recupero dei dati…",
  done: "Aggiunto",
  duplicate: "Già presente",
  error: "Non aggiunto",
};

/** Dopo quanto tempo sparisce un'importazione andata del tutto liscia. */
const AUTO_CLOSE_MS = 3500;

export function ImportPanel() {
  const jobs = useImports((s) => s.jobs);
  const clearFinished = useImports((s) => s.clearFinished);
  const selectArticle = useUi((s) => s.selectArticle);

  const finished = jobs.filter(isFinished).length;
  const allDone = jobs.length > 0 && finished === jobs.length;
  const clean = allDone && jobs.every((j) => j.stage === "done" && !j.note);

  useEffect(() => {
    if (!clean) return;
    const timer = setTimeout(clearFinished, AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [clean, clearFinished]);

  if (jobs.length === 0) return null;

  return (
    <div className={styles.panel} role="status" aria-live="polite">
      <header className={styles.header}>
        <span className={styles.heading}>
          {allDone ? "Importazione completata" : `Importazione ${Math.min(finished + 1, jobs.length)} di ${jobs.length}`}
        </span>
        {allDone && (
          <IconButton label="Chiudi" onClick={clearFinished}>
            <X size={14} />
          </IconButton>
        )}
      </header>
      {!allDone && (
        <div className={styles.progress}>
          <div className={styles.bar} style={{ width: `${(finished / jobs.length) * 100}%` }} />
        </div>
      )}
      <ul className={styles.list}>
        {jobs.map((job) => (
          <li key={job.id}>
            <button
              type="button"
              className={styles.job}
              disabled={!job.articleId}
              onClick={() => job.articleId && selectArticle(job.articleId)}
            >
              <JobIcon job={job} />
              <span className={styles.jobText}>
                <span className={styles.jobName}>{job.name}</span>
                <span className={clsx(styles.jobNote, job.stage === "error" && styles.error)}>
                  {job.note ?? STAGE_LABEL[job.stage]}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function JobIcon({ job }: { job: ImportJob }) {
  switch (job.stage) {
    case "done":
      return job.note ? (
        <CircleAlert size={15} className={styles.warn} />
      ) : (
        <CircleCheck size={15} className={styles.ok} />
      );
    case "duplicate":
      return <Copy size={15} className={styles.muted} />;
    case "error":
      return <CircleAlert size={15} className={styles.error} />;
    case "waiting":
      return <span className={styles.dot} />;
    default:
      return <LoaderCircle size={15} className={styles.spin} />;
  }
}
