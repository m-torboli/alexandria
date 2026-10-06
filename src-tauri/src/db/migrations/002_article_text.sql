-- Testo estratto dai PDF, base per la ricerca a testo completo.
CREATE TABLE article_text (
    article_id INTEGER PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
    content    TEXT NOT NULL
);
