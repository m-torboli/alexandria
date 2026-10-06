import { useEffect } from "react";

import { useSections, useTags } from "../../lib/queries";
import { useUi } from "../../store/ui";
import { ArticlePane } from "../articles/ArticlePane";
import { DetailPane } from "../articles/DetailPane";
import { useFileDrop } from "../import/useFileDrop";
import { Sidebar } from "../sidebar/Sidebar";
import styles from "./Workspace.module.css";

export function Workspace() {
  useFallbackWhenViewDisappears();
  useFileDrop();

  return (
    <div className={styles.workspace}>
      <Sidebar />
      <ArticlePane />
      <DetailPane />
    </div>
  );
}

/** Se la sezione o il tag aperti non esistono più, si torna a "Tutti gli articoli". */
function useFallbackWhenViewDisappears() {
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const sections = useSections();
  const tags = useTags();

  useEffect(() => {
    const missing =
      (view.kind === "section" && sections.data && !sections.data.some((s) => s.id === view.id)) ||
      (view.kind === "tag" && tags.data && !tags.data.some((t) => t.id === view.id));
    if (missing) setView({ kind: "all" });
  }, [view, sections.data, tags.data, setView]);
}
