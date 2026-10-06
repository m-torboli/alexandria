//! Importazione dei PDF nella libreria, in due fasi:
//! 1. `stage` copia il file e ne calcola l'impronta (lento, senza bloccare il database);
//! 2. `commit` registra l'articolo, oppure riconosce un duplicato e scarta la copia.

use std::{
    fs,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

use rusqlite::{params, OptionalExtension};
use serde::Serialize;

use crate::{
    articles,
    error::{AppError, AppResult},
    files,
    library::Library,
    search,
};

const STAGING_PREFIX: &str = ".importing-";

/// Copia temporanea di un PDF in attesa di essere registrata.
pub struct Staged {
    temp: PathBuf,
    hash: String,
    size: u64,
    title: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ImportStatus {
    Added,
    Duplicate,
    DuplicateInTrash,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportOutcome {
    pub article_id: i64,
    pub status: ImportStatus,
}

pub fn stage(source: &Path, pdf_dir: &Path) -> AppResult<Staged> {
    let is_pdf = source
        .extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("pdf"));
    if !is_pdf {
        return Err(AppError::invalid("Si possono aggiungere solo file PDF."));
    }
    if !source.is_file() {
        return Err(AppError::invalid("Il file non esiste più."));
    }

    let temp = pdf_dir.join(staging_name());
    match files::copy_with_hash(source, &temp) {
        Ok((hash, size)) => Ok(Staged { temp, hash, size, title: files::title_from_file_name(source) }),
        Err(e) => {
            let _ = fs::remove_file(&temp);
            Err(e)
        }
    }
}

pub fn commit(lib: &mut Library, staged: Staged, section_id: Option<i64>) -> AppResult<ImportOutcome> {
    let result = register(lib, &staged, section_id);
    // In ogni caso la copia temporanea non deve restare: o è stata rinominata, o va eliminata.
    let _ = fs::remove_file(&staged.temp);
    result
}

fn register(lib: &mut Library, staged: &Staged, section_id: Option<i64>) -> AppResult<ImportOutcome> {
    let pdf_dir = lib.pdf_dir();
    if staged.temp.parent() != Some(pdf_dir.as_path()) {
        return Err(AppError::invalid("La libreria è cambiata durante l'importazione. Riprova."));
    }

    let existing: Option<(i64, bool)> = lib
        .conn
        .query_row(
            "SELECT id, deleted_at IS NOT NULL FROM articles WHERE file_hash = ?1",
            [&staged.hash],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;
    if let Some((article_id, in_trash)) = existing {
        if let (Some(section), false) = (section_id, in_trash) {
            articles::add_to_section(&lib.conn, article_id, section)?;
        }
        let status = if in_trash { ImportStatus::DuplicateInTrash } else { ImportStatus::Duplicate };
        return Ok(ImportOutcome { article_id, status });
    }

    let stem = Some(files::sanitize_stem(&staged.title)).filter(|s| !s.is_empty()).unwrap_or_else(|| "Articolo".into());
    let target = files::unique_pdf_path(&pdf_dir, &stem, None);
    let file_name = target
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .ok_or_else(|| AppError::invalid("Nome di file non valido."))?;
    fs::rename(&staged.temp, &target)?;

    let tx = lib.conn.transaction()?;
    let inserted = (|| -> AppResult<i64> {
        tx.execute(
            "INSERT INTO articles (title, file_name, file_hash, file_size) VALUES (?1, ?2, ?3, ?4)",
            params![staged.title, file_name, staged.hash, staged.size as i64],
        )?;
        let id = tx.last_insert_rowid();
        if let Some(section) = section_id {
            articles::add_to_section(&tx, id, section)?;
        }
        search::reindex(&tx, id)?;
        Ok(id)
    })();
    match inserted {
        Ok(article_id) => {
            tx.commit()?;
            Ok(ImportOutcome { article_id, status: ImportStatus::Added })
        }
        Err(e) => {
            drop(tx);
            let _ = fs::remove_file(&target);
            Err(e)
        }
    }
}

/// Rimuove copie temporanee rimaste da importazioni interrotte.
pub fn clean_staging(pdf_dir: &Path) {
    let Ok(entries) = fs::read_dir(pdf_dir) else { return };
    for entry in entries.flatten() {
        if entry.file_name().to_string_lossy().starts_with(STAGING_PREFIX) {
            let _ = fs::remove_file(entry.path());
        }
    }
}

fn staging_name() -> String {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    let n = COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{STAGING_PREFIX}{nanos}-{n}.pdf")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{articles::View, query, sections};

    fn setup() -> (tempfile::TempDir, Library, PathBuf) {
        let dir = tempfile::tempdir().unwrap();
        let lib = Library::open(&dir.path().join("lib")).unwrap();
        let source = dir.path().join("Smith_2020_paper.pdf");
        fs::write(&source, b"%PDF-1.7 articolo di prova").unwrap();
        (dir, lib, source)
    }

    fn import(lib: &mut Library, source: &Path, section: Option<i64>) -> ImportOutcome {
        let staged = stage(source, &lib.pdf_dir()).unwrap();
        commit(lib, staged, section).unwrap()
    }

    fn pdf_files(lib: &Library) -> Vec<String> {
        let mut names: Vec<_> = fs::read_dir(lib.pdf_dir())
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        names.sort();
        names
    }

    #[test]
    fn imports_into_section_with_provisional_title() {
        let (_dir, mut lib, source) = setup();
        let section = sections::create(&lib.conn, "Medicina", None).unwrap();

        let outcome = import(&mut lib, &source, Some(section.id));
        assert_eq!(outcome.status, ImportStatus::Added);

        let article = articles::get(&lib.conn, outcome.article_id).unwrap();
        assert_eq!(article.metadata.title, "Smith 2020 paper");
        assert_eq!(article.section_ids, [section.id]);
        assert!(!article.metadata_complete);
        assert_eq!(pdf_files(&lib), ["Smith 2020 paper.pdf"]);
        assert!(source.exists(), "l'originale non si tocca");
    }

    #[test]
    fn recognises_duplicates_and_cleans_up() {
        let (_dir, mut lib, source) = setup();
        let first = import(&mut lib, &source, None);
        let section = sections::create(&lib.conn, "S", None).unwrap();

        let second = import(&mut lib, &source, Some(section.id));
        assert_eq!(second.status, ImportStatus::Duplicate);
        assert_eq!(second.article_id, first.article_id);
        assert_eq!(pdf_files(&lib).len(), 1, "nessuna copia in più");
        assert_eq!(articles::get(&lib.conn, first.article_id).unwrap().section_ids, [section.id]);

        articles::move_to_trash(&lib.conn, &[first.article_id]).unwrap();
        assert_eq!(import(&mut lib, &source, None).status, ImportStatus::DuplicateInTrash);
        assert_eq!(query::list(&lib.conn, View::All, &Default::default()).unwrap().len(), 0);
    }

    #[test]
    fn same_name_different_content_gets_suffix() {
        let (dir, mut lib, source) = setup();
        import(&mut lib, &source, None);
        let other = dir.path().join("altra").join("Smith_2020_paper.pdf");
        fs::create_dir_all(other.parent().unwrap()).unwrap();
        fs::write(&other, b"%PDF-1.7 contenuto diverso").unwrap();
        import(&mut lib, &other, None);
        assert_eq!(pdf_files(&lib), ["Smith 2020 paper (2).pdf", "Smith 2020 paper.pdf"]);
    }

    #[test]
    fn rejects_non_pdf_and_leaves_nothing_behind() {
        let (dir, lib, _) = setup();
        let txt = dir.path().join("note.txt");
        fs::write(&txt, "ciao").unwrap();
        assert!(stage(&txt, &lib.pdf_dir()).is_err());

        let fake = dir.path().join("finto.pdf");
        fs::write(&fake, "non un pdf").unwrap();
        assert!(stage(&fake, &lib.pdf_dir()).is_err());
        assert!(pdf_files(&lib).is_empty());
    }

    #[test]
    fn stale_staging_files_are_removed() {
        let (_dir, lib, _) = setup();
        fs::write(lib.pdf_dir().join(".importing-1-0.pdf"), "x").unwrap();
        fs::write(lib.pdf_dir().join("vero.pdf"), "x").unwrap();
        clean_staging(&lib.pdf_dir());
        assert_eq!(pdf_files(&lib), ["vero.pdf"]);
    }
}
