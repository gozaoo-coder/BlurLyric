mod music_tag;
mod api;
mod cache;
mod image;
mod scanner;
mod monitoring;
mod utils;
mod trace;
pub use trace::{Trace, TraceDataType, SourceType, StorageType, FetchMethod, ResourceInfo, BaseModel};
pub use api::{HttpRequest, HttpResponse, http_request, http_get, http_post};
mod models;
mod state;
pub use state::*;
mod common;
mod commands;
mod services;

use image::IMAGE_PROCESSOR;
use cache::MusicLibraryCache as LibraryCacheManager;
use cache::ResourceCacheManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "blurlyric=info,wgpu=warn".into()),
        )
        .init();

    let _ = LibraryCacheManager::init();
    let _ = ResourceCacheManager::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::music_commands::get_music_list,
            commands::music_commands::get_all_my_albums,
            commands::music_commands::get_all_my_artists,
            commands::music_commands::get_artist_by_id,
            commands::music_commands::get_album_by_id,
            commands::music_commands::get_artists_songs_by_id,
            commands::music_commands::get_albums_songs_by_id,
            commands::music_commands::refresh_music_cache,
            commands::directory_commands::add_users_music_dir,
            commands::directory_commands::get_users_music_dir,
            commands::directory_commands::get_all_music_dirs,
            commands::directory_commands::add_music_dirs,
            commands::directory_commands::remove_music_dirs,
            commands::image_commands::get_low_quality_album_cover,
            commands::image_commands::get_album_cover,
            commands::image_commands::get_music_file,
            commands::cache_commands::get_cache_size_info,
            commands::cache_commands::clear_image_cache,
            commands::cache_commands::reset_all_data,
            commands::window_commands::close_app,
            commands::window_commands::minimize_window,
            commands::window_commands::toggle_maximize,
            commands::window_commands::toggle_always_on_top,
            commands::music_commands::init_application,
            cache::get_library_cache_stats,
            cache::clear_library_cache,
            cache::is_library_cache_valid,
            scanner::perform_incremental_scan,
            scanner::perform_full_scan,
            monitoring::get_performance_stats,
            monitoring::get_performance_report,
            monitoring::reset_performance_stats,
            monitoring::record_resource_load,
            monitoring::start_performance_timer,
            monitoring::end_performance_timer,
            cache::cache_resource,
            cache::move_resource_to_preference_pool,
            cache::remove_resource_from_preference_pool,
            cache::get_resource_cache_info,
            cache::clear_temp_resource_cache,
            cache::clear_preference_resource_cache,
            cache::is_resource_cached,
            cache::get_cached_resource_path,
            cache::cleanup_temp_resource_cache,
            cache::set_resource_cache_pool_sizes,
            cache::read_cached_file,
            http_request,
            http_get,
            http_post,
        ])
        .setup(|_app| {
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
