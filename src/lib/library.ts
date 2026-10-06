import { open } from "@tauri-apps/plugin-dialog";
import { createElement } from "react";

import { confirm } from "../store/confirm";
import { api, type LibraryInfo, type LibraryLocation } from "./api";

/** Chiede all'utente una cartella e calcola dove andrebbe la libreria. */
export async function pickLibraryLocation(title: string): Promise<LibraryLocation | null> {
  const chosen = await open({ directory: true, multiple: false, title });
  if (typeof chosen !== "string") return null;
  return api.resolveLibraryLocation(chosen);
}

export const inUseMessage = (device: string, minutesAgo: number) =>
  `La libreria risulta aperta su “${device}” ${
    minutesAgo < 1 ? "in questo momento" : `(ultimo segnale ${minutesAgo} min fa)`
  }. Usarla su due computer contemporaneamente può danneggiarla: chiudi prima Alexandria sull'altro computer.`;

/**
 * Apre una libreria; se risulta in uso su un altro computer chiede conferma.
 * Restituisce null se l'utente rinuncia.
 */
export async function openLibrary(path: string): Promise<LibraryInfo | null> {
  const outcome = await api.openLibrary(path);
  if (outcome.status === "opened") return outcome.library;

  const ok = await confirm({
    title: "Libreria già aperta altrove",
    body: createElement("p", null, inUseMessage(outcome.device, outcome.minutesAgo)),
    confirmLabel: "Apri comunque",
    destructive: true,
  });
  if (!ok) return null;
  const forced = await api.openLibrary(path, true);
  return forced.status === "opened" ? forced.library : null;
}
