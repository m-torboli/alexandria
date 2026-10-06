use std::{
    path::{Path, PathBuf},
    sync::{Mutex, MutexGuard},
};

use serde::Serialize;

use crate::{
    error::{AppError, AppResult},
    library::{Library, LibraryInfo},
    lock::{self, InUse},
    settings::Settings,
};

/// Stato condiviso tra i comandi: la libreria aperta (se c'è) e dove stanno
/// le preferenze locali.
pub struct AppState {
    library: Mutex<Option<Library>>,
    settings_path: PathBuf,
    pub default_root: PathBuf,
    /// Problema incontrato all'avvio riaprendo l'ultima libreria, da mostrare una volta.
    startup_issue: Mutex<Option<StartupIssue>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum StartupIssue {
    /// La libreria non si è potuta aprire.
    Error { path: String, message: String },
    /// La libreria risulta aperta su un altro computer: si chiede all'utente.
    InUse { path: String, device: String, minutes_ago: u64 },
}

/// Esito dell'apertura di una libreria.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "status", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum OpenOutcome {
    Opened { library: LibraryInfo },
    InUse { device: String, minutes_ago: u64 },
}

impl AppState {
    /// Prepara lo stato riaprendo, se possibile, l'ultima libreria usata.
    pub fn initialize(settings_path: PathBuf, default_root: PathBuf) -> Self {
        let state = Self {
            library: Mutex::new(None),
            settings_path,
            default_root,
            startup_issue: Mutex::new(None),
        };
        if let Some(path) = Settings::load(&state.settings_path).library_path {
            let issue = match state.open_library(&path, false) {
                Ok(OpenOutcome::Opened { .. }) => None,
                Ok(OpenOutcome::InUse { device, minutes_ago }) => {
                    Some(StartupIssue::InUse { path: path.display().to_string(), device, minutes_ago })
                }
                Err(e) => Some(StartupIssue::Error { path: path.display().to_string(), message: e.to_string() }),
            };
            *state.startup_issue.lock().unwrap_or_else(|p| p.into_inner()) = issue;
        }
        state
    }

    fn guard(&self) -> MutexGuard<'_, Option<Library>> {
        // Un panic in un altro comando non deve bloccare l'app per sempre.
        self.library.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    /// Esegue `f` sulla libreria aperta.
    pub fn with_library<T>(&self, f: impl FnOnce(&mut Library) -> AppResult<T>) -> AppResult<T> {
        let mut guard = self.guard();
        let library = guard.as_mut().ok_or(AppError::NoLibrary)?;
        f(library)
    }

    pub fn library_info(&self) -> Option<LibraryInfo> {
        self.guard().as_ref().map(Library::info)
    }

    pub fn take_startup_issue(&self) -> Option<StartupIssue> {
        self.startup_issue.lock().map(|mut i| i.take()).unwrap_or(None)
    }

    /// Apre la libreria in `root`, la rende quella attiva e la ricorda.
    /// Se risulta aperta su un altro computer non la apre, a meno di `force`.
    pub fn open_library(&self, root: &Path, force: bool) -> AppResult<OpenOutcome> {
        if !force {
            if let Some(InUse { device, minutes_ago }) = lock::in_use_elsewhere(root) {
                return Ok(OpenOutcome::InUse { device, minutes_ago });
            }
        }
        let library = Library::open(root)?;
        let info = library.info();
        Settings { library_path: Some(root.to_path_buf()) }.save(&self.settings_path)?;

        let previous = self.guard().replace(library);
        if let Some(previous) = previous {
            if previous.root != root {
                lock::release(&previous.root);
            }
        }
        lock::touch(root)?;
        Ok(OpenOutcome::Opened { library: info })
    }

    /// Rinnova il segnale "in uso" della libreria aperta.
    pub fn heartbeat(&self) {
        if let Some(library) = self.guard().as_ref() {
            let _ = lock::touch(&library.root);
        }
    }

    /// Chiusura dell'app: si toglie il segnale "in uso".
    pub fn shutdown(&self) {
        if let Some(library) = self.guard().take() {
            lock::release(&library.root);
        }
    }
}
