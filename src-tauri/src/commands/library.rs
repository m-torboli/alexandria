use std::path::PathBuf;

use serde::Serialize;
use tauri::State;

use crate::{
    error::AppResult,
    library::{self, LibraryInfo, LibraryLocation},
    state::{AppState, OpenOutcome, StartupIssue},
    views::{self, ViewCounts},
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppStatus {
    library: Option<LibraryInfo>,
    startup_issue: Option<StartupIssue>,
    default_location: LibraryLocation,
}

#[tauri::command]
pub fn app_status(state: State<AppState>) -> AppResult<AppStatus> {
    Ok(AppStatus {
        library: state.library_info(),
        startup_issue: state.take_startup_issue(),
        default_location: library::resolve_location(&state.default_root)?,
    })
}

#[tauri::command]
pub fn resolve_library_location(path: PathBuf) -> AppResult<LibraryLocation> {
    library::resolve_location(&path)
}

#[tauri::command]
pub fn open_library(state: State<AppState>, path: PathBuf, force: Option<bool>) -> AppResult<OpenOutcome> {
    state.open_library(&path, force.unwrap_or(false))
}

#[tauri::command]
pub fn view_counts(state: State<AppState>) -> AppResult<ViewCounts> {
    state.with_library(|lib| views::counts(&lib.conn))
}
