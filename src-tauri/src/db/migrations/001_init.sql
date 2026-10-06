-- Alexandria · schema iniziale

CREATE TABLE sections (
    id         INTEGER PRIMARY KEY,
    parent_id  INTEGER REFERENCES sections(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    position   INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_sections_parent ON sections(parent_id, position);

CREATE TABLE articles (
    id                INTEGER PRIMARY KEY,
    title             TEXT    NOT NULL DEFAULT '',
    abstract          TEXT,
    year              INTEGER,
    journal           TEXT,
    volume            TEXT,
    issue             TEXT,
    pages             TEXT,
    doi               TEXT,
    url               TEXT,
    publisher         TEXT,
    file_name         TEXT,                       -- relativo alla cartella pdf/
    file_hash         TEXT    UNIQUE,             -- SHA-256, per riconoscere i duplicati
    file_size         INTEGER,
    page_count        INTEGER,
    reading_status    INTEGER NOT NULL DEFAULT 0 CHECK (reading_status IN (0, 1, 2)), -- da leggere, in lettura, letto
    favorite          INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
    notes             TEXT    NOT NULL DEFAULT '',
    metadata_complete INTEGER NOT NULL DEFAULT 0 CHECK (metadata_complete IN (0, 1)),
    added_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    modified_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    deleted_at        TEXT                        -- valorizzato = nel Cestino
);
CREATE INDEX idx_articles_doi ON articles(doi);
CREATE INDEX idx_articles_year ON articles(year);
CREATE INDEX idx_articles_deleted ON articles(deleted_at);

CREATE TABLE authors (
    id     INTEGER PRIMARY KEY,
    family TEXT NOT NULL,
    given  TEXT NOT NULL DEFAULT '',
    UNIQUE (family, given)
);

CREATE TABLE article_authors (
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    author_id  INTEGER NOT NULL REFERENCES authors(id)  ON DELETE CASCADE,
    position   INTEGER NOT NULL,
    PRIMARY KEY (article_id, position)
);
CREATE INDEX idx_article_authors_author ON article_authors(author_id);

CREATE TABLE article_sections (
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    PRIMARY KEY (article_id, section_id)
);
CREATE INDEX idx_article_sections_section ON article_sections(section_id);

CREATE TABLE tags (
    id    INTEGER PRIMARY KEY,
    name  TEXT NOT NULL UNIQUE COLLATE NOCASE,
    color TEXT NOT NULL
);

CREATE TABLE article_tags (
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    tag_id     INTEGER NOT NULL REFERENCES tags(id)     ON DELETE CASCADE,
    PRIMARY KEY (article_id, tag_id)
);
CREATE INDEX idx_article_tags_tag ON article_tags(tag_id);
