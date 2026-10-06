// Ponte tipizzato verso i comandi Rust (src-tauri/src/commands.rs).

import { invoke } from "@tauri-apps/api/core";

export interface LibraryInfo {
  path: string;
  name: string;
}

export interface LibraryLocation {
  path: string;
  exists: boolean;
}

export interface AppStatus {
  library: LibraryInfo | null;
  startupError: string | null;
  defaultLocation: LibraryLocation;
}

export interface ViewCounts {
  all: number;
  toRead: number;
  favorites: number;
  incomplete: number;
  unclassified: number;
  trash: number;
}

export interface Section {
  id: number;
  parentId: number | null;
  name: string;
  position: number;
  articleCount: number;
}

export interface SectionDeletePreview {
  subsections: number;
  articles: number;
  orphaned: number;
}

export const TAG_COLORS = ["red", "orange", "yellow", "green", "teal", "blue", "purple", "gray"] as const;
export type TagColor = (typeof TAG_COLORS)[number];

export interface Tag {
  id: number;
  name: string;
  color: TagColor;
  articleCount: number;
}

/** Gli errori del backend arrivano come stringhe già pronte per l'utente. */
async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw new Error(typeof error === "string" ? error : String(error));
  }
}

export const api = {
  appStatus: () => call<AppStatus>("app_status"),
  resolveLibraryLocation: (path: string) => call<LibraryLocation>("resolve_library_location", { path }),
  openLibrary: (path: string) => call<LibraryInfo>("open_library", { path }),
  viewCounts: () => call<ViewCounts>("view_counts"),

  listSections: () => call<Section[]>("list_sections"),
  createSection: (name: string, parentId: number | null) =>
    call<Section>("create_section", { name, parentId }),
  renameSection: (id: number, name: string) => call<void>("rename_section", { id, name }),
  moveSection: (id: number, parentId: number | null, index: number) =>
    call<void>("move_section", { id, parentId, index }),
  sectionDeletePreview: (id: number) => call<SectionDeletePreview>("section_delete_preview", { id }),
  deleteSection: (id: number) => call<void>("delete_section", { id }),

  listTags: () => call<Tag[]>("list_tags"),
  createTag: (name: string, color: TagColor) => call<Tag>("create_tag", { name, color }),
  updateTag: (id: number, name: string, color: TagColor) => call<void>("update_tag", { id, name, color }),
  deleteTag: (id: number) => call<void>("delete_tag", { id }),
};
