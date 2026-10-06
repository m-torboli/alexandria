//! Recupero dei metadati bibliografici a partire dal DOI.
//!
//! doi.org risponde in formato CSL-JSON per i DOI di CrossRef e DataCite
//! (riviste, arXiv, Zenodo, …): un'unica fonte, gratuita e senza registrazione.

use std::time::Duration;

use serde_json::Value;

use crate::{
    articles::{Author, Metadata},
    error::{AppError, AppResult},
};

const USER_AGENT: &str = concat!("Alexandria/", env!("CARGO_PKG_VERSION"), " (biblioteca personale di articoli)");
const CSL_JSON: &str = "application/vnd.citationstyles.csl+json";

/// Normalizza un DOI scritto in vari modi ("doi:…", "https://doi.org/…").
pub fn normalize_doi(raw: &str) -> Option<String> {
    let mut doi = raw.trim();
    for prefix in ["https://doi.org/", "http://doi.org/", "https://dx.doi.org/", "http://dx.doi.org/", "doi.org/", "doi:"] {
        if doi.len() >= prefix.len() && doi[..prefix.len()].eq_ignore_ascii_case(prefix) {
            doi = doi[prefix.len()..].trim_start();
        }
    }
    // Punteggiatura finale presa dal testo circostante; una ")" si toglie solo
    // se non chiude una "(" del DOI stesso, come in "10.1016/S0140-6736(21)…".
    loop {
        let trimmed = doi.trim_end_matches(['.', ',', ';', ']', '}', '>', '"', '\'']);
        let unbalanced = trimmed.ends_with(')') && trimmed.matches(')').count() > trimmed.matches('(').count();
        let next = if unbalanced { &trimmed[..trimmed.len() - 1] } else { trimmed };
        if next.len() == doi.len() {
            break;
        }
        doi = next;
    }
    let valid = doi.starts_with("10.") && doi.contains('/') && !doi.contains(char::is_whitespace);
    valid.then(|| doi.to_string())
}

/// Scarica i metadati del DOI indicato.
pub fn fetch(doi: &str) -> AppResult<Metadata> {
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(20)))
        .build()
        .into();

    let url = format!("https://doi.org/{}", encode_path(doi));
    let response = agent
        .get(&url)
        .header("Accept", CSL_JSON)
        .header("User-Agent", USER_AGENT)
        .call();

    match response {
        Ok(mut response) => {
            let value: Value = response
                .body_mut()
                .read_json()
                .map_err(|_| AppError::invalid("La risposta di doi.org non è leggibile."))?;
            Ok(parse_csl(&value, doi))
        }
        Err(ureq::Error::StatusCode(404)) => Err(AppError::invalid(format!("Il DOI {doi} non esiste."))),
        Err(ureq::Error::StatusCode(code)) => Err(AppError::invalid(format!(
            "doi.org ha risposto con un errore ({code}). Riprova più tardi."
        ))),
        // Il dettaglio tecnico (certificato rifiutato, proxy, timeout…) serve a capire
        // il problema: senza, ogni guasto di rete sembrerebbe uguale.
        Err(e) => Err(AppError::invalid(format!(
            "Impossibile contattare doi.org ({e}). Controlla la connessione a internet."
        ))),
    }
}

/// Converte un record CSL-JSON nei metadati di Alexandria.
pub fn parse_csl(value: &Value, doi: &str) -> Metadata {
    let text = |key: &str| first_string(value.get(key)).map(|s| strip_markup(&s)).filter(|s| !s.is_empty());

    let authors = value
        .get("author")
        .and_then(Value::as_array)
        .map(|list| list.iter().filter_map(parse_author).collect())
        .unwrap_or_default();

    let year = ["issued", "published-print", "published-online", "created"]
        .iter()
        .find_map(|key| year_of(value.get(*key)));

    Metadata {
        title: text("title").unwrap_or_default(),
        authors,
        year,
        journal: text("container-title"),
        volume: text("volume"),
        issue: text("issue"),
        pages: text("page"),
        publisher: text("publisher"),
        doi: text("DOI").or_else(|| Some(doi.to_string())),
        url: text("URL"),
        abstract_text: text("abstract").map(|a| strip_abstract_label(&a)),
    }
}

fn parse_author(value: &Value) -> Option<Author> {
    let get = |key: &str| value.get(key).and_then(Value::as_str).map(str::trim).unwrap_or("");
    let (family, given) = match (get("family"), get("given"), get("literal")) {
        ("", _, "") => return None,
        ("", _, literal) => (literal, ""),
        (family, given, _) => (family, given),
    };
    Some(Author { family: family.to_string(), given: given.to_string() })
}

/// L'anno sta in `date-parts[0][0]`, come numero o come testo.
fn year_of(date: Option<&Value>) -> Option<i64> {
    let first = date?.get("date-parts")?.get(0)?.get(0)?;
    first.as_i64().or_else(|| first.as_str()?.trim().parse().ok())
}

/// Alcuni campi possono essere un testo o un elenco di testi.
fn first_string(value: Option<&Value>) -> Option<String> {
    match value? {
        Value::String(s) => Some(s.clone()),
        Value::Array(items) => items.iter().find_map(|v| v.as_str().map(str::to_owned)),
        Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}

/// Rimuove marcatori HTML/JATS (es. `<jats:p>`) e decodifica le entità comuni.
pub fn strip_markup(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut in_tag = false;
    for c in text.chars() {
        match c {
            '<' => in_tag = true,
            '>' if in_tag => {
                in_tag = false;
                out.push(' ');
            }
            c if !in_tag => out.push(c),
            _ => {}
        }
    }
    let decoded = out
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&nbsp;", " ")
        .replace("&amp;", "&");
    let collapsed = decoded.split_whitespace().collect::<Vec<_>>().join(" ");
    // Gli spazi introdotti al posto dei tag non devono staccare la punteggiatura.
    [" ,", " .", " ;", " :", " )"]
        .iter()
        .fold(collapsed, |acc, p| acc.replace(p, &p[1..]))
        .replace("( ", "(")
}

fn strip_abstract_label(text: &str) -> String {
    for label in ["Abstract", "ABSTRACT", "Summary", "SUMMARY"] {
        if let Some(rest) = text.strip_prefix(label) {
            return rest.trim_start_matches([':', '.', ' ']).to_string();
        }
    }
    text.to_string()
}

/// Codifica per l'URL i caratteri non sicuri del DOI, mantenendo le barre.
fn encode_path(doi: &str) -> String {
    let mut out = String::with_capacity(doi.len());
    for byte in doi.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' | b'/' | b'(' | b')' | b':' | b';' => {
                out.push(byte as char)
            }
            other => out.push_str(&format!("%{other:02X}")),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn normalizes_doi_variants() {
        assert_eq!(normalize_doi("10.1000/xyz123").as_deref(), Some("10.1000/xyz123"));
        assert_eq!(normalize_doi("https://doi.org/10.1000/ABC.").as_deref(), Some("10.1000/ABC"));
        assert_eq!(normalize_doi("DOI: 10.1000/abc)").as_deref(), Some("10.1000/abc"));
        assert_eq!(normalize_doi("(10.1002/(SICI)1097-4636(199601)).").as_deref(), None);
        assert_eq!(normalize_doi("10.1002/(SICI)1097-4636(199601))."), Some("10.1002/(SICI)1097-4636(199601)".into()));
        assert_eq!(normalize_doi("non un doi"), None);
        assert_eq!(normalize_doi("10.1000 /spazio"), None);
    }

    #[test]
    fn parses_crossref_record() {
        let record = json!({
            "title": "Deep <i>learning</i> for cardiology",
            "author": [
                {"family": "Rossi", "given": "Mario"},
                {"family": "Bianchi", "given": "Luca"},
                {"literal": "WHO Consortium"}
            ],
            "issued": {"date-parts": [[2021, 3, 4]]},
            "container-title": ["The Lancet"],
            "volume": "397", "issue": 12, "page": "100-110",
            "publisher": "Elsevier",
            "DOI": "10.1016/S0140-6736(21)00001-1",
            "URL": "https://doi.org/10.1016/S0140-6736(21)00001-1",
            "abstract": "<jats:title>Abstract</jats:title><jats:p>Results &amp; methods (n = 10) .</jats:p>"
        });
        let m = parse_csl(&record, "10.1016/x");
        assert_eq!(m.title, "Deep learning for cardiology");
        assert_eq!(m.authors.len(), 3);
        assert_eq!(m.authors[2], Author { family: "WHO Consortium".into(), given: "".into() });
        assert_eq!(m.year, Some(2021));
        assert_eq!(m.journal.as_deref(), Some("The Lancet"));
        assert_eq!(m.issue.as_deref(), Some("12"));
        assert_eq!(m.doi.as_deref(), Some("10.1016/S0140-6736(21)00001-1"));
        assert_eq!(m.abstract_text.as_deref(), Some("Results & methods (n = 10)."));
    }

    #[test]
    fn falls_back_on_other_dates_and_requested_doi() {
        let record = json!({"title": "T", "published-online": {"date-parts": [["2019"]]}});
        let m = parse_csl(&record, "10.1/x");
        assert_eq!(m.year, Some(2019));
        assert_eq!(m.doi.as_deref(), Some("10.1/x"));
        assert!(m.authors.is_empty());
    }

    /// Richiede internet: `cargo test -- --ignored`.
    #[test]
    #[ignore]
    fn live_fetch_from_doi_org() {
        let m = fetch("10.1038/nature14539").unwrap();
        assert_eq!(m.title, "Deep learning");
        assert_eq!(m.year, Some(2015));
        assert_eq!(m.authors.first().map(|a| a.family.as_str()), Some("LeCun"));
        assert_eq!(m.journal.as_deref(), Some("Nature"));

        let arxiv = fetch("10.48550/arXiv.1706.03762").unwrap();
        assert_eq!(arxiv.title, "Attention Is All You Need");

        assert!(fetch("10.9999/non-esiste-davvero").is_err());
    }

    #[test]
    fn encodes_unsafe_characters() {
        assert_eq!(encode_path("10.1002/(SICI)1097<x>"), "10.1002/(SICI)1097%3Cx%3E");
    }
}
