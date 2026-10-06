import { lazy, Suspense } from "react";

import { ConfirmHost } from "./components/ConfirmHost";
import { Toaster } from "./components/Toaster";
import { useAppStatus } from "./lib/queries";
import { useUi } from "./store/ui";
import { Welcome } from "./features/welcome/Welcome";
import { Workspace } from "./features/workspace/Workspace";

// Il lettore (con il visualizzatore di PDF.js) si carica solo quando serve.
const Reader = lazy(() => import("./features/reader/Reader").then((m) => ({ default: m.Reader })));

export default function App() {
  const status = useAppStatus();
  const readingId = useUi((s) => s.readingId);
  const hasLibrary = !!status.data?.library;

  return (
    <>
      {status.data && (hasLibrary ? <Workspace /> : <Welcome status={status.data} />)}
      {status.error && <p role="alert">{status.error.message}</p>}
      {hasLibrary && readingId !== null && (
        <Suspense fallback={null}>
          <Reader key={readingId} articleId={readingId} />
        </Suspense>
      )}
      <ConfirmHost />
      <Toaster />
    </>
  );
}
