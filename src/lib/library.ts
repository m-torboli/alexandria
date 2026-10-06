import { open } from "@tauri-apps/plugin-dialog";

import { api, type LibraryLocation } from "./api";

/** Chiede all'utente una cartella e calcola dove andrebbe la libreria. */
export async function pickLibraryLocation(title: string): Promise<LibraryLocation | null> {
  const chosen = await open({ directory: true, multiple: false, title });
  if (typeof chosen !== "string") return null;
  return api.resolveLibraryLocation(chosen);
}
