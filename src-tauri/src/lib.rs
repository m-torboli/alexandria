mod commands;
mod db;
mod error;
mod library;
mod sections;
mod settings;
mod state;
mod tags;
mod views;

use tauri::Manager;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let paths = app.path();
            let settings_path = paths.app_config_dir()?.join("settings.json");
            let documents = paths.document_dir().or_else(|_| paths.home_dir())?;
            app.manage(AppState::initialize(settings_path, library::default_root(&documents)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_status,
            commands::resolve_library_location,
            commands::open_library,
            commands::view_counts,
            commands::list_sections,
            commands::create_section,
            commands::rename_section,
            commands::move_section,
            commands::section_delete_preview,
            commands::delete_section,
            commands::list_tags,
            commands::create_tag,
            commands::update_tag,
            commands::delete_tag,
        ])
        .run(tauri::generate_context!())
        .expect("errore durante l'avvio di Alexandria");
}
