//! Articoli: elenco per vista, dettaglio, metadati, organizzazione e Cestino.

use std::{collections::HashMap, fs};

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::{
    error::{AppError, AppResult},
    files,
    library::Library,
    metadata, search,
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Author {
    pub family: String,
    pub given: String,
}

/// Dati bibliografici modificabili di un articolo.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Metadata {
    pub title: String,
    pub authors: Vec<Author>,
    pub year: Option<i64>,
    pub journal: Option<String>,
    pub volume: Option<String>,
    pub issue: Option<String>,
    pub pages: Option<String>,
    pub publisher: Option<String>,
    pub doi: Option<String>,
    pub url: Option<String>,
    #[serde(rename = "abstract")]
    pub abstract_text: Option<String>,
}

/// Riga dell'elenco articoli.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArticleSummary {
    pub id: i64,
    pub title: String,
    pub authors: Vec<Author>,
    pub year: Option<i64>,
    pub journal: Option<String>,
    pub reading_status: i64,
    pub favorite: bool,
    pub metadata_complete: bool,
    pub added_at: String,
    pub deleted_at: Option<String>,
    /// Durante una ricerca: estratto del testo in cui compaiono i termini,
    /// con i termini racchiusi tra i caratteri \u{2} e \u{3}.
    pub snippet: Option<String>,
}

/// Articolo completo, per il pannello di dettaglio.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Article {
    pub id: i64,
    #[serde(flatten)]
    pub metadata: Metadata,
    pub reading_status: i64,
    pub favorite: bool,
    pub metadata_complete: bool,
    pub notes: String,
    pub file_name: Option<String>,
    pub file_size: Option<i64>,
    pub page_count: Option<i64>,
    pub added_at: String,
    pub modified_at: String,
    pub deleted_at: Option<String>,
    pub section_ids: Vec<i64>,
    pub tag_ids: Vec<i64>,
}

/// Viste della barra laterale.
#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum View {
    All,
    ToRead,
    Favorites,
    Incomplete,
    Unclassified,
    Trash,
    Section { id: i64 },
    Tag { id: i64 },
}

const NOW: &str = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

// ── Lettura ─────────────────────────────────────────────────────────────────

pub fn get(conn: &Connection, id: i64) -> AppResult<Article> {
    let mut article = conn
        .query_row(
            "SELECT id, title, year, journal, volume, issue, pages, publisher, doi, url, abstract,
                    reading_status, favorite, metadata_complete, notes, file_name, file_size, page_count,
                    added_at, modified_at, deleted_at
             FROM articles WHERE id = ?1",
            [id],
            |r| {
                Ok(Article {
                    id: r.get(0)?,
                    metadata: Metadata {
                        title: r.get(1)?,
                        authors: Vec::new(),
                        year: r.get(2)?,
                        journal: r.get(3)?,
                        volume: r.get(4)?,
                        issue: r.get(5)?,
                        pages: r.get(6)?,
                        publisher: r.get(7)?,
                        doi: r.get(8)?,
                        url: r.get(9)?,
                        abstract_text: r.get(10)?,
                    },
                    reading_status: r.get(11)?,
                    favorite: r.get(12)?,
                    metadata_complete: r.get(13)?,
                    notes: r.get(14)?,
                    file_name: r.get(15)?,
                    file_size: r.get(16)?,
                    page_count: r.get(17)?,
                    added_at: r.get(18)?,
                    modified_at: r.get(19)?,
                    deleted_at: r.get(20)?,
                    section_ids: Vec::new(),
                    tag_ids: Vec::new(),
                })
            },
        )
        .optional()?
        .ok_or(AppError::NotFound)?;

    article.metadata.authors = authors_of(conn, id)?;
    article.section_ids = ids(conn, "SELECT section_id FROM article_sections WHERE article_id = ?1", id)?;
    article.tag_ids = ids(conn, "SELECT tag_id FROM article_tags WHERE article_id = ?1", id)?;
    Ok(article)
}

pub(crate) fn authors_by_article(conn: &Connection) -> AppResult<HashMap<i64, Vec<Author>>> {
    let mut stmt = conn.prepare_cached(
        "SELECT aa.article_id, au.family, au.given
         FROM article_authors aa JOIN authors au ON au.id = aa.author_id
         ORDER BY aa.article_id, aa.position",
    )?;
    let mut map: HashMap<i64, Vec<Author>> = HashMap::new();
    for row in stmt.query_map([], |r| Ok((r.get(0)?, Author { family: r.get(1)?, given: r.get(2)? })))? {
        let (article_id, author) = row?;
        map.entry(article_id).or_default().push(author);
    }
    Ok(map)
}

fn authors_of(conn: &Connection, id: i64) -> AppResult<Vec<Author>> {
    let mut stmt = conn.prepare_cached(
        "SELECT au.family, au.given FROM article_authors aa JOIN authors au ON au.id = aa.author_id
         WHERE aa.article_id = ?1 ORDER BY aa.position",
    )?;
    let authors = stmt
        .query_map([id], |r| Ok(Author { family: r.get(0)?, given: r.get(1)? }))?
        .collect::<Result<_, _>>()?;
    Ok(authors)
}

fn ids(conn: &Connection, sql: &str, id: i64) -> AppResult<Vec<i64>> {
    let mut stmt = conn.prepare_cached(sql)?;
    let ids = stmt.query_map([id], |r| r.get(0))?.collect::<Result<_, _>>()?;
    Ok(ids)
}

fn ensure_exists(conn: &Connection, id: i64) -> AppResult<()> {
    let exists: bool = conn.query_row("SELECT EXISTS (SELECT 1 FROM articles WHERE id = ?1)", [id], |r| r.get(0))?;
    if exists {
        Ok(())
    } else {
        Err(AppError::NotFound)
    }
}

// ── Metadati ────────────────────────────────────────────────────────────────

/// Sostituisce i metadati, aggiorna lo stato "da completare" e rinomina il PDF.
pub fn update_metadata(lib: &mut Library, id: i64, metadata: Metadata) -> AppResult<Article> {
    let m = normalize(metadata);
    let complete = !m.title.is_empty() && !m.authors.is_empty() && m.year.is_some();

    let tx = lib.conn.transaction()?;
    let changed = tx.execute(
        &format!(
            "UPDATE articles SET title = ?2, year = ?3, journal = ?4, volume = ?5, issue = ?6, pages = ?7,
                    publisher = ?8, doi = ?9, url = ?10, abstract = ?11, metadata_complete = ?12,
                    modified_at = {NOW}
             WHERE id = ?1"
        ),
        params![
            id, m.title, m.year, m.journal, m.volume, m.issue, m.pages, m.publisher, m.doi, m.url,
            m.abstract_text, complete
        ],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound);
    }
    replace_authors(&tx, id, &m.authors)?;
    search::reindex(&tx, id)?;
    tx.commit()?;

    rename_file(lib, id);
    get(&lib.conn, id)
}

/// Unisce i metadati scaricati a quelli esistenti: i dati nuovi prevalgono,
/// quelli mancanti nella fonte restano come erano.
pub fn apply_fetched(lib: &mut Library, id: i64, fetched: Metadata) -> AppResult<Article> {
    let current = get(&lib.conn, id)?.metadata;
    let merged = Metadata {
        title: Some(fetched.title).filter(|t| !t.trim().is_empty()).unwrap_or(current.title),
        authors: Some(fetched.authors).filter(|a| !a.is_empty()).unwrap_or(current.authors),
        year: fetched.year.or(current.year),
        journal: fetched.journal.or(current.journal),
        volume: fetched.volume.or(current.volume),
        issue: fetched.issue.or(current.issue),
        pages: fetched.pages.or(current.pages),
        publisher: fetched.publisher.or(current.publisher),
        doi: fetched.doi.or(current.doi),
        url: fetched.url.or(current.url),
        abstract_text: fetched.abstract_text.or(current.abstract_text),
    };
    update_metadata(lib, id, merged)
}

/// Salva il testo estratto dal PDF e, se l'articolo non ha ancora dati
/// affidabili, il titolo suggerito dai metadati interni del PDF.
pub fn save_pdf_info(
    lib: &mut Library,
    id: i64,
    text: &str,
    page_count: Option<i64>,
    suggested_title: Option<&str>,
) -> AppResult<Article> {
    ensure_exists(&lib.conn, id)?;
    lib.conn.execute(
        "INSERT INTO article_text (article_id, content) VALUES (?1, ?2)
         ON CONFLICT (article_id) DO UPDATE SET content = excluded.content",
        params![id, text],
    )?;
    lib.conn.execute("UPDATE articles SET page_count = ?2 WHERE id = ?1", params![id, page_count])?;
    search::reindex(&lib.conn, id)?;

    let article = get(&lib.conn, id)?;
    match suggested_title.map(str::trim).filter(|t| !t.is_empty()) {
        Some(title) if !article.metadata_complete => {
            update_metadata(lib, id, Metadata { title: title.to_string(), ..article.metadata })
        }
        _ => Ok(article),
    }
}

fn normalize(m: Metadata) -> Metadata {
    let clean = |s: Option<String>| s.map(|s| collapse(&s)).filter(|s| !s.is_empty());
    Metadata {
        title: collapse(&m.title),
        authors: m
            .authors
            .into_iter()
            .map(|a| Author { family: collapse(&a.family), given: collapse(&a.given) })
            .filter(|a| !a.family.is_empty())
            .collect(),
        year: m.year.filter(|y| (1000..=9999).contains(y)),
        journal: clean(m.journal),
        volume: clean(m.volume),
        issue: clean(m.issue),
        pages: clean(m.pages),
        publisher: clean(m.publisher),
        doi: m.doi.as_deref().and_then(metadata::normalize_doi),
        url: clean(m.url),
        abstract_text: m.abstract_text.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
    }
}

fn collapse(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn replace_authors(conn: &Connection, id: i64, authors: &[Author]) -> AppResult<()> {
    conn.execute("DELETE FROM article_authors WHERE article_id = ?1", [id])?;
    for (position, author) in authors.iter().enumerate() {
        conn.execute(
            "INSERT INTO authors (family, given) VALUES (?1, ?2) ON CONFLICT (family, given) DO NOTHING",
            params![author.family, author.given],
        )?;
        conn.execute(
            "INSERT INTO article_authors (article_id, author_id, position)
             SELECT ?1, id, ?3 FROM authors WHERE family = ?2 AND given = ?4",
            params![id, author.family, position as i64, author.given],
        )?;
    }
    remove_orphan_authors(conn)
}

fn remove_orphan_authors(conn: &Connection) -> AppResult<()> {
    conn.execute(
        "DELETE FROM authors WHERE NOT EXISTS (SELECT 1 FROM article_authors aa WHERE aa.author_id = authors.id)",
        [],
    )?;
    Ok(())
}

/// Allinea il nome del PDF ai metadati ("2021 - Rossi - Titolo.pdf").
/// È un'operazione di cortesia: se non riesce (file aperto altrove, permessi…)
/// il vecchio nome resta valido e nulla si rompe.
fn rename_file(lib: &mut Library, id: i64) {
    let Ok(article) = get(&lib.conn, id) else { return };
    let Some(current) = article.file_name else { return };
    let first_author = article.metadata.authors.first().map(|a| a.family.as_str());
    let Some(stem) = files::readable_stem(article.metadata.year, first_author, &article.metadata.title) else {
        return;
    };

    let dir = lib.pdf_dir();
    let target = files::unique_pdf_path(&dir, &stem, Some(&current));
    let Some(target_name) = target.file_name().map(|n| n.to_string_lossy().into_owned()) else { return };
    if target_name == current || fs::rename(dir.join(&current), &target).is_err() {
        return;
    }
    if lib
        .conn
        .execute("UPDATE articles SET file_name = ?2 WHERE id = ?1", params![id, target_name])
        .is_err()
    {
        // Il database non ricorda il nuovo nome: si rimette il file com'era.
        let _ = fs::rename(&target, dir.join(&current));
    }
}

// ── Organizzazione ──────────────────────────────────────────────────────────

pub fn set_reading_status(conn: &Connection, id: i64, status: i64) -> AppResult<()> {
    if !(0..=2).contains(&status) {
        return Err(AppError::invalid("Stato di lettura non valido."));
    }
    update_one(conn, id, "reading_status = ?2", status)
}

pub fn set_favorite(conn: &Connection, id: i64, favorite: bool) -> AppResult<()> {
    update_one(conn, id, "favorite = ?2", favorite)
}

/// Note personali: si salvano spesso (mentre si scrive), restano cercabili.
pub fn set_notes(conn: &Connection, id: i64, notes: &str) -> AppResult<()> {
    update_one(conn, id, "notes = ?2", notes)?;
    search::reindex(conn, id)
}

fn update_one(conn: &Connection, id: i64, assignment: &str, value: impl rusqlite::ToSql) -> AppResult<()> {
    let sql = format!("UPDATE articles SET {assignment}, modified_at = {NOW} WHERE id = ?1");
    if conn.execute(&sql, params![id, value])? == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

pub fn set_sections(conn: &mut Connection, id: i64, section_ids: &[i64]) -> AppResult<()> {
    replace_links(conn, id, "article_sections", "section_id", section_ids)
}

pub fn set_tags(conn: &mut Connection, id: i64, tag_ids: &[i64]) -> AppResult<()> {
    replace_links(conn, id, "article_tags", "tag_id", tag_ids)
}

pub fn add_to_section(conn: &Connection, id: i64, section_id: i64) -> AppResult<()> {
    conn.execute(
        "INSERT INTO article_sections (article_id, section_id) VALUES (?1, ?2) ON CONFLICT DO NOTHING",
        params![id, section_id],
    )?;
    Ok(())
}

fn replace_links(conn: &mut Connection, id: i64, table: &str, column: &str, targets: &[i64]) -> AppResult<()> {
    let tx = conn.transaction()?;
    ensure_exists(&tx, id)?;
    tx.execute(&format!("DELETE FROM {table} WHERE article_id = ?1"), [id])?;
    for target in targets {
        tx.execute(
            &format!("INSERT INTO {table} (article_id, {column}) VALUES (?1, ?2) ON CONFLICT DO NOTHING"),
            params![id, target],
        )
        .map_err(|e| match e {
            rusqlite::Error::SqliteFailure(f, _) if f.code == rusqlite::ErrorCode::ConstraintViolation => {
                AppError::NotFound
            }
            e => e.into(),
        })?;
    }
    tx.commit()?;
    Ok(())
}

// ── Cestino ─────────────────────────────────────────────────────────────────

pub fn move_to_trash(conn: &Connection, ids: &[i64]) -> AppResult<()> {
    for id in ids {
        conn.execute(&format!("UPDATE articles SET deleted_at = {NOW} WHERE id = ?1 AND deleted_at IS NULL"), [id])?;
    }
    Ok(())
}

pub fn restore(conn: &Connection, ids: &[i64]) -> AppResult<()> {
    for id in ids {
        conn.execute("UPDATE articles SET deleted_at = NULL WHERE id = ?1", [id])?;
    }
    Ok(())
}

/// Elimina definitivamente articoli e PDF. Agisce solo su articoli già nel Cestino.
pub fn delete_forever(lib: &mut Library, ids: &[i64]) -> AppResult<()> {
    let dir = lib.pdf_dir();
    let tx = lib.conn.transaction()?;
    let mut files_to_remove = Vec::new();
    for id in ids {
        let file: Option<Option<String>> = tx
            .query_row(
                "DELETE FROM articles WHERE id = ?1 AND deleted_at IS NOT NULL RETURNING file_name",
                [id],
                |r| r.get(0),
            )
            .optional()?;
        if let Some(file) = file {
            search::remove(&tx, *id)?;
            if let Some(name) = file {
                files_to_remove.push(dir.join(name));
            }
        }
    }
    remove_orphan_authors(&tx)?;
    tx.commit()?;

    // Prima il database, poi i file: un file rimasto è innocuo, un riferimento a un file sparito no.
    for path in files_to_remove {
        let _ = fs::remove_file(path);
    }
    Ok(())
}

pub fn empty_trash(lib: &mut Library) -> AppResult<()> {
    let ids: Vec<i64> = lib
        .conn
        .prepare("SELECT id FROM articles WHERE deleted_at IS NOT NULL")?
        .query_map([], |r| r.get(0))?
        .collect::<Result<_, _>>()?;
    delete_forever(lib, &ids)
}

/// Percorso del PDF di un articolo.
pub fn file_path(lib: &Library, id: i64) -> AppResult<std::path::PathBuf> {
    let name: Option<String> = lib
        .conn
        .query_row("SELECT file_name FROM articles WHERE id = ?1", [id], |r| r.get(0))
        .optional()?
        .ok_or(AppError::NotFound)?;
    let path = lib.pdf_dir().join(name.ok_or_else(|| AppError::invalid("Questo articolo non ha un PDF."))?);
    if !path.is_file() {
        return Err(AppError::invalid("Il PDF di questo articolo non si trova più nella libreria."));
    }
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn library() -> (tempfile::TempDir, Library) {
        let dir = tempfile::tempdir().unwrap();
        let lib = Library::open(dir.path()).unwrap();
        (dir, lib)
    }

    fn insert(lib: &Library, file: &str) -> i64 {
        fs::write(lib.pdf_dir().join(file), b"%PDF-1.4").unwrap();
        lib.conn
            .execute("INSERT INTO articles (title, file_name) VALUES ('Provvisorio', ?1)", [file])
            .unwrap();
        lib.conn.last_insert_rowid()
    }

    fn sample() -> Metadata {
        Metadata {
            title: "  Deep   learning in cardiology ".into(),
            authors: vec![
                Author { family: "Rossi".into(), given: "Mario".into() },
                Author { family: " ".into(), given: "vuoto".into() },
                Author { family: "Bianchi".into(), given: "Luca".into() },
            ],
            year: Some(2021),
            journal: Some("  ".into()),
            doi: Some("https://doi.org/10.1000/ABC".into()),
            ..Default::default()
        }
    }

    #[test]
    fn update_normalizes_completes_and_renames() {
        let (_dir, mut lib) = library();
        let id = insert(&lib, "scan_001.pdf");

        let article = update_metadata(&mut lib, id, sample()).unwrap();
        assert_eq!(article.metadata.title, "Deep learning in cardiology");
        assert_eq!(article.metadata.authors.len(), 2);
        assert_eq!(article.metadata.journal, None);
        assert_eq!(article.metadata.doi.as_deref(), Some("10.1000/ABC"));
        assert!(article.metadata_complete);
        assert_eq!(article.file_name.as_deref(), Some("2021 - Rossi - Deep learning in cardiology.pdf"));
        assert!(lib.pdf_dir().join("2021 - Rossi - Deep learning in cardiology.pdf").is_file());
        assert!(!lib.pdf_dir().join("scan_001.pdf").exists());

        // Un secondo aggiornamento identico non cambia il nome.
        let again = update_metadata(&mut lib, id, sample()).unwrap();
        assert_eq!(again.file_name, article.file_name);
    }

    #[test]
    fn incomplete_without_authors_or_year() {
        let (_dir, mut lib) = library();
        let id = insert(&lib, "a.pdf");
        let article = update_metadata(&mut lib, id, Metadata { title: "Solo titolo".into(), ..Default::default() }).unwrap();
        assert!(!article.metadata_complete);
    }

    #[test]
    fn fetched_metadata_keeps_existing_values_when_missing() {
        let (_dir, mut lib) = library();
        let id = insert(&lib, "a.pdf");
        update_metadata(&mut lib, id, Metadata { journal: Some("Nature".into()), ..sample() }).unwrap();

        let fetched = Metadata { title: "Titolo ufficiale".into(), year: Some(2022), ..Default::default() };
        let article = apply_fetched(&mut lib, id, fetched).unwrap();
        assert_eq!(article.metadata.title, "Titolo ufficiale");
        assert_eq!(article.metadata.year, Some(2022));
        assert_eq!(article.metadata.journal.as_deref(), Some("Nature"));
        assert_eq!(article.metadata.authors.len(), 2);
    }

    #[test]
    fn pdf_title_used_only_until_metadata_are_complete() {
        let (_dir, mut lib) = library();
        let id = insert(&lib, "a.pdf");
        let article = save_pdf_info(&mut lib, id, "testo", Some(3), Some("Titolo dal PDF")).unwrap();
        assert_eq!(article.metadata.title, "Titolo dal PDF");
        assert_eq!(article.page_count, Some(3));

        update_metadata(&mut lib, id, sample()).unwrap();
        let article = save_pdf_info(&mut lib, id, "testo", Some(3), Some("Altro titolo")).unwrap();
        assert_eq!(article.metadata.title, "Deep learning in cardiology");
    }

    #[test]
    fn notes_are_saved_and_searchable() {
        let (_dir, lib) = library();
        let id = insert(&lib, "a.pdf");
        search::reindex(&lib.conn, id).unwrap();
        set_notes(&lib.conn, id, "Metodo interessante: campione randomizzato").unwrap();
        assert_eq!(get(&lib.conn, id).unwrap().notes, "Metodo interessante: campione randomizzato");
        let found: i64 = lib
            .conn
            .query_row("SELECT rowid FROM articles_fts WHERE articles_fts MATCH 'randomizzato'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(found, id);
    }

    #[test]
    fn rejects_invalid_reading_status() {
        let (_dir, lib) = library();
        let id = insert(&lib, "a.pdf");
        assert!(set_reading_status(&lib.conn, id, 7).is_err());
        set_reading_status(&lib.conn, id, 1).unwrap();
    }

    #[test]
    fn delete_forever_only_from_trash_and_removes_file() {
        let (_dir, mut lib) = library();
        let id = insert(&lib, "a.pdf");
        update_metadata(&mut lib, id, sample()).unwrap();
        let path = file_path(&lib, id).unwrap();

        delete_forever(&mut lib, &[id]).unwrap();
        assert!(get(&lib.conn, id).is_ok(), "fuori dal Cestino non si elimina");

        move_to_trash(&lib.conn, &[id]).unwrap();
        empty_trash(&mut lib).unwrap();
        assert!(matches!(get(&lib.conn, id), Err(AppError::NotFound)));
        assert!(!path.exists());
        let authors: i64 = lib.conn.query_row("SELECT COUNT(*) FROM authors", [], |r| r.get(0)).unwrap();
        assert_eq!(authors, 0);
    }

    #[test]
    fn links_reject_unknown_targets() {
        let (_dir, mut lib) = library();
        let id = insert(&lib, "a.pdf");
        assert!(matches!(set_tags(&mut lib.conn, id, &[999]), Err(AppError::NotFound)));
    }
}
