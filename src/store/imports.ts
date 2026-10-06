import { create } from "zustand";

export type ImportStage = "waiting" | "copying" | "reading" | "metadata" | "done" | "duplicate" | "error";

export interface ImportJob {
  id: number;
  name: string;
  stage: ImportStage;
  articleId?: number;
  /** Avviso per l'utente (dati da completare, errore, duplicato…). */
  note?: string;
}

interface ImportsState {
  jobs: ImportJob[];
  /** Trascinamento di file in corso sopra la finestra. */
  dragging: boolean;
  /** Sezione sotto il puntatore durante il trascinamento. */
  dragSectionId: number | null;
  enqueue: (names: string[]) => number[];
  update: (id: number, patch: Partial<Omit<ImportJob, "id" | "name">>) => void;
  clearFinished: () => void;
  setDrag: (dragging: boolean, sectionId?: number | null) => void;
}

const FINISHED: readonly ImportStage[] = ["done", "duplicate", "error"];
export const isFinished = (job: ImportJob) => FINISHED.includes(job.stage);

let nextId = 1;

export const useImports = create<ImportsState>((set) => ({
  jobs: [],
  dragging: false,
  dragSectionId: null,
  enqueue: (names) => {
    const jobs = names.map((name) => ({ id: nextId++, name, stage: "waiting" as const }));
    set((s) => ({ jobs: [...s.jobs, ...jobs] }));
    return jobs.map((j) => j.id);
  },
  update: (id, patch) => set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)) })),
  clearFinished: () => set((s) => ({ jobs: s.jobs.filter((j) => !isFinished(j)) })),
  setDrag: (dragging, sectionId = null) =>
    set((s) =>
      s.dragging === dragging && s.dragSectionId === sectionId ? s : { dragging, dragSectionId: sectionId },
    ),
}));
