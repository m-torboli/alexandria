use std::path::PathBuf;

use serde::Serialize;
use tauri::State;

use crate::{
    error::AppResult,
    library::{self, LibraryInfo, LibraryLocation},
    state::AppState,
    views::{self, ViewCounts},
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppStatus {
    library: Option<LibraryInfo>,
    startup_error: Option<String>,
    default_location: LibraryLocation,
}

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
