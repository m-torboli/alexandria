//! Comandi invocabili dall'interfaccia. Restano sottili: la logica sta nei
//! moduli di dominio, qui si collega soltanto lo stato condiviso.
//!
//! I comandi che toccano disco o rete sono `async` e svolgono il lavoro
//! pesante fuori dal blocco del database, così l'interfaccia resta fluida.

pub mod articles;
pub mod library;
pub mod organize;

/// Esegue un lavoro bloccante (disco, rete) su un thread dedicato.
async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> crate::error::AppResult<T> + Send + 'static,
) -> crate::error::AppResult<T> {
    tauri::async_runtime::spawn_blocking(work).await?
}
