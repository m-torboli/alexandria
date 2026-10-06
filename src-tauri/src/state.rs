use std::{
    path::{Path, PathBuf},
    sync::{Mutex, MutexGuard},
};

use crate::{
    error::{AppError, AppResult},
    library::{Library, LibraryInfo},
    settings::Settings,
};

/// Stato condiviso tra i comandi: la libreria aperta (se c'è) e dove stanno
/// le preferenze locali.
pub struct AppState {
    library: Mutex<Option<Library>>,
    settings_path: PathBuf,
    pub default_root: PathBuf,
    /// Errore incontrato all'avvio riaprendo l'ultima libreria, da mostrare una volta.
    pub startup_error: Mutex<Option<String>>,
}

impl AppState {
    /// Prepara lo stato riaprendo, se possibile, l'ultima libreria usata.
    pub fn initialize(settings_path: PathBuf, default_root: PathBuf) -> Self {
        let settings = Settings::load(&settings_path);
        let (library, startup_error) = match settings.library_path {
            Some(path) => match Library::open(&path) {
                Ok(library) => (Some(library), None),
                Err(e) => (
                    None,
                    Some(format!("Impossibile aprire la libreria in “{}”. {e}", path.display())),
                ),
            },
            None => (None, None),
        };
        Self {
            library: Mutex::new(library),
            settings_path,
            default_root,
            startup_error: Mutex::new(startup_error),
        }
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

    /// Apre la libreria in `root`, la rende quella attiva e la ricorda.
    pub fn open_library(&self, root: &Path) -> AppResult<LibraryInfo> {
        let library = Library::open(root)?;
        let info = library.info();
        Settings {
            library_path: Some(root.to_path_buf()),
        }
        .save(&self.settings_path)?;
        *self.guard() = Some(library);
        Ok(info)
    }
}
