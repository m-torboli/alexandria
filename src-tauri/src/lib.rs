mod articles;
mod backup;
mod commands;
mod db;
mod error;
mod files;
mod importer;
mod library;
mod lock;
mod metadata;
mod query;
mod search;
mod sections;
mod settings;
mod state;
mod tags;
mod views;

use tauri::{Manager, RunEvent};

use commands::{articles as art, library as lib, organize as org};
use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let paths = app.path();
            let settings_path = paths.app_config_dir()?.join("settings.json");
            let documents = paths.document_dir().or_else(|_| paths.home_dir())?;
            app.manage(AppState::initialize(settings_path, library::default_root(&documents)));

            // Segnale periodico "libreria in uso" (vedi lock.rs).
            let handle = app.handle().clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(lock::HEARTBEAT);
                handle.state::<AppState>().heartbeat();
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            lib::app_status,
            lib::resolve_library_location,
            lib::open_library,
            lib::view_counts,
            org::list_sections,
            org::create_section,
            org::rename_section,
            org::move_section,
            org::section_delete_preview,
            org::delete_section,
            org::list_tags,
            org::create_tag,
            org::update_tag,
            org::delete_tag,
            art::list_articles,
            art::filter_options,
            art::export_articles,
            art::save_bibliography,
            art::set_article_notes,
            art::get_article,
            art::import_pdf,
            art::read_article_pdf,
            art::save_pdf_info,
            art::lookup_doi,
            art::update_article_metadata,
            art::set_reading_status,
            art::set_favorite,
            art::set_article_sections,
            art::set_article_tags,
            art::trash_articles,
            art::restore_articles,
            art::delete_articles_forever,
            art::empty_trash,
            art::open_article_pdf,
            art::reveal_article_pdf,
        ])
        .build(tauri::generate_context!())
        .expect("errore durante l'avvio di Alexandria");

    app.run(|app, event| {
        if let RunEvent::Exit = event {
            app.state::<AppState>().shutdown();
        }
    });
}
