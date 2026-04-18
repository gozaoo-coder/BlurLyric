mod monitor;
mod music_tag;
mod network;
mod processor;
pub use network::http_proxy::{http_get, http_post, http_request, HttpRequest, HttpResponse};
mod commands;
mod common;

// 新架构模块
mod core_v2;
mod library_manager;
mod source_manager;
mod favor_system;
mod persistence;
mod sources;

use processor::image_processor::IMAGE_PROCESSOR;
use once_cell::sync::Lazy;

// 全局单例
pub static LIBRARY_MANAGER: Lazy<library_manager::music_storage_source_library_manager::MusicStorageSourceLibraryManager> = Lazy::new(|| {
    library_manager::music_storage_source_library_manager::MusicStorageSourceLibraryManager::new()
});

pub static SOURCE_MANAGER: Lazy<source_manager::source_manager::SourceManager> = Lazy::new(|| {
    source_manager::source_manager::SourceManager::new()
});

pub static FAVOR_SYSTEM: Lazy<favor_system::favor_system::FavorSystem> = Lazy::new(|| {
    favor_system::favor_system::FavorSystem::new()
});

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "blurlyric=info,wgpu=warn".into()),
        )
        .init();

    // 初始化新系统
    let _ = persistence::library_cache::LibraryCache::init();

    let mut builder = tauri::Builder::default();

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        builder = builder.plugin(tauri_plugin_shell::init());
    }

    builder
        .invoke_handler(tauri::generate_handler![
            // 保留必要的命令
            commands::window_commands::close_app,
            commands::window_commands::minimize_window,
            commands::window_commands::toggle_maximize,
            commands::window_commands::toggle_always_on_top,
            monitor::performance_monitor::get_performance_stats,
            monitor::performance_monitor::get_performance_report,
            monitor::performance_monitor::reset_performance_stats,
            monitor::performance_monitor::record_resource_load,
            monitor::performance_monitor::start_performance_timer,
            monitor::performance_monitor::end_performance_timer,
            network::http_proxy::http_request,
            network::http_proxy::http_get,
            network::http_proxy::http_post,
        ])
        .setup(|_app| Ok(()))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
