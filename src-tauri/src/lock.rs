//! Segnale "libreria in uso", per chi la tiene in una cartella sincronizzata.
//!
//! Finché la libreria è aperta, il file `.alexandria.lock` riporta il nome del
//! computer e viene aggiornato ogni minuto. Se all'apertura il file indica un
//! altro computer con un segnale recente, l'utente viene avvisato: usare la
//! stessa libreria su due computer nello stesso momento può danneggiarla.

use std::{
    fs,
    path::Path,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};

use crate::error::AppResult;

pub const LOCK_FILE: &str = ".alexandria.lock";
/// Ogni quanto si rinnova il segnale.
pub const HEARTBEAT: Duration = Duration::from_secs(60);
/// Oltre questo intervallo il segnale è considerato vecchio (computer spento,
/// app chiusa male). È ampio perché i servizi cloud sincronizzano con ritardo.
const STALE_AFTER_SECS: u64 = 10 * 60;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LockFile {
    device: String,
    updated_at: u64,
}

/// Libreria aperta su un altro computer.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InUse {
    pub device: String,
    pub minutes_ago: u64,
}

/// Nome leggibile di questo computer ("MacBook-di-Marco", "PC-UFFICIO").
pub fn device_name() -> String {
    let name = gethostname::gethostname().to_string_lossy().into_owned();
    let name = name.trim_end_matches(".local").trim();
    if name.is_empty() { "questo computer".to_string() } else { name.to_string() }
}

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

/// Se la libreria risulta aperta di recente su un altro computer, dice quale.
pub fn in_use_elsewhere(root: &Path) -> Option<InUse> {
    in_use_by_other(root, &device_name(), now())
}

fn in_use_by_other(root: &Path, me: &str, now: u64) -> Option<InUse> {
    let text = fs::read_to_string(root.join(LOCK_FILE)).ok()?;
    let lock: LockFile = serde_json::from_str(&text).ok()?;
    let age = now.saturating_sub(lock.updated_at);
    (lock.device != me && age < STALE_AFTER_SECS).then_some(InUse { device: lock.device, minutes_ago: age / 60 })
}

/// Segna la libreria come aperta da questo computer (anche per rinnovare il segnale).
pub fn touch(root: &Path) -> AppResult<()> {
    write(root, &device_name(), now())
}

fn write(root: &Path, device: &str, at: u64) -> AppResult<()> {
    let lock = LockFile { device: device.to_string(), updated_at: at };
    fs::write(root.join(LOCK_FILE), serde_json::to_vec(&lock)?)?;
    Ok(())
}

/// Toglie il segnale, ma solo se è di questo computer.
pub fn release(root: &Path) {
    let path = root.join(LOCK_FILE);
    let mine = fs::read_to_string(&path)
        .ok()
        .and_then(|t| serde_json::from_str::<LockFile>(&t).ok())
        .is_some_and(|lock| lock.device == device_name());
    if mine {
        let _ = fs::remove_file(path);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_recent_locks_from_other_devices_only() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        assert_eq!(in_use_by_other(root, "pc", 1_000), None, "nessun lock");

        write(root, "mac", 1_000).unwrap();
        assert_eq!(
            in_use_by_other(root, "pc", 1_000 + 180),
            Some(InUse { device: "mac".into(), minutes_ago: 3 })
        );
        assert_eq!(in_use_by_other(root, "mac", 1_000 + 180), None, "è il mio");
        assert_eq!(in_use_by_other(root, "pc", 1_000 + STALE_AFTER_SECS), None, "troppo vecchio");

        fs::write(root.join(LOCK_FILE), "rovinato").unwrap();
        assert_eq!(in_use_by_other(root, "pc", 1_000), None, "illeggibile = ignorato");
    }

    #[test]
    fn release_removes_only_own_lock() {
        let dir = tempfile::tempdir().unwrap();
        write(dir.path(), "altro-computer", now()).unwrap();
        release(dir.path());
        assert!(dir.path().join(LOCK_FILE).exists());

        touch(dir.path()).unwrap();
        release(dir.path());
        assert!(!dir.path().join(LOCK_FILE).exists());
    }
}
