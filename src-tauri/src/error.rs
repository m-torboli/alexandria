use serde::{Serialize, Serializer};

/// Errore unico dell'applicazione. Il messaggio (`Display`) è quello mostrato
/// all'utente, quindi è sempre in italiano e comprensibile.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    Invalid(String),

    #[error("Nessuna libreria aperta.")]
    NoLibrary,

    #[error("L'elemento richiesto non esiste più.")]
    NotFound,

    #[error("Errore del database: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("Errore di accesso ai file: {0}")]
    Io(#[from] std::io::Error),

    #[error("Impostazioni non leggibili: {0}")]
    Settings(#[from] serde_json::Error),

    #[error("Errore interno: {0}")]
    Internal(String),
}

impl From<tauri::Error> for AppError {
    fn from(error: tauri::Error) -> Self {
        Self::Internal(error.to_string())
    }
}

impl AppError {
    pub fn invalid(message: impl Into<String>) -> Self {
        Self::Invalid(message.into())
    }
}

/// L'interfaccia riceve l'errore come semplice stringa.
impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
