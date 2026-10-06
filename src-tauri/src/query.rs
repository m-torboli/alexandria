//! Elenco degli articoli: vista, ricerca a testo completo, filtri e ordinamento.

use rusqlite::{params_from_iter, types::Value, Connection, Row};
use serde::{Deserialize, Serialize};

use crate::{
    articles::{self, ArticleSummary, View},
    error::AppResult,
    search,
};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Query {
    pub text: String,
    pub filters: Filters,
    pub sort: Sort,
}

/// Filtri combinabili: all'interno di un filtro basta una corrispondenza
/// (es. uno qualsiasi degli autori scelti), tra filtri diversi valgono tutti.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Filters {
    pub author_ids: Vec<i64>,
    pub journals: Vec<String>,
    pub tag_ids: Vec<i64>,
    pub year_from: Option<i64>,
    pub year_to: Option<i64>,
    pub statuses: Vec<i64>,
    pub favorites_only: bool,
    pub added_within_days: Option<i64>,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Sort {
    /// Pertinenza rispetto alla ricerca (senza ricerca equivale ad `Added`).
    Relevance,
    #[default]
    Added,
    YearDesc,
    YearAsc,
    Title,
    Author,
}

/// Valori disponibili per i filtri, con il numero di articoli.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterOptions {
    pub authors: Vec<AuthorOption>,
    pub journals: Vec<JournalOption>,
    pub min_year: Option<i64>,
    pub max_year: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthorOption {
    pub id: i64,
    pub family: String,
    pub given: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JournalOption {
    pub name: String,
    pub count: i64,
}

/// Costruisce la query un pezzo alla volta, tenendo i parametri nello stesso
/// ordine dei segnaposto `?` nel testo SQL.
#[derive(Default)]
struct Builder {
    conditions: Vec<String>,
    args: Vec<Value>,
}

impl Builder {
    fn add(&mut self, condition: impl Into<String>, args: impl IntoIterator<Item = Value>) {
        self.conditions.push(condition.into());
        self.args.extend(args);
    }

    /// Condizione `colonna IN (?, ?, …)`, ignorata se l'elenco è vuoto.
    fn add_in<T: Into<Value> + Clone>(&mut self, template: &str, values: &[T]) {
        if values.is_empty() {
            return;
        }
        let marks = vec!["?"; values.len()].join(", ");
        self.add(template.replace("{}", &marks), values.iter().cloned().map(Into::into));
    }
}

const LIVE: &str = "a.deleted_at IS NULL";
const FIRST_AUTHOR: &str = "(SELECT au.family FROM article_authors aa JOIN authors au ON au.id = aa.author_id
                             WHERE aa.article_id = a.id AND aa.position = 0)";

pub fn list(conn: &Connection, view: View, query: &Query) -> AppResult<Vec<ArticleSummary>> {
    let mut b = Builder::default();
    let mut cte = "";
    let mut cte_args = Vec::new();

    match view {
        View::All => b.add(LIVE, []),
        View::ToRead => b.add(format!("{LIVE} AND a.reading_status = 0"), []),
        View::Favorites => b.add(format!("{LIVE} AND a.favorite = 1"), []),
        View::Incomplete => b.add(format!("{LIVE} AND a.metadata_complete = 0"), []),
        View::Unclassified => b.add(
            format!("{LIVE} AND NOT EXISTS (SELECT 1 FROM article_sections x WHERE x.article_id = a.id)"),
            [],
        ),
        View::Trash => b.add("a.deleted_at IS NOT NULL", []),
        View::Section { id } => {
            cte = "WITH RECURSIVE subtree(id) AS (
                       SELECT ? UNION ALL SELECT s.id FROM sections s JOIN subtree ON s.parent_id = subtree.id
                   ) ";
            cte_args.push(Value::from(id));
            b.add(
                format!(
                    "{LIVE} AND EXISTS (SELECT 1 FROM article_sections x JOIN subtree ON subtree.id = x.section_id
                                        WHERE x.article_id = a.id)"
                ),
                [],
            );
        }
        View::Tag { id } => b.add(
            format!("{LIVE} AND EXISTS (SELECT 1 FROM article_tags x WHERE x.article_id = a.id AND x.tag_id = ?)"),
            [Value::from(id)],
        ),
    }

    let f = &query.filters;
    b.add_in(
        "EXISTS (SELECT 1 FROM article_authors x WHERE x.article_id = a.id AND x.author_id IN ({}))",
        &f.author_ids,
    );
    b.add_in("a.journal IN ({})", &f.journals);
    b.add_in("EXISTS (SELECT 1 FROM article_tags x WHERE x.article_id = a.id AND x.tag_id IN ({}))", &f.tag_ids);
    b.add_in("a.reading_status IN ({})", &f.statuses);
    if let Some(from) = f.year_from {
        b.add("a.year >= ?", [Value::from(from)]);
    }
    if let Some(to) = f.year_to {
        b.add("a.year <= ?", [Value::from(to)]);
    }
    if f.favorites_only {
        b.add("a.favorite = 1", []);
    }
    if let Some(days) = f.added_within_days.filter(|d| *d > 0) {
        b.add("a.added_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?)", [Value::from(format!("-{days} days"))]);
    }

    let fts = search::fts_query(&query.text);
    let (join, snippet) = match &fts {
        Some(m) => {
            b.add("articles_fts MATCH ?", [Value::from(m.clone())]);
            (
                "JOIN articles_fts ON articles_fts.rowid = a.id",
                format!(
                    "snippet(articles_fts, -1, {}, {}, '…', 16)",
                    search::MARK_START,
                    search::MARK_END
                ),
            )
        }
        None => ("", "NULL".to_string()),
    };

    let sort = match (query.sort, fts.is_some()) {
        (Sort::Relevance, false) => Sort::Added,
        (sort, _) => sort,
    };
    let order = match (view, sort) {
        (View::Trash, Sort::Added) => "a.deleted_at DESC, a.id DESC".to_string(),
        (_, Sort::Relevance) => format!("bm25(articles_fts, {}), a.added_at DESC", search::BM25_WEIGHTS),
        (_, Sort::Added) => "a.added_at DESC, a.id DESC".to_string(),
        (_, Sort::YearDesc) => "a.year IS NULL, a.year DESC, a.title COLLATE NOCASE".to_string(),
        (_, Sort::YearAsc) => "a.year IS NULL, a.year ASC, a.title COLLATE NOCASE".to_string(),
        (_, Sort::Title) => "a.title = '', a.title COLLATE NOCASE, a.id".to_string(),
        (_, Sort::Author) => format!("{FIRST_AUTHOR} IS NULL, {FIRST_AUTHOR} COLLATE NOCASE, a.year, a.id"),
    };

    let sql = format!(
        "{cte}SELECT a.id, a.title, a.year, a.journal, a.reading_status, a.favorite, a.metadata_complete,
                     a.added_at, a.deleted_at, {snippet}
              FROM articles a {join}
              WHERE {}
              ORDER BY {order}",
        b.conditions.join(" AND ")
    );
    let args: Vec<Value> = cte_args.into_iter().chain(b.args).collect();

    let mut authors = articles::authors_by_article(conn)?;
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map(params_from_iter(args), summary_from_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows
        .into_iter()
        .map(|mut a| {
            a.authors = authors.remove(&a.id).unwrap_or_default();
            a
        })
        .collect())
}

fn summary_from_row(row: &Row) -> rusqlite::Result<ArticleSummary> {
    Ok(ArticleSummary {
        id: row.get(0)?,
        title: row.get(1)?,
        authors: Vec::new(),
        year: row.get(2)?,
        journal: row.get(3)?,
        reading_status: row.get(4)?,
        favorite: row.get(5)?,
        metadata_complete: row.get(6)?,
        added_at: row.get(7)?,
        deleted_at: row.get(8)?,
        snippet: row.get(9)?,
    })
}

/// Autori, riviste e anni presenti tra gli articoli (Cestino escluso).
pub fn filter_options(conn: &Connection) -> AppResult<FilterOptions> {
    let authors = conn
        .prepare(
            "SELECT au.id, au.family, au.given, COUNT(DISTINCT a.id)
             FROM authors au
             JOIN article_authors aa ON aa.author_id = au.id
             JOIN articles a ON a.id = aa.article_id AND a.deleted_at IS NULL
             GROUP BY au.id
             ORDER BY au.family COLLATE NOCASE, au.given COLLATE NOCASE",
        )?
        .query_map([], |r| {
            Ok(AuthorOption { id: r.get(0)?, family: r.get(1)?, given: r.get(2)?, count: r.get(3)? })
        })?
        .collect::<Result<_, _>>()?;

    let journals = conn
        .prepare(
            "SELECT journal, COUNT(*) FROM articles
             WHERE deleted_at IS NULL AND journal IS NOT NULL
             GROUP BY journal ORDER BY journal COLLATE NOCASE",
        )?
        .query_map([], |r| Ok(JournalOption { name: r.get(0)?, count: r.get(1)? }))?
        .collect::<Result<_, _>>()?;

    let (min_year, max_year) = conn.query_row(
        "SELECT MIN(year), MAX(year) FROM articles WHERE deleted_at IS NULL",
        [],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )?;

    Ok(FilterOptions { authors, journals, min_year, max_year })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        articles::{self, Author, Metadata},
        library::Library,
        sections, tags,
    };

    struct Fixture {
        _dir: tempfile::TempDir,
        lib: Library,
        deep: i64,
        heart: i64,
        stats: i64,
    }

    fn add(lib: &mut Library, file: &str, meta: Metadata, body: &str) -> i64 {
        std::fs::write(lib.pdf_dir().join(file), b"%PDF-1.4").unwrap();
        lib.conn.execute("INSERT INTO articles (file_name) VALUES (?1)", [file]).unwrap();
        let id = lib.conn.last_insert_rowid();
        articles::update_metadata(lib, id, meta).unwrap();
        articles::save_pdf_info(lib, id, body, Some(1), None).unwrap();
        id
    }

    fn author(family: &str, given: &str) -> Author {
        Author { family: family.into(), given: given.into() }
    }

    fn fixture() -> Fixture {
        let dir = tempfile::tempdir().unwrap();
        let mut lib = Library::open(dir.path()).unwrap();
        let deep = add(
            &mut lib,
            "a.pdf",
            Metadata {
                title: "Deep learning".into(),
                authors: vec![author("LeCun", "Yann"), author("Bengio", "Yoshua")],
                year: Some(2015),
                journal: Some("Nature".into()),
                ..Default::default()
            },
            "Convolutional networks process images. Perché funziona così bene?",
        );
        let heart = add(
            &mut lib,
            "b.pdf",
            Metadata {
                title: "Heart failure and cardiology outcomes".into(),
                authors: vec![author("Rossi", "Mario")],
                year: Some(2021),
                journal: Some("The Lancet".into()),
                abstract_text: Some("A cohort study on cardiovascular risk.".into()),
                ..Default::default()
            },
            "Patients were followed for ten years. Deep phenotyping was used.",
        );
        let stats = add(
            &mut lib,
            "c.pdf",
            Metadata {
                title: "Statistica bayesiana applicata".into(),
                authors: vec![author("Bianchi", "Luca"), author("Rossi", "Mario")],
                year: Some(2008),
                ..Default::default()
            },
            "Metodi Monte Carlo per l'inferenza.",
        );
        Fixture { _dir: dir, lib, deep, heart, stats }
    }

    fn ids(lib: &Library, view: View, query: Query) -> Vec<i64> {
        list(&lib.conn, view, &query).unwrap().into_iter().map(|a| a.id).collect()
    }

    fn text(t: &str) -> Query {
        Query { text: t.into(), sort: Sort::Relevance, ..Default::default() }
    }

    #[test]
    fn views_filter_articles() {
        let Fixture { _dir, mut lib, deep, heart, stats, .. } = fixture();
        let med = sections::create(&lib.conn, "Medicina", None).unwrap();
        let cardio = sections::create(&lib.conn, "Cardiologia", Some(med.id)).unwrap();
        articles::set_sections(&mut lib.conn, heart, &[cardio.id]).unwrap();
        articles::set_favorite(&lib.conn, deep, true).unwrap();
        articles::set_reading_status(&lib.conn, deep, 2).unwrap();
        articles::move_to_trash(&lib.conn, &[stats]).unwrap();

        let q = Query::default;
        assert_eq!(ids(&lib, View::All, q()), [heart, deep]);
        assert_eq!(ids(&lib, View::Section { id: med.id }, q()), [heart]);
        assert_eq!(ids(&lib, View::Favorites, q()), [deep]);
        assert_eq!(ids(&lib, View::ToRead, q()), [heart]);
        assert_eq!(ids(&lib, View::Unclassified, q()), [deep]);
        assert_eq!(ids(&lib, View::Trash, q()), [stats]);
    }

    #[test]
    fn full_text_search_ignores_case_accents_and_finds_prefixes() {
        let Fixture { _dir, lib, deep, heart, stats, .. } = fixture();
        assert_eq!(ids(&lib, View::All, text("convolutional")), [deep]);
        assert_eq!(ids(&lib, View::All, text("PERCHE")), [deep]);
        assert_eq!(ids(&lib, View::All, text("cardio")), [heart]);
        assert_eq!(ids(&lib, View::All, text("bayes")), [stats]);
        assert_eq!(ids(&lib, View::All, text("monte carlo")), [stats]);
        assert_eq!(ids(&lib, View::All, text("lancet 2021")), [heart]);
        assert_eq!(ids(&lib, View::All, text("Yoshua")), [deep]);
        assert!(ids(&lib, View::All, text("inesistente")).is_empty());
        assert!(ids(&lib, View::All, text("\"followed ten\"")).is_empty(), "frase esatta");
        assert_eq!(ids(&lib, View::All, text("\"followed for ten\"")), [heart]);
    }

    #[test]
    fn title_matches_rank_above_body_matches() {
        let Fixture { _dir, lib, deep, heart, .. } = fixture();
        // "deep" è nel titolo del primo e solo nel testo del secondo.
        assert_eq!(ids(&lib, View::All, text("deep")), [deep, heart]);
    }

    #[test]
    fn snippets_mark_the_matching_words() {
        let Fixture { _dir, lib, .. } = fixture();
        let found = list(&lib.conn, View::All, &text("phenotyping")).unwrap();
        let snippet = found[0].snippet.as_deref().unwrap();
        assert!(snippet.contains("\u{2}phenotyping\u{3}"), "{snippet}");
        assert!(list(&lib.conn, View::All, &Query::default()).unwrap()[0].snippet.is_none());
    }

    #[test]
    fn filters_combine() {
        let Fixture { _dir, mut lib, deep, heart, stats, .. } = fixture();
        let rossi: i64 = lib
            .conn
            .query_row("SELECT id FROM authors WHERE family = 'Rossi'", [], |r| r.get(0))
            .unwrap();
        let tag = tags::create(&lib.conn, "review", "blue").unwrap();
        articles::set_tags(&mut lib.conn, heart, &[tag.id]).unwrap();

        let filtered = |filters: Filters| ids(&lib, View::All, Query { filters, ..Default::default() });
        assert_eq!(filtered(Filters { author_ids: vec![rossi], ..Default::default() }), [stats, heart]);
        assert_eq!(filtered(Filters { year_from: Some(2010), ..Default::default() }), [heart, deep]);
        assert_eq!(filtered(Filters { year_to: Some(2015), ..Default::default() }), [stats, deep]);
        assert_eq!(
            filtered(Filters { author_ids: vec![rossi], year_from: Some(2010), ..Default::default() }),
            [heart]
        );
        assert_eq!(filtered(Filters { journals: vec!["Nature".into()], ..Default::default() }), [deep]);
        assert_eq!(filtered(Filters { tag_ids: vec![tag.id], ..Default::default() }), [heart]);
        assert_eq!(filtered(Filters { statuses: vec![2], ..Default::default() }), Vec::<i64>::new());
        assert_eq!(filtered(Filters { added_within_days: Some(7), ..Default::default() }).len(), 3);
    }

    #[test]
    fn sorting() {
        let Fixture { _dir, lib, deep, heart, stats, .. } = fixture();
        let sorted = |sort| ids(&lib, View::All, Query { sort, ..Default::default() });
        assert_eq!(sorted(Sort::YearDesc), [heart, deep, stats]);
        assert_eq!(sorted(Sort::YearAsc), [stats, deep, heart]);
        assert_eq!(sorted(Sort::Title), [deep, heart, stats]);
        assert_eq!(sorted(Sort::Author), [stats, deep, heart]);
        assert_eq!(sorted(Sort::Relevance), sorted(Sort::Added), "senza ricerca, pertinenza = recenti");
    }

    #[test]
    fn index_follows_changes_and_heals_itself() {
        let Fixture { _dir, mut lib, deep, .. } = fixture();
        let meta = Metadata { title: "Reti neurali profonde".into(), ..articles::get(&lib.conn, deep).unwrap().metadata };
        articles::update_metadata(&mut lib, deep, meta).unwrap();
        assert_eq!(ids(&lib, View::All, text("neurali")), [deep]);
        assert!(ids(&lib, View::All, text("\"deep learning\"")).is_empty());

        lib.conn.execute("DELETE FROM articles_fts", []).unwrap();
        search::ensure_index(&lib.conn).unwrap();
        assert_eq!(ids(&lib, View::All, text("neurali")), [deep]);

        articles::move_to_trash(&lib.conn, &[deep]).unwrap();
        articles::delete_forever(&mut lib, &[deep]).unwrap();
        let rows: i64 = lib.conn.query_row("SELECT COUNT(*) FROM articles_fts", [], |r| r.get(0)).unwrap();
        assert_eq!(rows, 2);
    }

    #[test]
    fn filter_options_list_authors_journals_and_years() {
        let Fixture { _dir, lib, .. } = &fixture();
        let options = filter_options(&lib.conn).unwrap();
        let names: Vec<_> = options.authors.iter().map(|a| (a.family.as_str(), a.count)).collect();
        assert_eq!(names, [("Bengio", 1), ("Bianchi", 1), ("LeCun", 1), ("Rossi", 2)]);
        let journals: Vec<_> = options.journals.iter().map(|j| j.name.as_str()).collect();
        assert_eq!(journals, ["Nature", "The Lancet"]);
        assert_eq!((options.min_year, options.max_year), (Some(2008), Some(2021)));
    }
}
