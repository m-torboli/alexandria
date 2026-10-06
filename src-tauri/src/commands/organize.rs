//! Sezioni e tag.

use tauri::State;

use crate::{
    error::AppResult,
    sections::{self, DeletePreview, Section},
    state::AppState,
    tags::{self, Tag},
};

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
