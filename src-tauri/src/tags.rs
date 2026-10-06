//! Tag: etichette colorate e trasversali alle sezioni.

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use crate::error::{AppError, AppResult};

/// Colori disponibili. L'interfaccia li traduce nella tinta adatta al tema.
pub const COLORS: [&str; 8] = ["red", "orange", "yellow", "green", "teal", "blue", "purple", "gray"];
const MAX_NAME_LEN: usize = 60;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Tag {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub article_count: i64,
}

pub fn list(conn: &Connection) -> AppResult<Vec<Tag>> {
    let mut stmt = conn.prepare_cached(
        "SELECT t.id, t.name, t.color,
                (SELECT COUNT(*) FROM article_tags x
                 JOIN articles a ON a.id = x.article_id AND a.deleted_at IS NULL
                 WHERE x.tag_id = t.id)
         FROM tags t
         ORDER BY t.name COLLATE NOCASE",
    )?;
    let tags = stmt
        .query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                article_count: row.get(3)?,
            })
        })?
        .collect::<Result<_, _>>()?;
    Ok(tags)
}

pub fn create(conn: &Connection, name: &str, color: &str) -> AppResult<Tag> {
    let name = normalize_name(name)?;
    ensure_color(color)?;
    ensure_unique_name(conn, &name, None)?;
    conn.execute("INSERT INTO tags (name, color) VALUES (?1, ?2)", params![name, color])?;
    let id = conn.last_insert_rowid();
    list(conn)?.into_iter().find(|t| t.id == id).ok_or(AppError::NotFound)
}

pub fn update(conn: &Connection, id: i64, name: &str, color: &str) -> AppResult<()> {
    let name = normalize_name(name)?;
    ensure_color(color)?;
    ensure_unique_name(conn, &name, Some(id))?;
    let changed = conn.execute(
        "UPDATE tags SET name = ?2, color = ?3 WHERE id = ?1",
        params![id, name, color],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

pub fn delete(conn: &Connection, id: i64) -> AppResult<()> {
    if conn.execute("DELETE FROM tags WHERE id = ?1", [id])? == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

fn normalize_name(name: &str) -> AppResult<String> {
    let name = name.split_whitespace().collect::<Vec<_>>().join(" ");
    if name.is_empty() {
        return Err(AppError::invalid("Il nome del tag non può essere vuoto."));
    }
    if name.chars().count() > MAX_NAME_LEN {
        return Err(AppError::invalid(format!(
            "Il nome del tag può contenere al massimo {MAX_NAME_LEN} caratteri."
        )));
    }
    Ok(name)
}

fn ensure_color(color: &str) -> AppResult<()> {
    if COLORS.contains(&color) {
        Ok(())
    } else {
        Err(AppError::invalid("Colore non valido."))
    }
}

fn ensure_unique_name(conn: &Connection, name: &str, exclude: Option<i64>) -> AppResult<()> {
    let existing: Option<i64> = conn
        .query_row(
            "SELECT id FROM tags WHERE name = ?1 COLLATE NOCASE AND id IS NOT ?2",
            params![name, exclude],
            |r| r.get(0),
        )
        .optional()?;
    if existing.is_some() {
        return Err(AppError::invalid(format!("Esiste già un tag chiamato “{name}”.")));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    #[test]
    fn crud() {
        let conn = db::open_in_memory().unwrap();
        let review = create(&conn, "review", "blue").unwrap();
        create(&conn, "Metodologia", "green").unwrap();

        let names: Vec<_> = list(&conn).unwrap().into_iter().map(|t| t.name).collect();
        assert_eq!(names, ["Metodologia", "review"]);

        assert!(create(&conn, "Review", "red").is_err());
        assert!(create(&conn, "nuovo", "fucsia").is_err());

        update(&conn, review.id, "Review", "purple").unwrap();
        let updated = list(&conn).unwrap().into_iter().find(|t| t.id == review.id).unwrap();
        assert_eq!((updated.name.as_str(), updated.color.as_str()), ("Review", "purple"));

        delete(&conn, review.id).unwrap();
        assert_eq!(list(&conn).unwrap().len(), 1);
        assert!(matches!(delete(&conn, review.id), Err(AppError::NotFound)));
    }
}
