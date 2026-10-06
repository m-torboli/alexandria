import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Gli stili globali vanno caricati prima dei componenti, così quelli specifici
// dei componenti possono sovrascriverli.
import "./styles/tokens.css";
import "./styles/base.css";
import App from "./App";
import { queryClient } from "./lib/queries";

document.documentElement.dataset.platform = navigator.userAgent.includes("Mac") ? "mac" : "other";

// Fuori dallo sviluppo, niente menu "Ispeziona" del browser: i menu sono quelli dell'app.
if (import.meta.env.PROD) {
  document.addEventListener("contextmenu", (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest("input, textarea, [contenteditable='true']")) e.preventDefault();
  });
}

// In sviluppo, aperta in un browser normale, l'interfaccia usa un backend simulato.
if (import.meta.env.DEV && !("__TAURI_INTERNALS__" in window)) {
  const { installMockBackend } = await import("./dev/mockBackend");
  installMockBackend();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
