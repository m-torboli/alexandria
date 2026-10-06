import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useEffect } from "react";

import { useImports } from "../../store/imports";
import { currentSectionId, useUi } from "../../store/ui";
import { importFiles } from "./importer";

/** Attributo che marca gli elementi su cui si possono rilasciare PDF per una sezione. */
export const SECTION_DROP_ATTR = "data-drop-section";

/** Sezione sotto il punto indicato (coordinate fisiche dello schermo). */
function sectionAt(position: { x: number; y: number }): number | null {
  const scale = window.devicePixelRatio || 1;
  const element = document.elementFromPoint(position.x / scale, position.y / scale);
  const target = element?.closest(`[${SECTION_DROP_ATTR}]`);
  const id = Number(target?.getAttribute(SECTION_DROP_ATTR));
  return Number.isFinite(id) && id > 0 ? id : null;
}

/** Riceve i PDF trascinati sulla finestra dal sistema operativo. */
export function useFileDrop() {
  useEffect(() => {
    if (!isTauri()) return;
    const { setDrag } = useImports.getState();
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    getCurrentWebview()
      .onDragDropEvent(({ payload }) => {
        switch (payload.type) {
          case "enter":
          case "over":
            setDrag(true, sectionAt(payload.position));
            break;
          case "leave":
            setDrag(false);
            break;
          case "drop": {
            setDrag(false);
            const target = sectionAt(payload.position) ?? currentSectionId(useUi.getState().view);
            importFiles(payload.paths, target);
            break;
          }
        }
      })
      .then((fn) => (cancelled ? fn() : (unlisten = fn)));

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
}
