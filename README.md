# Alexandria

La tua biblioteca personale di articoli scientifici: archivia, organizza, leggi e ritrova i PDF.
App desktop per Windows e macOS, interamente locale.

Il progetto completo (funzioni, architettura, piano di lavoro) è in [docs/PROGETTO.md](docs/PROGETTO.md).

## Sviluppo

Requisiti: [Node.js](https://nodejs.org) LTS, [Rust](https://rustup.rs) e i
[prerequisiti di Tauri](https://v2.tauri.app/start/prerequisites/) per il proprio sistema.

```bash
npm install          # dipendenze dell'interfaccia
npm run tauri dev    # avvia l'app in modalità sviluppo
npm test             # test dell'interfaccia
npm run check        # controllo dei tipi TypeScript
cd src-tauri && cargo test                # test del motore Rust
cd src-tauri && cargo test -- --ignored   # test che richiedono internet (doi.org)
npm run tauri build  # crea l'installer per il sistema corrente
```

## Struttura

```
src/                     interfaccia (React + TypeScript)
  features/              schermate: welcome, sidebar, articles, import, workspace
  components/            elementi riutilizzabili
  lib/                   API verso Rust, query, PDF, DOI, autori (logica pura con test)
  store/                 stato dell'interfaccia
  styles/                design tokens e stili di base
src-tauri/src/           motore (Rust)
  db/                    apertura del database e migrazioni
  library.rs             cartella della libreria
  articles.rs            articoli: elenco, metadati, organizzazione, Cestino
  importer.rs            importazione dei PDF e riconoscimento dei duplicati
  metadata.rs            metadati da DOI (doi.org, CSL-JSON)
  files.rs               nomi leggibili, impronta SHA-256
  sections.rs, tags.rs   sezioni e tag
  commands/              comandi esposti all'interfaccia
```

## Importazione di un articolo

1. Il PDF viene copiato nella cartella `pdf/` della libreria e ne viene calcolata
   l'impronta: se esiste già, è un duplicato e la copia viene scartata.
2. PDF.js ne estrae il testo (salvato per la ricerca) e cerca il DOI nei metadati
   interni e nelle prime due pagine; in mancanza, un identificativo arXiv.
3. Con il DOI si scaricano titolo, autori, anno, rivista e abstract da doi.org e il
   file viene rinominato, ad esempio `2015 - LeCun - Deep learning.pdf`.

Ogni passo dopo la copia è facoltativo: se fallisce, l'articolo resta in libreria
nella vista "Da completare".
