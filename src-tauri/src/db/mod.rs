use std::{path::Path, time::Duration};

use rusqlite::Connection;

use crate::error::{AppError, AppResult};

/// Migrazioni dello schema, applicate in ordine. Non si modificano mai quelle
/// già rilasciate: ogni cambiamento è una nuova voce in coda.
const MIGRATIONS: &[&str] = &[include_str!("migrations/001_init.sql")];

/// Apre (o crea) il database della libreria e lo porta all'ultima versione.
pub fn open(path: &Path) -> AppResult<Connection> {
    let mut conn = Connection::open(path)?;
    configure(&conn)?;
    migrate(&mut conn)?;
    Ok(conn)
}

#[cfg(test)]
pub fn open_in_memory() -> AppResult<Connection> {
    let mut conn = Connection::open_in_memory()?;
    configure(&conn)?;
    migrate(&mut conn)?;
    Ok(conn)
}

fn configure(conn: &Connection) -> AppResult<()> {
    conn.pragma_update(None, "foreign_keys", "ON")?;
    // Journal classico invece di WAL: un unico file, sicuro anche quando la
    // libreria sta in una cartella sincronizzata (iCloud, Dropbox, …).
    conn.pragma_update_and_check(None, "journal_mode", "DELETE", |_| Ok(()))?;
    conn.pragma_update(None, "synchronous", "FULL")?;
    conn.busy_timeout(Duration::from_secs(5))?;
    Ok(())
}

fn migrate(conn: &mut Connection) -> AppResult<()> {
    let current: i64 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    let current = usize::try_from(current).unwrap_or(0);

    if current > MIGRATIONS.len() {
        return Err(AppError::invalid(
            "Questa libreria è stata creata con una versione più recente di Alexandria. \
             Aggiorna l'app per aprirla.",
        ));
    }

    for (index, sql) in MIGRATIONS.iter().enumerate().skip(current) {
        let tx = conn.transaction()?;
        tx.execute_batch(sql)?;
        tx.pragma_update(None, "user_version", index as i64 + 1)?;
        tx.commit()?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_are_applied_and_idempotent() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.db");

        let conn = open(&path).unwrap();
        let version: i64 = conn
            .pragma_query_value(None, "user_version", |r| r.get(0))
            .unwrap();
        assert_eq!(version, MIGRATIONS.len() as i64);
        drop(conn);

        // Una seconda apertura non deve riapplicare nulla.
        open(&path).unwrap();
    }

    #[test]
    fn rejects_newer_schema() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.db");
        let conn = Connection::open(&path).unwrap();
        conn.pragma_update(None, "user_version", 999).unwrap();
        drop(conn);

        assert!(matches!(open(&path), Err(AppError::Invalid(_))));
    }
}
