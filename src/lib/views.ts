import {
  BookCheck,
  BookMarked,
  BookOpen,
  CircleDashed,
  Inbox,
  Library,
  Star,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import type { ReadingStatus, ViewCounts } from "./api";
import type { FixedView } from "../store/ui";

export interface FixedViewInfo {
  kind: FixedView;
  label: string;
  icon: LucideIcon;
  count: keyof ViewCounts;
  /** Messaggio quando la vista è vuota. */
  empty: string;
  /** Viste per stato di lettura: l'icona prende il colore dello stato. */
  status?: ReadingStatus;
}

export const FIXED_VIEWS: readonly FixedViewInfo[] = [
  { kind: "all", label: "Tutti gli articoli", icon: Library, count: "all", empty: "La libreria è ancora vuota." },
  { kind: "toRead", label: "Da leggere", icon: BookMarked, count: "toRead", empty: "Nessun articolo in attesa di lettura.", status: 0 },
  { kind: "reading", label: "In lettura", icon: BookOpen, count: "reading", empty: "Nessun articolo in lettura.", status: 1 },
  { kind: "read", label: "Letti", icon: BookCheck, count: "read", empty: "Nessun articolo ancora letto.", status: 2 },
  { kind: "favorites", label: "Preferiti", icon: Star, count: "favorites", empty: "Nessun articolo tra i preferiti." },
  { kind: "incomplete", label: "Da completare", icon: CircleDashed, count: "incomplete", empty: "Tutti gli articoli hanno i dati completi." },
  { kind: "unclassified", label: "Non classificati", icon: Inbox, count: "unclassified", empty: "Ogni articolo ha la sua sezione." },
  { kind: "trash", label: "Cestino", icon: Trash2, count: "trash", empty: "Il cestino è vuoto." },
];

export const fixedView = (kind: FixedView) => FIXED_VIEWS.find((v) => v.kind === kind)!;

/** Nome e colore (variabile CSS) di ciascuno stato di lettura. */
export const READING_STATUS: Record<ReadingStatus, { label: string; color: string }> = {
  0: { label: "Da leggere", color: "var(--status-to-read)" },
  1: { label: "In lettura", color: "var(--status-reading)" },
  2: { label: "Letto", color: "var(--status-read)" },
};
