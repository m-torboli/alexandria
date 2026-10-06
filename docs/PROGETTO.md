# Alexandria — Documento di progetto

> Versione 0.1 · bozza da approvare prima dello sviluppo

Alexandria è un'app desktop personale per archiviare, organizzare, leggere e ritrovare articoli scientifici in PDF. Funziona su Windows e macOS, è interamente locale (nessun account, nessun server) e pensata per una libreria di decine o centinaia di articoli.

**Principi guida**

1. **Semplice prima di tutto.** Ogni funzione deve essere comprensibile senza istruzioni.
2. **I tuoi dati restano tuoi.** I PDF sono file normali in una cartella leggibile; se un giorno Alexandria sparisse, i file restano lì con nomi sensati.
3. **Veloce e leggera.** Avvio istantaneo, ricerca istantanea, installer di pochi MB.
4. **Nessuna perdita di dati.** Niente si cancella davvero senza passare dal Cestino; backup automatici del database.

---

## 1. Funzioni

### 1.1 Libreria e sezioni

- **Sezioni tematiche gerarchiche** (es. *Medicina → Cardiologia → Aritmie*), senza limiti di profondità.
- Creare, rinominare (anche con doppio clic), spostare (trascinando), riordinare ed eliminare sezioni in qualsiasi momento.
- **Un articolo può stare in più sezioni** contemporaneamente.
- **Eliminare una sezione non elimina mai gli articoli**: quelli che restano senza sezione finiscono in *Non classificati*. Se la sezione contiene sottosezioni, una finestra di conferma mostra cosa verrà rimosso (es. "2 sottosezioni, 14 articoli").
- **Tag** liberi e colorati, trasversali alle sezioni (es. *metodologia*, *da citare*, *review*).

**Viste fisse** nella barra laterale:

| Vista | Contenuto |
|---|---|
| Tutti gli articoli | L'intera libreria |
| Da leggere | Articoli con stato *da leggere* |
| Preferiti | Articoli contrassegnati con la stella |
| Da completare | Articoli con metadati mancanti (es. senza DOI) |
| Non classificati | Articoli senza alcuna sezione |
| Cestino | Articoli eliminati, recuperabili o eliminabili definitivamente |

### 1.2 Importazione

- **Selezione classica** tramite pulsante "Aggiungi articoli" (anche più file insieme).
- **Trascinamento** dei PDF:
  - sulla finestra → importati nella sezione attualmente aperta;
  - su una sezione della barra laterale → importati direttamente in quella sezione.
- Il PDF viene **copiato** nella libreria: l'originale può essere spostato o cancellato senza conseguenze.
- **Rilevamento duplicati** tramite impronta del file: se l'articolo è già presente l'app lo segnala invece di duplicarlo.
- L'importazione non blocca l'interfaccia: un piccolo pannello mostra l'avanzamento.

### 1.3 Metadati automatici

Per ogni PDF importato:

1. L'app estrae il testo e cerca un **DOI** (o un identificativo arXiv) nelle prime pagine.
2. Se lo trova, scarica i metadati da **doi.org** (copre CrossRef e DataCite, gratuito, senza registrazione): titolo, autori, anno, rivista, volume, numero, pagine, abstract.
3. Se non lo trova, usa i metadati interni del PDF e il nome del file, e marca l'articolo come **"Da completare"**.

Tutti i campi restano **modificabili a mano**. È possibile anche incollare un DOI manualmente per recuperare i dati in un secondo momento.

Senza connessione internet l'importazione funziona comunque: i metadati si possono recuperare più tardi.

### 1.4 Ricerca

- **Barra di ricerca** sempre visibile (scorciatoia `Ctrl+K` / `⌘K`), risultati mentre si digita.
- Cerca in: titolo, autori, rivista, anno, abstract, tag, note personali **e testo completo del PDF**.
- Ignora maiuscole e accenti; trova anche parole parziali (`cardio` trova *cardiologia*, *cardiovascolare*).
- Supporta frasi esatte tra virgolette (`"heart failure"`).
- **Ordine per rilevanza**: una corrispondenza nel titolo o negli autori pesa più di una nel testo. Ogni risultato mostra *dove* è stata trovata la parola, con un breve estratto.

### 1.5 Filtri e ordinamento

Filtri combinabili tra loro e con la ricerca, mostrati come "pillole" rimovibili:

- **Autore** (elenco con ricerca, selezione multipla)
- **Anno** (intervallo da–a)
- **Rivista**
- **Sezione** e **tag**
- **Stato di lettura**: da leggere / in lettura / letto
- **Solo preferiti**
- **Data di aggiunta** (es. ultimi 30 giorni)

Ordinamento per: data di aggiunta, anno di pubblicazione, titolo, primo autore.

### 1.6 Lettura e note

- **Lettore PDF integrato** a schermo intero, con zoom, ricerca nel documento e miniature delle pagine.
- **Note personali affiancate** al lettore: si legge e si annota contemporaneamente. Salvataggio automatico.
- Pulsante **"Apri con l'app di sistema"** e **"Mostra nella cartella"**.
- **Stato di lettura** e **stella preferiti** con un clic.

### 1.7 Citazioni

- **Copia citazione** in formato **APA 7** con un clic.
- **Esporta BibTeX** di un articolo, di una selezione o di un'intera sezione.

### 1.8 Sincronizzazione tra i propri computer

- Al primo avvio si sceglie **dove salvare la libreria** (predefinito: `Documenti/Alexandria`).
- Mettendo la libreria in una cartella cloud personale (iCloud Drive, Dropbox, Google Drive), il servizio cloud la sincronizza tra i propri computer.
- **Protezione**: l'app rileva se la libreria è aperta su un altro computer e avvisa ("Libreria aperta sul MacBook di Marco 3 minuti fa").
- **Backup automatico** del database ogni giorno (ultimi 7 conservati).

### 1.9 Interfaccia

- Solo **italiano**.
- **Tema chiaro e scuro** che segue il sistema (o forzabile).
- Tutte le funzioni raggiungibili anche con **menu contestuale** (tasto destro) e **scorciatoie da tastiera**.

---

## 2. Schermate

```
┌──────────────────┬───────────────────────────────┬────────────────────────┐
│  ALEXANDRIA      │  🔍 Cerca…            ⚙ Filtri │                        │
│                  │  [Autore: Rossi ×] [2018–2024 ×]│   DETTAGLIO ARTICOLO   │
│  Tutti      128  ├───────────────────────────────┤                        │
│  Da leggere  12  │  ● Titolo dell'articolo        │   Titolo completo      │
│  Preferiti    9  │    Rossi, Bianchi · Lancet ·   │   Autori               │
│  Da completare 3 │    2021                    ★   │   Rivista · Anno · DOI │
│                  │                                │                        │
│  SEZIONI       + │  ○ Altro articolo              │   [Leggi] [Cita] [⋯]   │
│  ▾ Medicina      │    Verdi et al. · Nature ·     │                        │
│     Cardiologia  │    2019                        │   Sezioni · Tag        │
│     Neurologia   │                                │   Stato di lettura     │
│  ▸ Statistica    │                                │                        │
│                  │                                │   Abstract             │
│  TAG             │                                │   Note personali       │
│  ● review        │                                │                        │
└──────────────────┴───────────────────────────────┴────────────────────────┘
```

- **Barra laterale**: viste fisse, albero delle sezioni, tag. Destinazione per il trascinamento di PDF e articoli.
- **Elenco centrale**: articoli della vista corrente, filtrati e ordinati. Selezione multipla per azioni di gruppo (sposta, tagga, elimina, esporta).
- **Pannello dettaglio**: metadati modificabili, sezioni, tag, stato, abstract, note.
- **Lettore**: si apre a tutta finestra con le note sulla destra; `Esc` per tornare.

---

## 3. Architettura tecnica

| Livello | Tecnologia | Motivo |
|---|---|---|
| Contenitore desktop | **Tauri 2** | App nativa Windows/macOS, installer ~10 MB, basso consumo di memoria |
| Motore (backend) | **Rust** | Database, file, rete: veloce e sicuro |
| Interfaccia | **React + TypeScript** (Vite) | Componenti solidi e tipizzati |
| Database | **SQLite** con **FTS5** | Un solo file, ricerca full-text integrata |
| PDF | **PDF.js** | Un unico motore sia per il lettore sia per l'estrazione del testo |
| Metadati | **doi.org** (CSL-JSON) | Gratuito, copre CrossRef e DataCite |

### 3.1 Struttura della libreria su disco

```
Alexandria/
├── alexandria.db            database (metadati, sezioni, note, indice di ricerca)
├── pdf/
│   ├── 2021 - Rossi - Titolo abbreviato dell'articolo.pdf
│   └── …
├── backup/                  copie giornaliere del database
└── .alexandria.lock         segnala su quale computer è aperta
```

I PDF hanno **nomi leggibili** (anno, primo autore, titolo), aggiornati quando si correggono i metadati.

### 3.2 Modello dei dati

- **articoli**: titolo, abstract, anno, rivista, volume, numero, pagine, DOI, URL, file, impronta, stato di lettura, preferito, note, date di aggiunta/modifica, data di eliminazione (Cestino).
- **autori** e relazione ordinata **articolo ↔ autori** (permette il filtro per autore).
- **sezioni** con riferimento alla sezione madre e posizione (albero ordinabile).
- **articolo ↔ sezioni** (molti a molti).
- **tag** e **articolo ↔ tag** (molti a molti).
- **indice di ricerca** FTS5 con pesi diversi per campo.
- Versione dello schema per aggiornamenti futuri senza perdita di dati.

### 3.3 Organizzazione del codice

```
alexandria/
├── src/                     interfaccia (React)
│   ├── features/            library, sections, articles, search, import, reader
│   ├── components/          elementi riutilizzabili (pulsanti, menu, finestre)
│   ├── lib/                 chiamate al backend, citazioni, DOI, PDF
│   └── styles/              colori, tipografia, temi
├── src-tauri/               motore (Rust)
│   └── src/
│       ├── commands/        operazioni esposte all'interfaccia
│       ├── db/              schema, migrazioni, query
│       ├── metadata/        recupero metadati da DOI
│       └── library/         gestione file, lock, backup
├── docs/                    documentazione
└── .github/workflows/       creazione automatica degli installer
```

Test automatici su: database e ricerca (Rust), riconoscimento DOI e formattazione citazioni (TypeScript).

---

## 4. Distribuzione

- Codice in un **repository privato GitHub** personale.
- A ogni nuova versione, **GitHub Actions** crea automaticamente:
  - installer **Windows** (`.exe`);
  - installer **macOS** (`.dmg`, Apple Silicon e Intel).
- Gli installer **non sono firmati** (pubblico di 2–3 persone). Un file `INSTALLAZIONE.md` spiegherà come superare l'avviso al primo avvio:
  - Windows: *Ulteriori informazioni → Esegui comunque*;
  - macOS: *Impostazioni di Sistema → Privacy e sicurezza → Apri comunque*.

---

## 5. Piano di lavoro

| Tappa | Contenuto | Risultato verificabile |
|---|---|---|
| **1. Fondamenta** ✅ | Progetto, database, scelta della libreria, sezioni e tag | Si creano e organizzano sezioni |
| **2. Importazione** ✅ | Selezione e trascinamento, copia file, duplicati, DOI e metadati; anticipati stato di lettura, preferiti e Cestino | Si caricano PDF con dati compilati |
| **3. Ricerca e filtri** | Indice full-text, barra di ricerca, filtri, ordinamento | Si ritrova qualsiasi articolo |
| **4. Lettura e lavoro** | Lettore integrato, note, stato, preferiti, citazioni, Cestino | Uso quotidiano completo |
| **5. Robustezza e rilascio** | Lock, backup, GitHub, installer Windows/macOS | Gli amici installano l'app |

**Sviluppi futuri** (non inclusi ora): evidenziazioni e annotazioni sul PDF, ricerca dei metadati per titolo quando manca il DOI, aggiornamenti automatici dell'app.
