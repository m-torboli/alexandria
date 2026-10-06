//! Ricerca a testo completo (SQLite FTS5).
//!
//! Ogni articolo ha una riga nell'indice con titolo, autori, rivista, anno,
//! abstract, note e testo del PDF. Le ricerche ignorano maiuscole e accenti e
//! trovano anche le parole iniziate ("cardio" trova "cardiologia").

use rusqlite::{params, Connection};

use crate::error::AppResult;

/// Peso di ciascuna colonna nel calcolo della rilevanza (stesso ordine della tabella).
pub const BM25_WEIGHTS: &str = "10.0, 8.0, 3.0, 3.0, 4.0, 4.0, 1.0";

/// Marcatori delle parole trovate negli estratti (caratteri di controllo,
/// che non compaiono nei testi e l'interfaccia sostituisce con l'evidenziazione).
pub const MARK_START: &str = "char(2)";
pub const MARK_END: &str = "char(3)";

const INDEX_SELECT: &str = "
    SELECT a.id, a.title,
           COALESCE((SELECT group_concat(trim(au.given || ' ' || au.family), ', ')
                     FROM article_authors aa JOIN authors au ON au.id = aa.author_id
                     WHERE aa.article_id = a.id), ''),
           COALESCE(a.journal, ''),
           COALESCE(CAST(a.year AS TEXT), ''),
           COALESCE(a.abstract, ''),
           a.notes,
           COALESCE((SELECT t.content FROM article_text t WHERE t.article_id = a.id), '')
    FROM articles a";

const INDEX_INSERT: &str = "INSERT INTO articles_fts (rowid, title, authors, journal, year, abstract, notes, body)";

/// Aggiorna la riga dell'indice di un articolo (o la toglie se non esiste più).
pub fn reindex(conn: &Connection, id: i64) -> AppResult<()> {
    conn.execute("DELETE FROM articles_fts WHERE rowid = ?1", [id])?;
    conn.execute(&format!("{INDEX_INSERT} {INDEX_SELECT} WHERE a.id = ?1"), [id])?;
    Ok(())
}

pub fn remove(conn: &Connection, id: i64) -> AppResult<()> {
    conn.execute("DELETE FROM articles_fts WHERE rowid = ?1", [id])?;
    Ok(())
}

/// Ricostruisce l'indice se non corrisponde agli articoli (prima apertura dopo
/// un aggiornamento, interruzioni improvvise…). Con poche centinaia di articoli
/// richiede una frazione di secondo.
pub fn ensure_index(conn: &Connection) -> AppResult<()> {
    let aligned: bool = conn.query_row(
        "SELECT (SELECT COUNT(*) FROM articles) = (SELECT COUNT(*) FROM articles_fts)
            AND NOT EXISTS (SELECT 1 FROM articles a WHERE NOT EXISTS
                            (SELECT 1 FROM articles_fts f WHERE f.rowid = a.id))",
        [],
        |r| r.get(0),
    )?;
    if !aligned {
        conn.execute("DELETE FROM articles_fts", [])?;
        conn.execute(&format!("{INDEX_INSERT} {INDEX_SELECT}"), params![])?;
    }
    Ok(())
}

/// Traduce il testo digitato in una ricerca FTS5 sicura.
///
/// - le parole diventano prefissi: `cardio` → `"cardio"*`;
/// - le parole con punteggiatura restano unite: `covid-19` → `"covid 19"*`;
/// - le frasi tra virgolette si cercano esatte: `"heart failure"`;
/// - tutti i termini devono comparire (AND).
pub fn fts_query(text: &str) -> Option<String> {
    let mut terms = Vec::new();
    for (chunk, quoted) in split_quoted(text) {
        if quoted {
            let phrase = tokens(chunk).join(" ");
            if !phrase.is_empty() {
                terms.push(format!("\"{phrase}\""));
            }
        } else {
            for word in chunk.split_whitespace() {
                let phrase = tokens(word).join(" ");
                if !phrase.is_empty() {
                    terms.push(format!("\"{phrase}\"*"));
                }
            }
        }
    }
    (!terms.is_empty()).then(|| terms.join(" "))
}

/// Parti del testo, alternando fuori e dentro le virgolette.
fn split_quoted(text: &str) -> impl Iterator<Item = (&str, bool)> {
    text.split('"').enumerate().map(|(i, part)| (part, i % 2 == 1))
}

/// Sequenze di lettere e cifre, come le separa il tokenizzatore di FTS5.
fn tokens(text: &str) -> Vec<&str> {
    text.split(|c: char| !c.is_alphanumeric()).filter(|t| !t.is_empty()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_safe_queries() {
        assert_eq!(fts_query("cardio"), Some("\"cardio\"*".into()));
        assert_eq!(fts_query("  Rossi 2021 "), Some("\"Rossi\"* \"2021\"*".into()));
        assert_eq!(fts_query("covid-19"), Some("\"covid 19\"*".into()));
        assert_eq!(fts_query("\"heart failure\" risk"), Some("\"heart failure\" \"risk\"*".into()));
        assert_eq!(fts_query("10.1038/nature14539"), Some("\"10 1038 nature14539\"*".into()));
        assert_eq!(fts_query("perché"), Some("\"perché\"*".into()));
        // Sintassi FTS5 e virgolette spaiate non devono mai produrre errori.
        assert_eq!(fts_query("NOT OR AND ( ) * ^ :"), Some("\"NOT\"* \"OR\"* \"AND\"*".into()));
        assert_eq!(fts_query("\"aperta"), Some("\"aperta\"".into()));
        assert_eq!(fts_query("  ,;  "), None);
    }
}
