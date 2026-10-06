// Ponte tipizzato verso i comandi Rust (src-tauri/src/commands.rs).

import { invoke } from "@tauri-apps/api/core";

import type { View } from "../store/ui";

export interface LibraryInfo {
  path: string;
  name: string;
}

export interface LibraryLocation {
  path: string;
  exists: boolean;
}

export type StartupIssue =
  | { kind: "error"; path: string; message: string }
  | { kind: "inUse"; path: string; device: string; minutesAgo: number };

export interface AppStatus {
  library: LibraryInfo | null;
  startupIssue: StartupIssue | null;
  defaultLocation: LibraryLocation;
}

export type OpenOutcome =
  | { status: "opened"; library: LibraryInfo }
  | { status: "inUse"; device: string; minutesAgo: number };

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

export interface Author {
  family: string;
  given: string;
}

/** 0 = da leggere, 1 = in lettura, 2 = letto. */
export type ReadingStatus = 0 | 1 | 2;

export interface Metadata {
  title: string;
  authors: Author[];
  year: number | null;
  journal: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  publisher: string | null;
  doi: string | null;
  url: string | null;
  abstract: string | null;
}

export interface ArticleSummary {
  id: number;
  title: string;
  authors: Author[];
  year: number | null;
  journal: string | null;
  readingStatus: ReadingStatus;
  favorite: boolean;
  metadataComplete: boolean;
  addedAt: string;
  deletedAt: string | null;
  /** Durante una ricerca: estratto con i termini tra i caratteri \u0002 e \u0003. */
  snippet: string | null;
}

export interface Filters {
  authorIds: number[];
  journals: string[];
  tagIds: number[];
  yearFrom: number | null;
  yearTo: number | null;
  statuses: ReadingStatus[];
  favoritesOnly: boolean;
  addedWithinDays: number | null;
}

export type SortKey = "relevance" | "added" | "yearDesc" | "yearAsc" | "title" | "author";

export interface ArticleQuery {
  text: string;
  filters: Filters;
  sort: SortKey;
}

export interface FilterOptions {
  authors: (Author & { id: number; count: number })[];
  journals: { name: string; count: number }[];
  minYear: number | null;
  maxYear: number | null;
}

export interface Article extends Metadata {
  id: number;
  readingStatus: ReadingStatus;
  favorite: boolean;
  metadataComplete: boolean;
  notes: string;
  fileName: string | null;
  fileSize: number | null;
  pageCount: number | null;
  addedAt: string;
  modifiedAt: string;
  deletedAt: string | null;
  sectionIds: number[];
  tagIds: number[];
}

export interface ImportOutcome {
  articleId: number;
  status: "added" | "duplicate" | "duplicateInTrash";
}

/** Estrae dall'articolo completo i soli campi bibliografici. */
export const metadataOf = (a: Article): Metadata => ({
  title: a.title,
  authors: a.authors,
  year: a.year,
  journal: a.journal,
  volume: a.volume,
  issue: a.issue,
  pages: a.pages,
  publisher: a.publisher,
  doi: a.doi,
  url: a.url,
  abstract: a.abstract,
});

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
  openLibrary: (path: string, force = false) => call<OpenOutcome>("open_library", { path, force }),
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

  listArticles: (view: View, query?: ArticleQuery) => call<ArticleSummary[]>("list_articles", { view, query }),
  filterOptions: () => call<FilterOptions>("filter_options"),
  getArticle: (id: number) => call<Article>("get_article", { id }),
  importPdf: (path: string, sectionId: number | null) => call<ImportOutcome>("import_pdf", { path, sectionId }),
  readArticlePdf: async (id: number) => new Uint8Array(await call<ArrayBuffer>("read_article_pdf", { id })),
  savePdfInfo: (id: number, text: string, pageCount: number | null, title: string | null) =>
    call<Article>("save_pdf_info", { id, text, pageCount, title }),
  lookupDoi: (id: number, doi: string) => call<Article>("lookup_doi", { id, doi }),
  updateArticleMetadata: (id: number, metadata: Metadata) =>
    call<Article>("update_article_metadata", { id, metadata }),
  setReadingStatus: (id: number, status: ReadingStatus) => call<void>("set_reading_status", { id, status }),
  setFavorite: (id: number, favorite: boolean) => call<void>("set_favorite", { id, favorite }),
  setArticleNotes: (id: number, notes: string) => call<void>("set_article_notes", { id, notes }),
  exportArticles: (view: View) => call<Article[]>("export_articles", { view }),
  saveBibliography: (path: string, contents: string) => call<void>("save_bibliography", { path, contents }),
  setArticleSections: (id: number, sectionIds: number[]) => call<void>("set_article_sections", { id, sectionIds }),
  setArticleTags: (id: number, tagIds: number[]) => call<void>("set_article_tags", { id, tagIds }),
  trashArticles: (ids: number[]) => call<void>("trash_articles", { ids }),
  restoreArticles: (ids: number[]) => call<void>("restore_articles", { ids }),
  deleteArticlesForever: (ids: number[]) => call<void>("delete_articles_forever", { ids }),
  emptyTrash: () => call<void>("empty_trash"),
  openArticlePdf: (id: number) => call<void>("open_article_pdf", { id }),
  revealArticlePdf: (id: number) => call<void>("reveal_article_pdf", { id }),
};
