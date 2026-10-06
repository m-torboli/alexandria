//! Copia di sicurezza giornaliera del database.
//!
//! Alla prima apertura di ogni giorno il database viene copiato in
//! `backup/alexandria-AAAA-MM-GG.db`; si tengono le ultime copie.
//! Per ripristinarne una basta sostituirla ad `alexandria.db` ad app chiusa.

use std::{fs, path::Path};

use rusqlite::Connection;

use crate::error::AppResult;

const KEEP: usize = 7;
const PREFIX: &str = "alexandria-";

/// Crea la copia di oggi se manca e toglie quelle più vecchie.
pub fn daily(conn: &Connection, dir: &Path) -> AppResult<()> {
    let today: String = conn.query_row("SELECT date('now', 'localtime')", [], |r| r.get(0))?;
    let target = dir.join(format!("{PREFIX}{today}.db"));
    if target.exists() {
        return Ok(());
    }

    // VACUUM INTO produce una copia coerente e compatta anche con il database aperto.
    let partial = dir.join(format!(".{PREFIX}{today}.partial"));
    let _ = fs::remove_file(&partial);
    conn.execute("VACUUM INTO ?1", [partial.to_string_lossy()])?;
    fs::rename(&partial, &target)?;
    prune(dir)
}

fn prune(dir: &Path) -> AppResult<()> {
    let mut backups: Vec<_> = fs::read_dir(dir)?
        .flatten()
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .filter(|name| name.starts_with(PREFIX) && name.ends_with(".db"))
        .collect();
    // Il nome contiene la data in formato ISO: l'ordine alfabetico è cronologico.
    backups.sort_unstable_by(|a, b| b.cmp(a));
    for old in backups.iter().skip(KEEP) {
        fs::remove_file(dir.join(old))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn names(dir: &Path) -> Vec<String> {
        let mut names: Vec<_> = fs::read_dir(dir).unwrap().map(|e| e.unwrap().file_name().into_string().unwrap()).collect();
        names.sort();
        names
    }

    #[test]
    fn creates_one_readable_backup_per_day_and_keeps_the_last_seven() {
        let dir = tempfile::tempdir().unwrap();
        let conn = Connection::open(dir.path().join("db")).unwrap();
        conn.execute_batch("CREATE TABLE t (x); INSERT INTO t VALUES (42);").unwrap();
        let backups = dir.path().join("backup");
        fs::create_dir(&backups).unwrap();
        for day in 1..=9 {
            fs::write(backups.join(format!("alexandria-2020-01-0{day}.db")), "").unwrap();
        }

        daily(&conn, &backups).unwrap();
        daily(&conn, &backups).unwrap(); // la seconda volta nello stesso giorno non fa nulla

        let kept = names(&backups);
        assert_eq!(kept.len(), KEEP);
        assert!(kept.iter().all(|n| !n.starts_with('.')), "nessun file parziale");
        let newest = backups.join(kept.last().unwrap());
        let copy = Connection::open(newest).unwrap();
        let x: i64 = copy.query_row("SELECT x FROM t", [], |r| r.get(0)).unwrap();
        assert_eq!(x, 42);
        assert!(!kept.contains(&"alexandria-2020-01-01.db".to_string()));
    }
}
