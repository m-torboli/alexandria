//! Nomi e operazioni sui file PDF della libreria.

use std::{
    fs::File,
    io::{BufReader, Read, Write},
    path::{Path, PathBuf},
};

use sha2::{Digest, Sha256};

use crate::error::{AppError, AppResult};

const MAX_STEM_CHARS: usize = 120;
const MAX_TITLE_CHARS: usize = 90;
const WINDOWS_RESERVED: [&str; 22] = [
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1",
    "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

/// Nome leggibile (senza estensione): "2021 - Rossi - Titolo dell'articolo".
pub fn readable_stem(year: Option<i64>, first_author: Option<&str>, title: &str) -> Option<String> {
    let title = shorten(&collapse(title), MAX_TITLE_CHARS);
    if title.is_empty() {
        return None;
    }
    let mut parts = Vec::with_capacity(3);
    if let Some(year) = year {
        parts.push(year.to_string());
    }
    if let Some(author) = first_author.map(collapse).filter(|a| !a.is_empty()) {
        parts.push(author);
    }
    parts.push(title);
    Some(sanitize_stem(&parts.join(" - "))).filter(|s| !s.is_empty())
}

/// Titolo provvisorio ricavato dal nome del file originale.
pub fn title_from_file_name(path: &Path) -> String {
    let stem = path.file_stem().map(|s| s.to_string_lossy()).unwrap_or_default();
    collapse(&stem.replace(['_', '+'], " "))
}

/// Rende un testo utilizzabile come nome di file su Windows e macOS.
pub fn sanitize_stem(raw: &str) -> String {
    let mut cleaned = String::with_capacity(raw.len());
    for c in raw.chars() {
        match c {
            ':' => cleaned.push_str(" - "),
            '/' | '\\' | '|' => cleaned.push('-'),
            '<' | '>' | '"' | '?' | '*' => cleaned.push(' '),
            c if c.is_control() => cleaned.push(' '),
            c => cleaned.push(c),
        }
    }
    let collapsed = collapse(&cleaned).replace("- -", "-");
    let mut stem = shorten(&collapsed, MAX_STEM_CHARS)
        .trim_end_matches(['.', ' '])
        .trim_start_matches(['.', ' '])
        .to_string();
    if WINDOWS_RESERVED.contains(&stem.to_ascii_uppercase().as_str()) {
        stem.insert(0, '_');
    }
    stem
}

/// Percorso libero `dir/stem.pdf`, aggiungendo " (2)", " (3)"… se serve.
/// `current` è il nome attuale del file stesso, che non va considerato occupato.
pub fn unique_pdf_path(dir: &Path, stem: &str, current: Option<&str>) -> PathBuf {
    (1..)
        .map(|n| match n {
            1 => format!("{stem}.pdf"),
            n => format!("{stem} ({n}).pdf"),
        })
        .find(|name| current == Some(name.as_str()) || !dir.join(name).exists())
        .map(|name| dir.join(name))
        .expect("la sequenza è infinita")
}

/// Copia `source` in `dest` calcolandone l'impronta SHA-256 in un solo passaggio.
/// Restituisce (impronta esadecimale, dimensione in byte).
pub fn copy_with_hash(source: &Path, dest: &Path) -> AppResult<(String, u64)> {
    let mut reader = BufReader::new(File::open(source)?);
    let mut writer = File::create(dest)?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 64 * 1024];
    let mut size = 0u64;
    let mut first_chunk = true;

    loop {
        let read = reader.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        if first_chunk {
            ensure_pdf_signature(&buffer[..read])?;
            first_chunk = false;
        }
        hasher.update(&buffer[..read]);
        writer.write_all(&buffer[..read])?;
        size += read as u64;
    }
    if first_chunk {
        return Err(AppError::invalid("Il file è vuoto."));
    }
    writer.sync_all()?;

    let hash = hasher.finalize().iter().map(|b| format!("{b:02x}")).collect();
    Ok((hash, size))
}

/// Un PDF contiene "%PDF-" all'inizio (alcuni generatori lo spostano di poco).
fn ensure_pdf_signature(head: &[u8]) -> AppResult<()> {
    let window = &head[..head.len().min(1024)];
    if window.windows(5).any(|w| w == b"%PDF-") {
        Ok(())
    } else {
        Err(AppError::invalid("Il file non è un PDF valido."))
    }
}

fn collapse(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Accorcia a `max` caratteri, preferibilmente a fine parola.
fn shorten(text: &str, max: usize) -> String {
    if text.chars().count() <= max {
        return text.to_string();
    }
    let cut: String = text.chars().take(max).collect();
    match cut.rfind(' ') {
        Some(space) if space > max / 2 => cut[..space].to_string(),
        _ => cut,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn builds_readable_names() {
        assert_eq!(
            readable_stem(Some(2021), Some("Rossi"), "Deep learning: a review").as_deref(),
            Some("2021 - Rossi - Deep learning - a review")
        );
        assert_eq!(readable_stem(None, None, "Solo titolo").as_deref(), Some("Solo titolo"));
        assert_eq!(readable_stem(Some(2020), Some("X"), "   "), None);
    }

    #[test]
    fn sanitizes_forbidden_characters() {
        assert_eq!(sanitize_stem("A/B \\ C?*<>\"|"), "A-B - C -");
        assert_eq!(sanitize_stem("  .nascosto.  "), "nascosto");
        assert_eq!(sanitize_stem("con"), "_con");
    }

    #[test]
    fn shortens_long_titles_at_word_boundary() {
        let long = "parola ".repeat(40);
        let stem = readable_stem(None, None, &long).unwrap();
        assert!(stem.chars().count() <= MAX_TITLE_CHARS);
        assert!(stem.ends_with("parola"));
    }

    #[test]
    fn title_from_messy_file_name() {
        assert_eq!(title_from_file_name(Path::new("/x/Smith_et_al__2020.pdf")), "Smith et al 2020");
    }

    #[test]
    fn unique_paths_skip_taken_names_but_not_own() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("A.pdf"), "").unwrap();
        fs::write(dir.path().join("A (2).pdf"), "").unwrap();

        assert_eq!(unique_pdf_path(dir.path(), "A", None), dir.path().join("A (3).pdf"));
        assert_eq!(unique_pdf_path(dir.path(), "A", Some("A (2).pdf")), dir.path().join("A (2).pdf"));
        assert_eq!(unique_pdf_path(dir.path(), "B", None), dir.path().join("B.pdf"));
    }

    #[test]
    fn copies_and_hashes_pdfs_only() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("a.pdf");
        fs::write(&src, b"%PDF-1.7 contenuto").unwrap();
        let (hash, size) = copy_with_hash(&src, &dir.path().join("b.pdf")).unwrap();
        assert_eq!(size, 18);
        assert_eq!(hash.len(), 64);
        assert_eq!(fs::read(dir.path().join("b.pdf")).unwrap(), fs::read(&src).unwrap());

        let fake = dir.path().join("finto.pdf");
        fs::write(&fake, b"<html>non sono un pdf</html>").unwrap();
        assert!(copy_with_hash(&fake, &dir.path().join("c.pdf")).is_err());
    }
}
