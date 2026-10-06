import { BookOpen, CircleDashed, Inbox, Library, Star, Trash2, type LucideIcon } from "lucide-react";

import type { ViewCounts } from "./api";
import type { FixedView } from "../store/ui";

export interface FixedViewInfo {
  kind: FixedView;
  label: string;
  icon: LucideIcon;
  count: keyof ViewCounts;
  /** Messaggio quando la vista è vuota. */
  empty: string;
}

export const FIXED_VIEWS: readonly FixedViewInfo[] = [
  { kind: "all", label: "Tutti gli articoli", icon: Library, count: "all", empty: "La libreria è ancora vuota." },
  { kind: "toRead", label: "Da leggere", icon: BookOpen, count: "toRead", empty: "Nessun articolo in attesa di lettura." },
  { kind: "favorites", label: "Preferiti", icon: Star, count: "favorites", empty: "Nessun articolo tra i preferiti." },
  { kind: "incomplete", label: "Da completare", icon: CircleDashed, count: "incomplete", empty: "Tutti gli articoli hanno i dati completi." },
  { kind: "unclassified", label: "Non classificati", icon: Inbox, count: "unclassified", empty: "Ogni articolo ha la sua sezione." },
  { kind: "trash", label: "Cestino", icon: Trash2, count: "trash", empty: "Il cestino è vuoto." },
];

export const fixedView = (kind: FixedView) => FIXED_VIEWS.find((v) => v.kind === kind)!;
