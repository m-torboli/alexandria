//! Articoli: importazione, metadati, organizzazione, Cestino e apertura dei PDF.

use std::{fs, path::PathBuf};

use tauri::{ipc::Response, AppHandle, State};
use tauri_plugin_opener::OpenerExt;

use super::blocking;
use crate::{
    articles::{self, Article, ArticleSummary, Metadata, View},
    error::{AppError, AppResult},
    importer::{self, ImportOutcome},
    metadata,
    query::{self, FilterOptions, Query},
    state::AppState,
};

#[tauri::command]
pub fn list_articles(state: State<AppState>, view: View, query: Option<Query>) -> AppResult<Vec<ArticleSummary>> {
    state.with_library(|lib| query::list(&lib.conn, view, &query.unwrap_or_default()))
}

/// Articoli completi di una vista, per l'esportazione delle citazioni.
#[tauri::command]
pub fn export_articles(state: State<AppState>, view: View) -> AppResult<Vec<Article>> {
    state.with_library(|lib| {
        query::list(&lib.conn, view, &Query { sort: query::Sort::Author, ..Default::default() })?
            .into_iter()
            .map(|summary| articles::get(&lib.conn, summary.id))
            .collect()
    })
}

/// Scrive un file di testo scelto dall'utente con la finestra "Salva".
/// Solo bibliografie (.bib): l'interfaccia non può scrivere altri tipi di file.
#[tauri::command]
pub async fn save_bibliography(path: PathBuf, contents: String) -> AppResult<()> {
    let is_bib = path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("bib"));
    if !is_bib {
        return Err(AppError::invalid("Il file deve avere estensione .bib."));
    }
    blocking(move || Ok(fs::write(path, contents)?)).await
}

#[tauri::command]
pub fn filter_options(state: State<AppState>) -> AppResult<FilterOptions> {
    state.with_library(|lib| query::filter_options(&lib.conn))
}

#[tauri::command]
pub fn get_article(state: State<AppState>, id: i64) -> AppResult<Article> {
    state.with_library(|lib| articles::get(&lib.conn, id))
}

// ── Importazione ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn import_pdf(
    state: State<'_, AppState>,
    path: PathBuf,
    section_id: Option<i64>,
) -> AppResult<ImportOutcome> {
    let pdf_dir = state.with_library(|lib| Ok(lib.pdf_dir()))?;
    let staged = blocking(move || importer::stage(&path, &pdf_dir)).await?;
    state.with_library(|lib| importer::commit(lib, staged, section_id))
}

/// Contenuto del PDF, letto dall'interfaccia per estrarne testo e DOI.
#[tauri::command]
pub async fn read_article_pdf(state: State<'_, AppState>, id: i64) -> AppResult<Response> {
    let path = state.with_library(|lib| articles::file_path(lib, id))?;
    let bytes = blocking(move || Ok(fs::read(path)?)).await?;
    Ok(Response::new(bytes))
}

#[tauri::command]
pub fn save_pdf_info(
    state: State<AppState>,
    id: i64,
    text: String,
    page_count: Option<i64>,
    title: Option<String>,
) -> AppResult<Article> {
    state.with_library(|lib| articles::save_pdf_info(lib, id, &text, page_count, title.as_deref()))
}

/// Scarica i metadati del DOI e li applica all'articolo.
#[tauri::command]
pub async fn lookup_doi(state: State<'_, AppState>, id: i64, doi: String) -> AppResult<Article> {
    let doi = metadata::normalize_doi(&doi).ok_or_else(|| AppError::invalid("Il DOI indicato non è valido."))?;
    let fetched = blocking(move || metadata::fetch(&doi)).await?;
    state.with_library(|lib| articles::apply_fetched(lib, id, fetched))
}

// ── Modifiche ───────────────────────────────────────────────────────────────

#[tauri::command]
pub fn update_article_metadata(state: State<AppState>, id: i64, metadata: Metadata) -> AppResult<Article> {
    state.with_library(|lib| articles::update_metadata(lib, id, metadata))
}

#[tauri::command]
pub fn set_reading_status(state: State<AppState>, id: i64, status: i64) -> AppResult<()> {
    state.with_library(|lib| articles::set_reading_status(&lib.conn, id, status))
}

#[tauri::command]
pub fn set_favorite(state: State<AppState>, id: i64, favorite: bool) -> AppResult<()> {
    state.with_library(|lib| articles::set_favorite(&lib.conn, id, favorite))
}

#[tauri::command]
pub fn set_article_notes(state: State<AppState>, id: i64, notes: String) -> AppResult<()> {
    state.with_library(|lib| articles::set_notes(&lib.conn, id, &notes))
}

#[tauri::command]
pub fn set_article_sections(state: State<AppState>, id: i64, section_ids: Vec<i64>) -> AppResult<()> {
    state.with_library(|lib| articles::set_sections(&mut lib.conn, id, &section_ids))
}

#[tauri::command]
pub fn set_article_tags(state: State<AppState>, id: i64, tag_ids: Vec<i64>) -> AppResult<()> {
    state.with_library(|lib| articles::set_tags(&mut lib.conn, id, &tag_ids))
}

// ── Cestino ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn trash_articles(state: State<AppState>, ids: Vec<i64>) -> AppResult<()> {
    state.with_library(|lib| articles::move_to_trash(&lib.conn, &ids))
}

#[tauri::command]
pub fn restore_articles(state: State<AppState>, ids: Vec<i64>) -> AppResult<()> {
    state.with_library(|lib| articles::restore(&lib.conn, &ids))
}

#[tauri::command]
pub fn delete_articles_forever(state: State<AppState>, ids: Vec<i64>) -> AppResult<()> {
    state.with_library(|lib| articles::delete_forever(lib, &ids))
}

#[tauri::command]
pub fn empty_trash(state: State<AppState>) -> AppResult<()> {
    state.with_library(articles::empty_trash)
}

// ── File ────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn open_article_pdf(app: AppHandle, state: State<AppState>, id: i64) -> AppResult<()> {
    let path = state.with_library(|lib| articles::file_path(lib, id))?;
    app.opener()
        .open_path(path.to_string_lossy(), None::<&str>)
        .map_err(|e| AppError::invalid(format!("Impossibile aprire il PDF: {e}")))
}

#[tauri::command]
pub fn reveal_article_pdf(app: AppHandle, state: State<AppState>, id: i64) -> AppResult<()> {
    let path = state.with_library(|lib| articles::file_path(lib, id))?;
    app.opener()
        .reveal_item_in_dir(path)
        .map_err(|e| AppError::invalid(format!("Impossibile mostrare il file: {e}")))
}
