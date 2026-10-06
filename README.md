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
cd src-tauri && cargo test   # test del motore Rust
npm run tauri build  # crea l'installer per il sistema corrente
```

`npm run dev` da solo apre l'interfaccia in un normale browser con un backend
simulato (`src/dev/mockBackend.ts`), comodo per lavorare sulla grafica.

## Struttura

```
src/                 interfaccia (React + TypeScript)
  features/          schermate: welcome, sidebar, articles, workspace
  components/        elementi riutilizzabili
  lib/               API verso Rust, query, logica pura (con test)
  store/             stato dell'interfaccia
  styles/            design tokens e stili di base
src-tauri/src/       motore (Rust)
  db/                apertura del database e migrazioni
  library.rs         cartella della libreria
  sections.rs        sezioni tematiche
  tags.rs            tag
  views.rs           conteggi delle viste
  commands.rs        comandi esposti all'interfaccia
```
