mod monitor;
mod music_tag;
mod network;
mod processor;
pub use network::http_proxy::{http_get, http_post, http_request, HttpRequest, HttpResponse};
mod commands;
mod common;

// 新架构模块
pub mod core_v2;
pub mod library_manager;
pub mod source_manager;
pub mod favor_system;
pub mod persistence;
pub mod sources;

use once_cell::sync::Lazy;
use std::sync::{Arc, Mutex};

// 全局事件通道
static EVENT_CHANNEL: Lazy<(tokio::sync::broadcast::Sender<core_v2::events::LibraryEvent>, tokio::sync::broadcast::Receiver<core_v2::events::LibraryEvent>)> = Lazy::new(|| {
    core_v2::events::create_event_channel()
});

// 全局单例
pub static LIBRARY_MANAGER: Lazy<library_manager::music_storage_source_library_manager::MusicStorageSourceLibraryManager> = Lazy::new(|| {
    library_manager::music_storage_source_library_manager::MusicStorageSourceLibraryManager::new(EVENT_CHANNEL.0.clone())
});

pub static SOURCE_MANAGER: Lazy<source_manager::source_manager::SourceManager> = Lazy::new(|| {
    let lm = Arc::new(Mutex::new(LIBRARY_MANAGER.clone()));
    source_manager::source_manager::SourceManager::new(lm)
});

pub static FAVOR_SYSTEM: Lazy<favor_system::favor_system::FavorSystem> = Lazy::new(|| {
    let lm = Arc::new(Mutex::new(LIBRARY_MANAGER.clone()));
    let receiver = EVENT_CHANNEL.0.subscribe();
    favor_system::favor_system::FavorSystem::new(lm, receiver)
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
