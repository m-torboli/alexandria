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

## Rilasciare una nuova versione

1. Aggiorna il numero di versione in `package.json`, `src-tauri/Cargo.toml` e
   `src-tauri/tauri.conf.json`.
2. Salva le modifiche e pubblica un tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. GitHub Actions (`.github/workflows/release.yml`) crea gli installer per
   Windows (`.exe`) e macOS (`.dmg` universale) e li allega a una **bozza** di
   release: controllala e pubblicala dalla pagina "Releases" del repository.

Gli installer non sono firmati: le istruzioni per chi installa sono in
[INSTALLAZIONE.md](INSTALLAZIONE.md). A ogni modifica su `main` il workflow
`ci.yml` esegue controlli dei tipi, test e analisi del codice.

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
  search.rs              indice di ricerca a testo completo (SQLite FTS5)
  query.rs               elenco articoli: vista, ricerca, filtri, ordinamento
  files.rs               nomi leggibili, impronta SHA-256
  sections.rs, tags.rs   sezioni e tag
  lock.rs                segnale "libreria in uso" su un altro computer
  backup.rs              copia giornaliera del database (ultime 7)
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

## Lettura e citazioni

Il lettore integrato usa il visualizzatore di PDF.js (`src/features/reader`), con
note affiancate salvate automaticamente e la citazione dei passi selezionati con il
numero di pagina. Le risorse di PDF.js (font, mappe dei caratteri, decodificatori
WebAssembly) vengono copiate in `public/pdfjs` da `scripts/copy-pdfjs-assets.mjs`
prima di `npm run dev` e `npm run build`.

Le citazioni APA 7 e le voci BibTeX sono generate in `src/lib/citation.ts`.

## Ricerca

L'indice FTS5 contiene titolo, autori, rivista, anno, abstract, note e testo del PDF,
con pesi diversi (il titolo conta più del testo). Maiuscole e accenti non contano e
ogni parola vale anche come inizio di parola (`cardio` trova *cardiologia*); le frasi
tra virgolette si cercano esatte. L'indice si aggiorna a ogni modifica e, se non è
allineato, si ricostruisce da solo all'apertura della libreria.
