import clsx from "clsx";
import {
  ExternalLink,
  FolderOpen,
  LoaderCircle,
  MoreHorizontal,
  Plus,
  RefreshCw,
  RotateCcw,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button, IconButton } from "../../components/Button";
import {
  DropdownCheckItem,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownRoot,
  DropdownSeparator,
  DropdownTrigger,
} from "../../components/Menu";
import { api, metadataOf, type Article, type Author, type Metadata, type ReadingStatus } from "../../lib/api";
import { formatAuthors, parseAuthors } from "../../lib/authors";
import { formatBytes, formatDate } from "../../lib/format";
import { ARTICLE_DEPENDENT, useAction, useArticle, useSections, useTags } from "../../lib/queries";
import { visibleRows } from "../../lib/sectionTree";
import { useToasts } from "../../store/toast";
import { useUi } from "../../store/ui";
import { TagDot } from "../sidebar/TagList";
import { useArticleActions } from "./ArticleMenu";
import styles from "./Detail.module.css";
import { EditableText } from "./EditableText";

export function DetailPane() {
  const selectedId = useUi((s) => s.selectedArticleId);
  const article = useArticle(selectedId).data;

  return (
    <aside className={styles.detail} aria-label="Dettaglio articolo">
      {article && selectedId !== null ? (
        <ArticleDetail key={article.id} article={article} />
      ) : (
        <>
          <div className={styles.toolbar} data-tauri-drag-region />
          <p className={styles.placeholder}>Seleziona un articolo per vederne i dettagli.</p>
        </>
      )}
    </aside>
  );
}

const STATUS_OPTIONS: { value: ReadingStatus; label: string }[] = [
  { value: 0, label: "Da leggere" },
  { value: 1, label: "In lettura" },
  { value: 2, label: "Letto" },
];

function ArticleDetail({ article }: { article: Article }) {
  const actions = useArticleActions();
  const selectArticle = useUi((s) => s.selectArticle);
  const update = useAction(api.updateArticleMetadata, ARTICLE_DEPENDENT);
  const lookup = useAction(api.lookupDoi, ARTICLE_DEPENDENT);
  const [lookingUp, setLookingUp] = useState(false);
  const trashed = article.deletedAt !== null;

  const save = (patch: Partial<Metadata>) => update(article.id, { ...metadataOf(article), ...patch });
  const optional = (value: string) => value || null;

  const saveYear = (value: string) => {
    const year = value ? Number(value) : null;
    if (year !== null && (!Number.isInteger(year) || year < 1000 || year > 9999)) {
      useToasts.getState().show("L'anno deve essere un numero di quattro cifre.", "error");
      return;
    }
    save({ year });
  };

  const fetchMetadata = async (doi: string | null) => {
    if (!doi) return;
    setLookingUp(true);
    const updated = await lookup(article.id, doi);
    setLookingUp(false);
    if (updated) useToasts.getState().show("Dati aggiornati da doi.org.");
  };

  // Inserito un DOI in un articolo con dati incompleti, i dati si recuperano subito.
  const saveDoi = async (value: string) => {
    const saved = await save({ doi: optional(value) });
    if (saved?.doi && !saved.metadataComplete) await fetchMetadata(saved.doi);
  };

  return (
    <>
      <div className={styles.toolbar} data-tauri-drag-region>
        {!trashed && (
          <>
            <IconButton
              label={article.favorite ? "Togli dai preferiti" : "Aggiungi ai preferiti"}
              className={clsx(article.favorite && styles.favoriteOn)}
              onClick={() => actions.setFavorite(article.id, !article.favorite)}
            >
              <Star size={16} fill={article.favorite ? "currentColor" : "none"} />
            </IconButton>
            <IconButton label="Mostra nella cartella" onClick={() => actions.reveal(article.id)}>
              <FolderOpen size={16} />
            </IconButton>
            <Button onClick={() => actions.open(article.id)}>
              <ExternalLink size={14} />
              Apri PDF
            </Button>
          </>
        )}
        <DropdownRoot>
          <DropdownTrigger asChild>
            <IconButton label="Altre azioni">
              <MoreHorizontal size={16} />
            </IconButton>
          </DropdownTrigger>
          <DropdownContent align="end">
            {trashed ? (
              <>
                <DropdownItem icon={<RotateCcw size={14} />} onSelect={() => actions.restore(article.id)}>
                  Ripristina
                </DropdownItem>
                <DropdownSeparator />
                <DropdownItem
                  icon={<Trash2 size={14} />}
                  destructive
                  onSelect={async () => {
                    await actions.deleteForever(article.id);
                    selectArticle(null);
                  }}
                >
                  Elimina definitivamente
                </DropdownItem>
              </>
            ) : (
              <DropdownItem
                icon={<Trash2 size={14} />}
                destructive
                onSelect={() => {
                  actions.trash(article.id);
                  selectArticle(null);
                }}
              >
                Sposta nel Cestino
              </DropdownItem>
            )}
          </DropdownContent>
        </DropdownRoot>
      </div>

      <div className={styles.scroll}>
        {trashed && (
          <div className={styles.notice}>
            <span>Questo articolo è nel Cestino.</span>
            <Button variant="ghost" onClick={() => actions.restore(article.id)}>
              Ripristina
            </Button>
          </div>
        )}

        <EditableText
          multiline
          submitOnEnter
          aria-label="Titolo"
          className={styles.title}
          value={article.title}
          placeholder="Titolo"
          onCommit={(title) => save({ title })}
        />
        <AuthorsField authors={article.authors} onCommit={(authors) => save({ authors })} />

        {!trashed && (
          <div className={styles.segmented} role="radiogroup" aria-label="Stato di lettura">
            {STATUS_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={article.readingStatus === value}
                className={clsx(styles.segment, article.readingStatus === value && styles.segmentOn)}
                onClick={() => actions.setStatus(article.id, value)}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {!article.metadataComplete && (
          <p className={styles.hint}>
            Mancano alcuni dati (titolo, autori o anno). Inserisci il DOI e premi{" "}
            <RefreshCw size={11} className={styles.inlineIcon} /> per recuperarli, oppure completali a mano.
          </p>
        )}

        <dl className={styles.fields}>
          <Field label="DOI">
            <EditableText
              className={styles.input}
              value={article.doi ?? ""}
              placeholder="10.xxxx/…"
              onCommit={saveDoi}
            />
            <IconButton
              label="Recupera i dati dal DOI"
              disabled={!article.doi || lookingUp}
              onClick={() => fetchMetadata(article.doi)}
            >
              {lookingUp ? <LoaderCircle size={14} className={styles.spin} /> : <RefreshCw size={14} />}
            </IconButton>
          </Field>
          <Field label="Rivista">
            <EditableText className={styles.input} value={article.journal ?? ""} placeholder="—"
              onCommit={(v) => save({ journal: optional(v) })} />
          </Field>
          <Field label="Anno">
            <EditableText className={styles.input} value={article.year?.toString() ?? ""} placeholder="—"
              onCommit={saveYear} />
          </Field>
          <Field label="Volume">
            <EditableText className={styles.input} value={article.volume ?? ""} placeholder="—"
              onCommit={(v) => save({ volume: optional(v) })} />
          </Field>
          <Field label="Numero">
            <EditableText className={styles.input} value={article.issue ?? ""} placeholder="—"
              onCommit={(v) => save({ issue: optional(v) })} />
          </Field>
          <Field label="Pagine">
            <EditableText className={styles.input} value={article.pages ?? ""} placeholder="—"
              onCommit={(v) => save({ pages: optional(v) })} />
          </Field>
          <Field label="Editore">
            <EditableText className={styles.input} value={article.publisher ?? ""} placeholder="—"
              onCommit={(v) => save({ publisher: optional(v) })} />
          </Field>
          <Field label="URL">
            <EditableText className={styles.input} value={article.url ?? ""} placeholder="—"
              onCommit={(v) => save({ url: optional(v) })} />
          </Field>
        </dl>

        <Organizer article={article} />

        <section className={styles.block}>
          <h2 className={styles.blockTitle}>Abstract</h2>
          <EditableText
            multiline
            aria-label="Abstract"
            className={styles.abstract}
            value={article.abstract ?? ""}
            placeholder="Nessun abstract"
            onCommit={(v) => save({ abstract: optional(v) })}
          />
        </section>

        <section className={styles.block}>
          <h2 className={styles.blockTitle}>File</h2>
          <dl className={styles.info}>
            <dt>Nome</dt>
            <dd title={article.fileName ?? undefined}>{article.fileName ?? "—"}</dd>
            <dt>Pagine</dt>
            <dd>{article.pageCount ?? "—"}</dd>
            <dt>Dimensione</dt>
            <dd>{article.fileSize ? formatBytes(article.fileSize) : "—"}</dd>
            <dt>Aggiunto</dt>
            <dd>{formatDate(article.addedAt)}</dd>
          </dl>
        </section>
      </div>
    </>
  );
}

/** Oltre questo numero gli autori si mostrano riassunti, con "e altri N". */
const AUTHORS_PREVIEW = 6;

function AuthorsField({ authors, onCommit }: { authors: Author[]; onCommit: (authors: Author[]) => void }) {
  const [expanded, setExpanded] = useState(false);

  if (authors.length > AUTHORS_PREVIEW && !expanded) {
    return (
      <button type="button" className={styles.authorsSummary} onClick={() => setExpanded(true)}>
        {formatAuthors(authors.slice(0, 3))}
        <span className={styles.more}> e altri {authors.length - 3} autori</span>
      </button>
    );
  }
  return (
    <EditableText
      multiline
      aria-label="Autori"
      className={styles.authors}
      value={formatAuthors(authors)}
      placeholder="Autori (Cognome, Nome; Cognome, Nome)"
      onCommit={(text) => onCommit(parseAuthors(text))}
    />
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Sezioni e tag dell'articolo, con aggiunta e rimozione. */
function Organizer({ article }: { article: Article }) {
  const sections = useSections().data ?? [];
  const tags = useTags().data ?? [];
  const setSections = useAction(api.setArticleSections, ARTICLE_DEPENDENT);
  const setTags = useAction(api.setArticleTags, ARTICLE_DEPENDENT);

  const toggle = (ids: number[], id: number, on: boolean) => (on ? [...ids, id] : ids.filter((x) => x !== id));
  const sectionRows = visibleRows(sections, () => true);
  const articleSections = sectionRows.filter((r) => article.sectionIds.includes(r.section.id));
  const articleTags = tags.filter((t) => article.tagIds.includes(t.id));

  return (
    <>
      <section className={styles.block}>
        <h2 className={styles.blockTitle}>
          Sezioni
          <DropdownRoot>
            <DropdownTrigger asChild>
              <IconButton label="Aggiungi a una sezione" disabled={sections.length === 0}>
                <Plus size={14} />
              </IconButton>
            </DropdownTrigger>
            <DropdownContent align="end">
              <DropdownLabel>Sezioni dell'articolo</DropdownLabel>
              {sectionRows.map(({ section, depth }) => (
                <DropdownCheckItem
                  key={section.id}
                  indent={depth}
                  checked={article.sectionIds.includes(section.id)}
                  onCheckedChange={(on) => setSections(article.id, toggle(article.sectionIds, section.id, on))}
                >
                  {section.name}
                </DropdownCheckItem>
              ))}
            </DropdownContent>
          </DropdownRoot>
        </h2>
        <div className={styles.chips}>
          {articleSections.length === 0 && (
            <span className={styles.none}>{sections.length ? "Non classificato" : "Crea una sezione nella barra laterale"}</span>
          )}
          {articleSections.map(({ section }) => (
            <Chip
              key={section.id}
              label={section.name}
              onRemove={() => setSections(article.id, toggle(article.sectionIds, section.id, false))}
            />
          ))}
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>
          Tag
          <DropdownRoot>
            <DropdownTrigger asChild>
              <IconButton label="Aggiungi un tag" disabled={tags.length === 0}>
                <Plus size={14} />
              </IconButton>
            </DropdownTrigger>
            <DropdownContent align="end">
              <DropdownLabel>Tag dell'articolo</DropdownLabel>
              {tags.map((tag) => (
                <DropdownCheckItem
                  key={tag.id}
                  icon={<TagDot color={tag.color} />}
                  checked={article.tagIds.includes(tag.id)}
                  onCheckedChange={(on) => setTags(article.id, toggle(article.tagIds, tag.id, on))}
                >
                  {tag.name}
                </DropdownCheckItem>
              ))}
            </DropdownContent>
          </DropdownRoot>
        </h2>
        <div className={styles.chips}>
          {articleTags.length === 0 && (
            <span className={styles.none}>{tags.length ? "Nessun tag" : "Crea un tag nella barra laterale"}</span>
          )}
          {articleTags.map((tag) => (
            <Chip
              key={tag.id}
              icon={<TagDot color={tag.color} />}
              label={tag.name}
              onRemove={() => setTags(article.id, toggle(article.tagIds, tag.id, false))}
            />
          ))}
        </div>
      </section>
    </>
  );
}

function Chip({ icon, label, onRemove }: { icon?: ReactNode; label: string; onRemove: () => void }) {
  return (
    <span className={styles.chip}>
      {icon}
      <span className={styles.chipLabel}>{label}</span>
      <button type="button" className={styles.chipRemove} aria-label={`Rimuovi ${label}`} onClick={onRemove}>
        <X size={11} strokeWidth={2.5} />
      </button>
    </span>
  );
}
