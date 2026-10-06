//! Comandi invocabili dall'interfaccia. Restano sottili: la logica sta nei
//! moduli di dominio, qui si collega soltanto lo stato condiviso.

use std::path::PathBuf;

use serde::Serialize;
use tauri::State;

use crate::{
    error::AppResult,
    library::{self, LibraryInfo, LibraryLocation},
    sections::{self, DeletePreview, Section},
    state::AppState,
    tags::{self, Tag},
    views::{self, ViewCounts},
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppStatus {
    library: Option<LibraryInfo>,
    startup_error: Option<String>,
    default_location: LibraryLocation,
}

// ── Libreria ────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn app_status(state: State<AppState>) -> AppResult<AppStatus> {
    Ok(AppStatus {
        library: state.library_info(),
        startup_error: state.startup_error.lock().map(|mut e| e.take()).unwrap_or(None),
        default_location: library::resolve_location(&state.default_root)?,
    })
}

#[tauri::command]
pub fn resolve_library_location(path: PathBuf) -> AppResult<LibraryLocation> {
    library::resolve_location(&path)
}

#[tauri::command]
pub fn open_library(state: State<AppState>, path: PathBuf) -> AppResult<LibraryInfo> {
    state.open_library(&path)
}

#[tauri::command]
pub fn view_counts(state: State<AppState>) -> AppResult<ViewCounts> {
    state.with_library(|lib| views::counts(&lib.conn))
}

// ── Sezioni ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_sections(state: State<AppState>) -> AppResult<Vec<Section>> {
    state.with_library(|lib| sections::list(&lib.conn))
}

#[tauri::command]
pub fn create_section(state: State<AppState>, name: String, parent_id: Option<i64>) -> AppResult<Section> {
    state.with_library(|lib| sections::create(&lib.conn, &name, parent_id))
}

#[tauri::command]
pub fn rename_section(state: State<AppState>, id: i64, name: String) -> AppResult<()> {
    state.with_library(|lib| sections::rename(&lib.conn, id, &name))
}

#[tauri::command]
pub fn move_section(state: State<AppState>, id: i64, parent_id: Option<i64>, index: usize) -> AppResult<()> {
    state.with_library(|lib| sections::move_to(&mut lib.conn, id, parent_id, index))
}

#[tauri::command]
pub fn section_delete_preview(state: State<AppState>, id: i64) -> AppResult<DeletePreview> {
    state.with_library(|lib| sections::delete_preview(&lib.conn, id))
}

#[tauri::command]
pub fn delete_section(state: State<AppState>, id: i64) -> AppResult<()> {
    state.with_library(|lib| sections::delete(&lib.conn, id))
}

// ── Tag ─────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_tags(state: State<AppState>) -> AppResult<Vec<Tag>> {
    state.with_library(|lib| tags::list(&lib.conn))
}

#[tauri::command]
pub fn create_tag(state: State<AppState>, name: String, color: String) -> AppResult<Tag> {
    state.with_library(|lib| tags::create(&lib.conn, &name, &color))
}

#[tauri::command]
pub fn update_tag(state: State<AppState>, id: i64, name: String, color: String) -> AppResult<()> {
    state.with_library(|lib| tags::update(&lib.conn, id, &name, &color))
}

#[tauri::command]
pub fn delete_tag(state: State<AppState>, id: i64) -> AppResult<()> {
    state.with_library(|lib| tags::delete(&lib.conn, id))
}
