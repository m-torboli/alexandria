-- Indice di ricerca a testo completo. Il contenuto viene scritto dal motore
-- (search.rs) a ogni modifica di un articolo e ricostruito all'apertura della
-- libreria se non è allineato.
CREATE VIRTUAL TABLE articles_fts USING fts5(
    title, authors, journal, year, abstract, notes, body,
    tokenize = 'unicode61 remove_diacritics 2',
    prefix = '2 3'
);
