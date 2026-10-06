//! Conteggi delle viste fisse della barra laterale.

use rusqlite::Connection;
use serde::Serialize;

use crate::error::AppResult;

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewCounts {
    pub all: i64,
    pub to_read: i64,
    pub favorites: i64,
    pub incomplete: i64,
    pub unclassified: i64,
    pub trash: i64,
}

pub fn counts(conn: &Connection) -> AppResult<ViewCounts> {
    let counts = conn.query_row(
        "SELECT
             COUNT(*) FILTER (WHERE deleted_at IS NULL),
             COUNT(*) FILTER (WHERE deleted_at IS NULL AND reading_status = 0),
             COUNT(*) FILTER (WHERE deleted_at IS NULL AND favorite = 1),
             COUNT(*) FILTER (WHERE deleted_at IS NULL AND metadata_complete = 0),
             COUNT(*) FILTER (WHERE deleted_at IS NULL AND NOT EXISTS (
                 SELECT 1 FROM article_sections x WHERE x.article_id = articles.id)),
             COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)
         FROM articles",
        [],
        |r| {
            Ok(ViewCounts {
                all: r.get(0)?,
                to_read: r.get(1)?,
                favorites: r.get(2)?,
                incomplete: r.get(3)?,
                unclassified: r.get(4)?,
                trash: r.get(5)?,
            })
        },
    )?;
    Ok(counts)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{db, sections};

    #[test]
    fn counts_each_view() {
        let conn = db::open_in_memory().unwrap();
        assert_eq!(counts(&conn).unwrap(), ViewCounts::default());

        let s = sections::create(&conn, "S", None).unwrap();
        conn.execute_batch(&format!(
            "INSERT INTO articles (id, reading_status, favorite, metadata_complete) VALUES (1, 0, 1, 1);
             INSERT INTO articles (id, reading_status, favorite, metadata_complete) VALUES (2, 2, 0, 0);
             INSERT INTO articles (id, deleted_at) VALUES (3, '2026-01-01');
             INSERT INTO article_sections VALUES (1, {});",
            s.id
        ))
        .unwrap();

        assert_eq!(
            counts(&conn).unwrap(),
            ViewCounts { all: 2, to_read: 1, favorites: 1, incomplete: 1, unclassified: 1, trash: 1 }
        );
    }
}
