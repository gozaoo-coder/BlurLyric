mod music_tag;
mod image_processor;
mod gpu_image_processor;
mod music_library_cache;
mod resource_cache;
mod incremental_scanner;
mod performance_monitor;
mod music_deduplicator;
mod trace;
pub use trace::{Trace, TraceDataType, SourceType, StorageType, FetchMethod, ResourceInfo, BaseModel};
mod http_proxy;
pub use http_proxy::{HttpRequest, HttpResponse, http_request, http_get, http_post};
mod models;
mod state;
pub use state::*;
mod common;
mod commands;
mod services;

use image_processor::IMAGE_PROCESSOR;
use music_library_cache::MusicLibraryCache as LibraryCacheManager;
use resource_cache::ResourceCacheManager;

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

    let mut builder = tauri::Builder::default();
    
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        builder = builder.plugin(tauri_plugin_shell::init());
    }
    
    builder
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
            music_library_cache::get_library_cache_stats,
            music_library_cache::clear_library_cache,
            music_library_cache::is_library_cache_valid,
            incremental_scanner::perform_incremental_scan,
            incremental_scanner::perform_full_scan,
            performance_monitor::get_performance_stats,
            performance_monitor::get_performance_report,
            performance_monitor::reset_performance_stats,
            performance_monitor::record_resource_load,
            performance_monitor::start_performance_timer,
            performance_monitor::end_performance_timer,
            resource_cache::cache_resource,
            resource_cache::move_resource_to_preference_pool,
            resource_cache::remove_resource_from_preference_pool,
            resource_cache::get_resource_cache_info,
            resource_cache::clear_temp_resource_cache,
            resource_cache::clear_preference_resource_cache,
            resource_cache::is_resource_cached,
            resource_cache::get_cached_resource_path,
            resource_cache::cleanup_temp_resource_cache,
            resource_cache::set_resource_cache_pool_sizes,
            resource_cache::read_cached_file,
            http_proxy::http_request,
            http_proxy::http_get,
            http_proxy::http_post,
        ])
        .setup(|_app| {
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
