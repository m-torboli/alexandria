use std::{
    fs,
    path::{Path, PathBuf},
};

use rusqlite::Connection;
use serde::Serialize;

use crate::{db, error::AppResult};

pub const DB_FILE: &str = "alexandria.db";
pub const PDF_DIR: &str = "pdf";
pub const BACKUP_DIR: &str = "backup";
const DEFAULT_FOLDER_NAME: &str = "Alexandria";

/// Una libreria aperta: la sua cartella e la connessione al database.
pub struct Library {
    pub root: PathBuf,
    pub conn: Connection,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryInfo {
    pub path: String,
    pub name: String,
}

/// Dove verrebbe collocata la libreria e se lì ne esiste già una.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryLocation {
    pub path: String,
    pub exists: bool,
}

impl Library {
    /// Apre la libreria nella cartella indicata, creando la struttura se manca.
    pub fn open(root: &Path) -> AppResult<Self> {
        fs::create_dir_all(root.join(PDF_DIR))?;
        fs::create_dir_all(root.join(BACKUP_DIR))?;
        let conn = db::open(&root.join(DB_FILE))?;
        Ok(Self {
            root: root.to_path_buf(),
            conn,
        })
    }

    pub fn info(&self) -> LibraryInfo {
        LibraryInfo {
            path: self.root.display().to_string(),
            name: self
                .root
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| DEFAULT_FOLDER_NAME.to_owned()),
        }
    }
}

pub fn default_root(documents_dir: &Path) -> PathBuf {
    documents_dir.join(DEFAULT_FOLDER_NAME)
}

/// Stabilisce dove collocare la libreria a partire dalla cartella scelta:
/// - se contiene già una libreria, si usa quella;
/// - se è vuota (o non esiste ancora), la libreria va direttamente lì;
/// - altrimenti si crea una sottocartella "Alexandria", per non mescolare
///   i file della libreria con quelli già presenti.
pub fn resolve_location(chosen: &Path) -> AppResult<LibraryLocation> {
    let root = if is_library(chosen) || is_empty_or_missing(chosen)? {
        chosen.to_path_buf()
    } else {
        chosen.join(DEFAULT_FOLDER_NAME)
    };
    Ok(LibraryLocation {
        exists: is_library(&root),
        path: root.display().to_string(),
    })
}

fn is_library(dir: &Path) -> bool {
    dir.join(DB_FILE).is_file()
}

fn is_empty_or_missing(dir: &Path) -> AppResult<bool> {
    match fs::read_dir(dir) {
        Ok(mut entries) => Ok(entries.next().is_none()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(true),
        Err(e) => Err(e.into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn open_creates_structure() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("Biblioteca");
        let library = Library::open(&root).unwrap();

        assert!(root.join(DB_FILE).is_file());
        assert!(root.join(PDF_DIR).is_dir());
        assert!(root.join(BACKUP_DIR).is_dir());
        assert_eq!(library.info().name, "Biblioteca");
    }

    #[test]
    fn resolve_uses_empty_or_missing_folder_directly() {
        let dir = tempfile::tempdir().unwrap();
        let loc = resolve_location(dir.path()).unwrap();
        assert_eq!(PathBuf::from(&loc.path), dir.path());
        assert!(!loc.exists);

        let missing = dir.path().join("nuova");
        let loc = resolve_location(&missing).unwrap();
        assert_eq!(PathBuf::from(&loc.path), missing);
    }

    #[test]
    fn resolve_uses_subfolder_for_busy_folder() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("altro.txt"), "x").unwrap();
        let loc = resolve_location(dir.path()).unwrap();
        assert_eq!(PathBuf::from(&loc.path), dir.path().join(DEFAULT_FOLDER_NAME));
    }

    #[test]
    fn resolve_recognises_existing_library() {
        let dir = tempfile::tempdir().unwrap();
        Library::open(dir.path()).unwrap();
        let loc = resolve_location(dir.path()).unwrap();
        assert_eq!(PathBuf::from(&loc.path), dir.path());
        assert!(loc.exists);

        // Anche scegliendo la cartella che la contiene.
        let parent = tempfile::tempdir().unwrap();
        Library::open(&parent.path().join(DEFAULT_FOLDER_NAME)).unwrap();
        let loc = resolve_location(parent.path()).unwrap();
        assert!(loc.exists);
    }
}
