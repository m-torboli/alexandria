//! Sezioni tematiche: un albero di cartelle virtuali. Un articolo può stare in
//! più sezioni; eliminare una sezione non elimina mai gli articoli.

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use crate::error::{AppError, AppResult};

const MAX_NAME_LEN: usize = 120;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Section {
    pub id: i64,
    pub parent_id: Option<i64>,
    pub name: String,
    pub position: i64,
    /// Articoli (non nel Cestino) nella sezione e nelle sue sottosezioni.
    pub article_count: i64,
}

/// Cosa comporterebbe eliminare una sezione.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletePreview {
    pub subsections: i64,
    pub articles: i64,
    /// Articoli che, senza questa sezione, finirebbero in "Non classificati".
    pub orphaned: i64,
}

/// Sottoalbero (sezione inclusa) della sezione `?1`.
const SUBTREE_CTE: &str = "
    WITH RECURSIVE subtree(id) AS (
        SELECT ?1
        UNION ALL
        SELECT s.id FROM sections s JOIN subtree ON s.parent_id = subtree.id
    )";

pub fn list(conn: &Connection) -> AppResult<Vec<Section>> {
    let mut stmt = conn.prepare_cached(
        "WITH RECURSIVE tree(ancestor, id) AS (
             SELECT id, id FROM sections
             UNION ALL
             SELECT tree.ancestor, s.id FROM sections s JOIN tree ON s.parent_id = tree.id
         ),
         counts AS (
             SELECT tree.ancestor AS id, COUNT(DISTINCT a.id) AS n
             FROM tree
             JOIN article_sections x ON x.section_id = tree.id
             JOIN articles a ON a.id = x.article_id AND a.deleted_at IS NULL
             GROUP BY tree.ancestor
         )
         SELECT s.id, s.parent_id, s.name, s.position, COALESCE(c.n, 0)
         FROM sections s LEFT JOIN counts c ON c.id = s.id
         ORDER BY s.parent_id, s.position, s.id",
    )?;
    let sections = stmt
        .query_map([], |row| {
            Ok(Section {
                id: row.get(0)?,
                parent_id: row.get(1)?,
                name: row.get(2)?,
                position: row.get(3)?,
                article_count: row.get(4)?,
            })
        })?
        .collect::<Result<_, _>>()?;
    Ok(sections)
}

pub fn get(conn: &Connection, id: i64) -> AppResult<Section> {
    list(conn)?
        .into_iter()
        .find(|s| s.id == id)
        .ok_or(AppError::NotFound)
}

pub fn create(conn: &Connection, name: &str, parent_id: Option<i64>) -> AppResult<Section> {
    let name = normalize_name(name)?;
    if let Some(parent) = parent_id {
        ensure_exists(conn, parent)?;
    }
    ensure_unique_name(conn, parent_id, &name, None)?;

    conn.execute(
        "INSERT INTO sections (parent_id, name, position)
         VALUES (?1, ?2, (SELECT COALESCE(MAX(position) + 1, 0) FROM sections WHERE parent_id IS ?1))",
        params![parent_id, name],
    )?;
    get(conn, conn.last_insert_rowid())
}

pub fn rename(conn: &Connection, id: i64, name: &str) -> AppResult<()> {
    let name = normalize_name(name)?;
    let parent_id = parent_of(conn, id)?;
    ensure_unique_name(conn, parent_id, &name, Some(id))?;
    conn.execute("UPDATE sections SET name = ?2 WHERE id = ?1", params![id, name])?;
    Ok(())
}

/// Sposta la sezione sotto `parent_id` (None = primo livello), alla posizione
/// `index` tra le sezioni sorelle.
pub fn move_to(conn: &mut Connection, id: i64, parent_id: Option<i64>, index: usize) -> AppResult<()> {
    let tx = conn.transaction()?;

    let name: String = tx
        .query_row("SELECT name FROM sections WHERE id = ?1", [id], |r| r.get(0))
        .optional()?
        .ok_or(AppError::NotFound)?;

    if let Some(parent) = parent_id {
        ensure_exists(&tx, parent)?;
        if parent == id || is_in_subtree(&tx, parent, id)? {
            return Err(AppError::invalid(
                "Una sezione non può essere spostata dentro sé stessa o una sua sottosezione.",
            ));
        }
    }
    ensure_unique_name(&tx, parent_id, &name, Some(id))?;

    let mut siblings: Vec<i64> = tx
        .prepare("SELECT id FROM sections WHERE parent_id IS ?1 AND id <> ?2 ORDER BY position, id")?
        .query_map(params![parent_id, id], |r| r.get(0))?
        .collect::<Result<_, _>>()?;
    siblings.insert(index.min(siblings.len()), id);

    tx.execute("UPDATE sections SET parent_id = ?2 WHERE id = ?1", params![id, parent_id])?;
    {
        let mut update = tx.prepare("UPDATE sections SET position = ?2 WHERE id = ?1")?;
        for (position, sibling) in siblings.iter().enumerate() {
            update.execute(params![sibling, position as i64])?;
        }
    }
    tx.commit()?;
    Ok(())
}

pub fn delete_preview(conn: &Connection, id: i64) -> AppResult<DeletePreview> {
    ensure_exists(conn, id)?;
    let sql = format!(
        "{SUBTREE_CTE},
         inside AS (
             SELECT DISTINCT x.article_id AS id
             FROM article_sections x
             JOIN subtree ON x.section_id = subtree.id
             JOIN articles a ON a.id = x.article_id AND a.deleted_at IS NULL
         )
         SELECT
             (SELECT COUNT(*) FROM subtree) - 1,
             (SELECT COUNT(*) FROM inside),
             (SELECT COUNT(*) FROM inside WHERE NOT EXISTS (
                 SELECT 1 FROM article_sections x
                 WHERE x.article_id = inside.id
                   AND x.section_id NOT IN (SELECT id FROM subtree)
             ))"
    );
    let preview = conn.query_row(&sql, [id], |r| {
        Ok(DeletePreview {
            subsections: r.get(0)?,
            articles: r.get(1)?,
            orphaned: r.get(2)?,
        })
    })?;
    Ok(preview)
}

/// Elimina la sezione e le sue sottosezioni (in cascata). Gli articoli restano.
pub fn delete(conn: &Connection, id: i64) -> AppResult<()> {
    if conn.execute("DELETE FROM sections WHERE id = ?1", [id])? == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

fn normalize_name(name: &str) -> AppResult<String> {
    let name = name.split_whitespace().collect::<Vec<_>>().join(" ");
    if name.is_empty() {
        return Err(AppError::invalid("Il nome della sezione non può essere vuoto."));
    }
    if name.chars().count() > MAX_NAME_LEN {
        return Err(AppError::invalid(format!(
            "Il nome della sezione può contenere al massimo {MAX_NAME_LEN} caratteri."
        )));
    }
    Ok(name)
}

fn ensure_exists(conn: &Connection, id: i64) -> AppResult<()> {
    parent_of(conn, id).map(|_| ())
}

fn parent_of(conn: &Connection, id: i64) -> AppResult<Option<i64>> {
    conn.query_row("SELECT parent_id FROM sections WHERE id = ?1", [id], |r| r.get(0))
        .optional()?
        .ok_or(AppError::NotFound)
}

fn ensure_unique_name(
    conn: &Connection,
    parent_id: Option<i64>,
    name: &str,
    exclude: Option<i64>,
) -> AppResult<()> {
    let taken: bool = conn.query_row(
        "SELECT EXISTS (
             SELECT 1 FROM sections
             WHERE parent_id IS ?1 AND name = ?2 COLLATE NOCASE AND id IS NOT ?3
         )",
        params![parent_id, name, exclude],
        |r| r.get(0),
    )?;
    if taken {
        return Err(AppError::invalid(format!(
            "Esiste già una sezione chiamata “{name}” in questa posizione."
        )));
    }
    Ok(())
}

/// Vero se `candidate` appartiene al sottoalbero di `root`.
fn is_in_subtree(conn: &Connection, candidate: i64, root: i64) -> AppResult<bool> {
    let sql = format!("{SUBTREE_CTE} SELECT EXISTS (SELECT 1 FROM subtree WHERE id = ?2)");
    Ok(conn.query_row(&sql, params![root, candidate], |r| r.get(0))?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    fn names_under(conn: &Connection, parent: Option<i64>) -> Vec<String> {
        list(conn)
            .unwrap()
            .into_iter()
            .filter(|s| s.parent_id == parent)
            .map(|s| s.name)
            .collect()
    }

    fn add_article(conn: &Connection, sections: &[i64]) -> i64 {
        conn.execute("INSERT INTO articles (title) VALUES ('x')", []).unwrap();
        let id = conn.last_insert_rowid();
        for s in sections {
            conn.execute(
                "INSERT INTO article_sections (article_id, section_id) VALUES (?1, ?2)",
                params![id, s],
            )
            .unwrap();
        }
        id
    }

    #[test]
    fn create_appends_and_normalizes() {
        let conn = db::open_in_memory().unwrap();
        let a = create(&conn, "  Medicina  ", None).unwrap();
        let b = create(&conn, "Statistica", None).unwrap();
        assert_eq!(a.name, "Medicina");
        assert_eq!((a.position, b.position), (0, 1));
        assert!(create(&conn, "   ", None).is_err());
    }

    #[test]
    fn sibling_names_are_unique_case_insensitively() {
        let conn = db::open_in_memory().unwrap();
        let med = create(&conn, "Medicina", None).unwrap();
        assert!(create(&conn, "medicina", None).is_err());

        // Lo stesso nome è ammesso sotto un genitore diverso.
        create(&conn, "Medicina", Some(med.id)).unwrap();

        let other = create(&conn, "Altro", None).unwrap();
        assert!(rename(&conn, other.id, "MEDICINA").is_err());
        rename(&conn, other.id, "Varie").unwrap();
        rename(&conn, other.id, "varie").unwrap(); // cambiare solo le maiuscole è lecito
    }

    #[test]
    fn move_reorders_and_reparents() {
        let mut conn = db::open_in_memory().unwrap();
        let a = create(&conn, "A", None).unwrap();
        let b = create(&conn, "B", None).unwrap();
        let c = create(&conn, "C", None).unwrap();

        move_to(&mut conn, c.id, None, 0).unwrap();
        assert_eq!(names_under(&conn, None), ["C", "A", "B"]);

        move_to(&mut conn, b.id, Some(a.id), 99).unwrap();
        assert_eq!(names_under(&conn, None), ["C", "A"]);
        assert_eq!(names_under(&conn, Some(a.id)), ["B"]);
    }

    #[test]
    fn move_into_own_subtree_is_rejected() {
        let mut conn = db::open_in_memory().unwrap();
        let a = create(&conn, "A", None).unwrap();
        let b = create(&conn, "B", Some(a.id)).unwrap();
        let c = create(&conn, "C", Some(b.id)).unwrap();

        assert!(move_to(&mut conn, a.id, Some(a.id), 0).is_err());
        assert!(move_to(&mut conn, a.id, Some(c.id), 0).is_err());
        move_to(&mut conn, c.id, None, 0).unwrap();
    }

    #[test]
    fn counts_include_subsections_without_duplicates() {
        let conn = db::open_in_memory().unwrap();
        let med = create(&conn, "Medicina", None).unwrap();
        let cardio = create(&conn, "Cardiologia", Some(med.id)).unwrap();
        add_article(&conn, &[med.id, cardio.id]);
        add_article(&conn, &[cardio.id]);

        let all = list(&conn).unwrap();
        let count = |id| all.iter().find(|s| s.id == id).unwrap().article_count;
        assert_eq!(count(med.id), 2);
        assert_eq!(count(cardio.id), 2);
    }

    #[test]
    fn delete_cascades_sections_but_keeps_articles() {
        let conn = db::open_in_memory().unwrap();
        let med = create(&conn, "Medicina", None).unwrap();
        let cardio = create(&conn, "Cardiologia", Some(med.id)).unwrap();
        let aritmie = create(&conn, "Aritmie", Some(cardio.id)).unwrap();
        let stat = create(&conn, "Statistica", None).unwrap();

        add_article(&conn, &[aritmie.id]); // resterà senza sezione
        add_article(&conn, &[cardio.id, stat.id]); // resta in Statistica

        assert_eq!(
            delete_preview(&conn, med.id).unwrap(),
            DeletePreview { subsections: 2, articles: 2, orphaned: 1 }
        );

        delete(&conn, med.id).unwrap();
        assert_eq!(names_under(&conn, None), ["Statistica"]);
        assert_eq!(list(&conn).unwrap().len(), 1);

        let articles: i64 = conn.query_row("SELECT COUNT(*) FROM articles", [], |r| r.get(0)).unwrap();
        assert_eq!(articles, 2);
        assert!(matches!(delete(&conn, med.id), Err(AppError::NotFound)));
    }
}
