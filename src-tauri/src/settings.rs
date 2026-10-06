use std::{
    fs,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};

use crate::error::AppResult;

/// Preferenze locali del computer (non fanno parte della libreria, così ogni
/// computer può tenere la libreria in un percorso diverso).
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub library_path: Option<PathBuf>,
}

impl Settings {
    /// Un file mancante o illeggibile equivale alle impostazioni predefinite.
    pub fn load(path: &Path) -> Self {
        fs::read_to_string(path)
            .ok()
            .and_then(|text| serde_json::from_str(&text).ok())
            .unwrap_or_default()
    }

    /// Scrittura atomica: prima un file temporaneo, poi la sostituzione.
    pub fn save(&self, path: &Path) -> AppResult<()> {
        if let Some(dir) = path.parent() {
            fs::create_dir_all(dir)?;
        }
        let tmp = path.with_extension("json.tmp");
        fs::write(&tmp, serde_json::to_vec_pretty(self)?)?;
        fs::rename(&tmp, path)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_and_defaults() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config").join("settings.json");

        assert!(Settings::load(&path).library_path.is_none());

        let settings = Settings {
            library_path: Some(PathBuf::from("/tmp/Alexandria")),
        };
        settings.save(&path).unwrap();
        assert_eq!(Settings::load(&path).library_path, settings.library_path);

        fs::write(&path, "non è json").unwrap();
        assert!(Settings::load(&path).library_path.is_none());
    }
}
