use lazy_static::lazy_static;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

mod performance_monitor;
use performance_monitor::{PerformanceMonitor, MetricType};

mod modules;
use modules::music_library::manager::MusicStorageSourceLibraryManager;
use modules::music_library::source::manager::SourceManager;
use modules::music_library::source::local::LocalStorageSource;
use modules::music_library::favor::favor_manager::FavorManager;

// 全局单例：新音乐资源架构
lazy_static! {
    static ref LIBRARY_MANAGER: Mutex<Option<MusicStorageSourceLibraryManager>> = Mutex::new(None);
    static ref SOURCE_MANAGER: Mutex<Option<SourceManager>> = Mutex::new(None);
    static ref FAVOR_MANAGER: Mutex<Option<FavorManager>> = Mutex::new(None);
    static ref MUSIC_DIRS: Mutex<Vec<PathBuf>> = Mutex::new(Vec::new());
}

const LIBRARY_JSON: &str = "library.json";
const SCAN_STATE_JSON: &str = "scan_state.json";
const MUSIC_DIRS_JSON: &str = "MUSIC_DIRS.json";
const PLAYER_PLAYLISTS_JSON: &str = "playlists.json";

fn get_cache_dir() -> Result<PathBuf, String> {
    let path = dirs::cache_dir().ok_or("Cannot get cache directory")?;
    let mut path = path;
    path.push("com.blurlyric.app");
    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }
    Ok(path)
}

// ── 音乐目录持久化 ──────────────────────────────────

fn load_music_dirs_from_disk() -> Result<(), String> {
    let cache_dir = get_cache_dir()?;
    let file_path = cache_dir.join(MUSIC_DIRS_JSON);
    if !file_path.exists() {
        // 首次运行：尝试添加默认音频目录
        if let Some(audio_dir) = dirs::audio_dir() {
            let mut dirs = MUSIC_DIRS.lock().unwrap();
            dirs.push(audio_dir);
        }
        return Ok(());
    }
    let file = fs::File::open(&file_path).map_err(|e| e.to_string())?;
    let dirs: Vec<PathBuf> = serde_json::from_reader(file).map_err(|e| e.to_string())?;
    *MUSIC_DIRS.lock().unwrap() = dirs;
    Ok(())
}

fn save_music_dirs_to_disk() -> Result<(), String> {
    let cache_dir = get_cache_dir()?;
    let file_path = cache_dir.join(MUSIC_DIRS_JSON);
    let dirs = MUSIC_DIRS.lock().unwrap().clone();
    let json = serde_json::to_string_pretty(&dirs).map_err(|e| e.to_string())?;
    let temp_path = file_path.with_extension("json.tmp");
    fs::write(&temp_path, &json).map_err(|e| e.to_string())?;
    fs::rename(&temp_path, &file_path).map_err(|e| e.to_string())?;
    Ok(())
}

// ── 初始化 ──────────────────────────────────────────

fn init_library_manager() -> Result<(), String> {
    let cache_dir = get_cache_dir()?;
    let library_path = cache_dir.join(LIBRARY_JSON);

    // 尝试从磁盘恢复，否则创建新的
    let manager = MusicStorageSourceLibraryManager::load_from_disk(&library_path)
        .map_err(|e| format!("Failed to load library: {}", e))?;

    if let Ok(mut guard) = LIBRARY_MANAGER.lock() {
        *guard = Some(manager);
    }

    // 初始化 SourceManager 并注册 LocalStorageSource
    let mut source_manager = SourceManager::new();
    let mut local_source = LocalStorageSource::new("local_storage");
    {
        let dirs = MUSIC_DIRS.lock().unwrap();
        for dir in dirs.iter() {
            local_source.add_path(dir.clone());
        }
    }
    source_manager.register(Box::new(local_source));

    if let Ok(mut guard) = SOURCE_MANAGER.lock() {
        *guard = Some(source_manager);
    }

    // 初始化 FavorManager
    let playlists_path = cache_dir.join(PLAYER_PLAYLISTS_JSON);
    let favor = FavorManager::load_from_disk(&playlists_path)
        .map_err(|e| format!("Failed to load playlists: {}", e))?;
    if let Ok(mut guard) = FAVOR_MANAGER.lock() {
        *guard = Some(favor);
    }

    Ok(())
}

fn perform_scan() -> Result<(), String> {
    let cache_dir = get_cache_dir()?;
    let scan_state_path = cache_dir.join(SCAN_STATE_JSON);

    let mut manager_guard = LIBRARY_MANAGER.lock().map_err(|e| e.to_string())?;
    let manager = manager_guard.as_mut().ok_or("Library not initialized")?;

    let mut source_guard = SOURCE_MANAGER.lock().map_err(|e| e.to_string())?;
    let source_manager = source_guard.as_mut().ok_or("Source manager not initialized")?;

    // 获取 LocalStorageSource
    if let Some(source) = source_manager.get_mut("local_storage") {
        if let Some(local) = source.as_any_mut().downcast_mut::<LocalStorageSource>() {
            let storage = local.storage_mut();

            // 加载 scan_state
            if let Ok(state) = modules::music_library::source::storage::ScanState::load_from_disk(&scan_state_path) {
                storage.scan_state = state;
            }

            // 增量扫描（如果已有 scan_state）或全量扫描
            if storage.scan_state.files.is_empty() {
                let summary = storage.full_scan_chunked(manager, 20)
                    .map_err(|e| format!("Scan failed: {}", e))?;
                println!("Full scan completed: {} files", summary.files_scanned);
            } else {
                let summary = storage.incremental_scan_chunked(manager, 20)
                    .map_err(|e| format!("Incremental scan failed: {}", e))?;
                println!("Incremental scan: {} changes", summary.total_changes());
            }

            // 保存 scan_state 和 library
            storage.scan_state.save_to_disk(&scan_state_path)
                .map_err(|e| format!("Failed to save scan state: {}", e))?;
        }
    }

    // 保存 library
    let library_path = cache_dir.join(LIBRARY_JSON);
    manager.save_to_disk(&library_path)
        .map_err(|e| format!("Failed to save library: {}", e))?;

    Ok(())
}

/// Load scan_state into LocalStorageSource without triggering a scan.
/// On subsequent launches the library is already cached on disk, so we just
/// restore the scan state baseline for future user-triggered incremental scans.
fn load_scan_state_only() -> Result<(), String> {
    let cache_dir = get_cache_dir()?;
    let scan_state_path = cache_dir.join(SCAN_STATE_JSON);

    let mut source_guard = SOURCE_MANAGER.lock().map_err(|e| e.to_string())?;
    let source_manager = source_guard.as_mut().ok_or("Source manager not initialized")?;

    if let Some(source) = source_manager.get_mut("local_storage") {
        if let Some(local) = source.as_any_mut().downcast_mut::<LocalStorageSource>() {
            let storage = local.storage_mut();
            if let Ok(state) =
                modules::music_library::source::storage::ScanState::load_from_disk(&scan_state_path)
            {
                storage.scan_state = state;
            }
        }
    }
    Ok(())
}

// ── Tauri 命令 ──────────────────────────────────────

#[tauri::command]
fn init_application() {
    PerformanceMonitor::start_timer("init_application");

    // 1. 加载音乐目录
    if let Err(e) = load_music_dirs_from_disk() {
        eprintln!("Failed to load music dirs: {}", e);
    }

    // 2. 初始化 LibraryManager（从磁盘加载 library.json 或创建空的）
    if let Err(e) = init_library_manager() {
        eprintln!("Failed to initialize library: {}", e);
    }

    // 3. 仅 library 为空时执行扫描（首次启动 / 数据重置后）
    let needs_scan = LIBRARY_MANAGER
        .lock()
        .ok()
        .and_then(|g| g.as_ref().map(|m| m.is_empty()))
        .unwrap_or(true);

    if needs_scan {
        println!("No cached library found, performing initial scan...");
        if let Err(e) = perform_scan() {
            eprintln!("Initial scan failed: {}", e);
        }
    } else {
        println!("Library loaded from cache, skipping scan.");
        if let Err(e) = load_scan_state_only() {
            eprintln!("Failed to load scan state (non-fatal): {}", e);
        }
    }

    if let Some(duration) = PerformanceMonitor::end_timer("init_application") {
        println!("Application initialized in {}ms", duration);
        PerformanceMonitor::record_metric(
            MetricType::ScanDuration,
            duration,
            "init_application".to_string(),
        );
    }
}

#[tauri::command]
fn get_music_list() -> Result<Vec<modules::music_library::models::song_full::SongFull>, String> {
    let guard = LIBRARY_MANAGER.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_ref().ok_or("Library not initialized")?;
    Ok(manager.resolve_all_songs())
}

#[tauri::command]
fn get_all_my_albums() -> Result<Vec<modules::music_library::models::song_full::AlbumFull>, String> {
    let guard = LIBRARY_MANAGER.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_ref().ok_or("Library not initialized")?;
    Ok(manager.resolve_all_albums())
}

#[tauri::command]
fn get_all_my_artists() -> Result<Vec<modules::music_library::models::song_full::ArtistFull>, String> {
    let guard = LIBRARY_MANAGER.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_ref().ok_or("Library not initialized")?;
    Ok(manager.resolve_all_artists())
}

#[tauri::command]
fn get_album_by_id(album_id: String) -> Result<modules::music_library::models::song_full::AlbumFull, String> {
    let guard = LIBRARY_MANAGER.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_ref().ok_or("Library not initialized")?;
    let oid = modules::music_library::object_id::ObjectId::from_string(&album_id)
        .map_err(|e| format!("Invalid album id: {}", e))?;
    manager.resolve_album_full(&oid).ok_or("Album not found".to_string())
}

#[tauri::command]
fn get_artist_by_id(artist_id: String) -> Result<modules::music_library::models::song_full::ArtistFull, String> {
    let guard = LIBRARY_MANAGER.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_ref().ok_or("Library not initialized")?;
    let oid = modules::music_library::object_id::ObjectId::from_string(&artist_id)
        .map_err(|e| format!("Invalid artist id: {}", e))?;
    manager.resolve_artist_full(&oid).ok_or("Artist not found".to_string())
}

#[tauri::command]
fn get_albums_songs_by_id(album_id: String) -> Result<Vec<modules::music_library::models::song_full::SongFull>, String> {
    let guard = LIBRARY_MANAGER.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_ref().ok_or("Library not initialized")?;
    let oid = modules::music_library::object_id::ObjectId::from_string(&album_id)
        .map_err(|e| format!("Invalid album id: {}", e))?;
    let album_full = manager.resolve_album_full(&oid).ok_or("Album not found")?;
    Ok(album_full.songs)
}

#[tauri::command]
fn get_artists_songs_by_id(artist_id: String) -> Result<Vec<modules::music_library::models::song_full::SongFull>, String> {
    let guard = LIBRARY_MANAGER.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_ref().ok_or("Library not initialized")?;
    let oid = modules::music_library::object_id::ObjectId::from_string(&artist_id)
        .map_err(|e| format!("Invalid artist id: {}", e))?;
    let artist_full = manager.resolve_artist_full(&oid).ok_or("Artist not found")?;
    Ok(artist_full.songs)
}

#[tauri::command]
async fn get_album_cover(album_id: String) -> Result<tauri::ipc::Response, String> {
    // 通过 Source 系统获取专辑封面
    let source_guard = SOURCE_MANAGER.lock().map_err(|e| e.to_string())?;
    let source_manager = source_guard.as_ref().ok_or("Source manager not initialized")?;

    // 从 LibraryManager 找到 album 关联的 SourceSong
    let library_guard = LIBRARY_MANAGER.lock().map_err(|e| e.to_string())?;
    let manager = library_guard.as_ref().ok_or("Library not initialized")?;
    let oid = modules::music_library::object_id::ObjectId::from_string(&album_id)
        .map_err(|e| format!("Invalid album id: {}", e))?;
    let album_full = manager.resolve_album_full(&oid).ok_or("Album not found")?;

    // 取第一首歌关联的 SourceAlbum 路径，通过 LocalStorageSource 获取封面
    let source = source_manager.get("local_storage").ok_or("LocalStorageSource not found")?;

    // 尝试从专辑的第一首歌的目录获取封面
    if let Some(first_song) = album_full.songs.first() {
        if let Some((_trace, source_song)) = first_song.sources.first() {
            if let Some(path) = &source_song.details.path {
                let album_path = std::path::Path::new(path).parent().map(|p| p.to_path_buf())
                    .ok_or("No parent dir")?;
                for cover_name in &["cover.jpg", "cover.png", "folder.jpg", "album.jpg"] {
                    let cover_path = album_path.join(cover_name);
                    if cover_path.exists() {
                        let data = std::fs::read(&cover_path).map_err(|e| e.to_string())?;
                        return Ok(tauri::ipc::Response::new(data));
                    }
                }
            }
        }
    }

    Err("Cover not found".to_string())
}

#[tauri::command]
async fn get_low_quality_album_cover(
    album_id: String,
    max_resolution: u32,
) -> Result<tauri::ipc::Response, String> {
    // 简化实现：直接返回原图（前端已做缩放处理）
    get_album_cover(album_id).await
}

#[tauri::command]
async fn get_music_file(song_id: String) -> Result<tauri::ipc::Response, String> {
    let path_str = {
        let library_guard = LIBRARY_MANAGER.lock().map_err(|e| e.to_string())?;
        let manager = library_guard.as_ref().ok_or("Library not initialized")?;
        let oid = modules::music_library::object_id::ObjectId::from_string(&song_id)
            .map_err(|e| format!("Invalid song id: {}", e))?;

        let result = manager.get_best_audio_stream(&oid, None)
            .ok_or("No audio source available")?;
        let (source_song, _source_id) = result;

        source_song.details.path.as_ref()
            .ok_or("No file path in source")?
            .clone()
    }; // MutexGuard 在这里释放

    let data = tokio::fs::read(&path_str).await.map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(data))
}

#[tauri::command]
fn add_music_dirs(new_dirs: Vec<String>) -> Result<(), String> {
    {
        let mut dirs = MUSIC_DIRS.lock().unwrap();
        for dir_str in &new_dirs {
            let path = PathBuf::from(dir_str);
            if !dirs.contains(&path) {
                dirs.push(path);
            }
        }
    }
    save_music_dirs_to_disk()?;

    // 通知 SourceManager 添加路径并重新扫描
    if let Ok(mut source_guard) = SOURCE_MANAGER.lock() {
        if let Some(source_manager) = source_guard.as_mut() {
            if let Some(local) = source_manager.get_mut("local_storage") {
                if let Some(local_source) = local.as_any_mut().downcast_mut::<LocalStorageSource>() {
                    for dir_str in &new_dirs {
                        local_source.add_path(PathBuf::from(dir_str));
                    }
                }
            }
        }
    }

    // 触发扫描
    if let Err(e) = perform_scan() {
        eprintln!("Scan after adding dirs failed: {}", e);
    }

    Ok(())
}

#[tauri::command]
fn remove_music_dirs(dirs_to_remove: Vec<String>) -> Result<(), String> {
    {
        let mut dirs = MUSIC_DIRS.lock().unwrap();
        dirs.retain(|dir| !dirs_to_remove.contains(&dir.display().to_string()));
    }
    save_music_dirs_to_disk()?;
    Ok(())
}

#[tauri::command]
fn get_all_music_dirs() -> Result<Vec<String>, String> {
    let dirs = MUSIC_DIRS.lock().unwrap();
    Ok(dirs.iter().map(|d| d.display().to_string()).collect())
}

#[tauri::command]
fn refresh_music_cache() -> Result<(), String> {
    perform_scan()
}

#[tauri::command]
fn perform_incremental_scan() -> Result<String, String> {
    perform_scan()?;
    Ok("Incremental scan completed".to_string())
}

#[tauri::command]
fn perform_full_scan() -> Result<String, String> {
    // 执行全量扫描 (清除 scan_state 后触发全量)
    let cache_dir = get_cache_dir()?;
    let scan_state_path = cache_dir.join(SCAN_STATE_JSON);

    // 删除 scan_state 以触发全量扫描
    let _ = std::fs::remove_file(&scan_state_path);

    perform_scan()?;
    Ok("Full scan completed".to_string())
}

#[tauri::command]
fn add_users_music_dir() {
    if let Some(audio_dir) = dirs::audio_dir() {
        let dir_str = audio_dir.to_str().unwrap().to_string();
        let _ = add_music_dirs(vec![dir_str]);
    }
}

#[tauri::command]
fn get_users_music_dir() -> String {
    dirs::audio_dir()
        .map(|dir| dir.to_str().unwrap().to_string())
        .unwrap_or_default()
}

#[tauri::command]
fn close_app(window: tauri::Window) {
    window.close().unwrap();
}

// ── 缓存管理命令 ────────────────────────────────────

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct CacheSizeInfo {
    total_size: u64,
    image_cache_size: u64,
    data_cache_size: u64,
    image_count: u32,
    file_count: u32,
}

#[tauri::command]
fn get_cache_size_info() -> Result<CacheSizeInfo, String> {
    let cache_dir = get_cache_dir()?;
    let mut total_size = 0u64;
    let mut image_cache_size = 0u64;
    let mut data_cache_size = 0u64;
    let mut image_count = 0u32;
    let mut file_count = 0u32;

    if cache_dir.exists() {
        for entry in fs::read_dir(&cache_dir).map_err(|e| e.to_string())? {
            if let Ok(entry) = entry {
                let path = entry.path();
                if let Ok(metadata) = entry.metadata() {
                    let size = metadata.len();
                    total_size += size;
                    file_count += 1;
                    let file_name = path.file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("");
                    if file_name.starts_with("album_") && file_name.ends_with(".webp") {
                        image_cache_size += size;
                        image_count += 1;
                    } else {
                        data_cache_size += size;
                    }
                }
            }
        }
    }

    Ok(CacheSizeInfo {
        total_size,
        image_cache_size,
        data_cache_size,
        image_count,
        file_count,
    })
}

#[tauri::command]
fn clear_image_cache() -> Result<u32, String> {
    let cache_dir = get_cache_dir()?;
    let mut deleted_count = 0u32;
    if cache_dir.exists() {
        for entry in fs::read_dir(&cache_dir).map_err(|e| e.to_string())? {
            if let Ok(entry) = entry {
                let path = entry.path();
                let file_name = path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("");
                if file_name.starts_with("album_") && file_name.ends_with(".webp") {
                    fs::remove_file(&path).map_err(|e| format!("Failed to delete {}: {}", file_name, e))?;
                    deleted_count += 1;
                }
            }
        }
    }
    Ok(deleted_count)
}

#[tauri::command]
fn reset_all_data() -> Result<(), String> {
    let cache_dir = get_cache_dir()?;

    // 清空内存
    *LIBRARY_MANAGER.lock().unwrap() = None;
    *SOURCE_MANAGER.lock().unwrap() = None;
    *FAVOR_MANAGER.lock().unwrap() = None;
    *MUSIC_DIRS.lock().unwrap() = Vec::new();

    // 删除缓存目录中的所有文件
    if cache_dir.exists() {
        for entry in fs::read_dir(&cache_dir).map_err(|e| e.to_string())? {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_file() {
                    let _ = fs::remove_file(&path);
                }
            }
        }
    }

    println!("All application data has been reset");
    Ok(())
}

#[tauri::command]
fn is_cache_valid() -> bool {
    LIBRARY_MANAGER.lock()
        .ok()
        .and_then(|g| g.as_ref().map(|m| !m.is_empty()))
        .unwrap_or(false)
}

#[tauri::command]
fn get_cache_stats() -> Result<String, String> {
    let guard = LIBRARY_MANAGER.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_ref().ok_or("Library not initialized")?;
    let stats = serde_json::json!({
        "song_count": manager.all_master_songs().len(),
        "album_count": manager.all_master_albums().len(),
        "artist_count": manager.all_master_artists().len(),
        "source_count": manager.all_source_songs().len(),
        "object_count": manager.len(),
    });
    Ok(stats.to_string())
}

#[tauri::command]
fn clear_music_cache() -> Result<(), String> {
    let cache_dir = get_cache_dir()?;
    // 重新创建空的 LibraryManager
    let manager = MusicStorageSourceLibraryManager::new();
    let library_path = cache_dir.join(LIBRARY_JSON);
    manager.save_to_disk(&library_path).map_err(|e| e.to_string())?;
    if let Ok(mut guard) = LIBRARY_MANAGER.lock() {
        *guard = Some(manager);
    }
    Ok(())
}

// ── 应用入口 ────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // 音乐库命令
            init_application,
            get_music_list,
            get_all_my_albums,
            get_all_my_artists,
            get_album_by_id,
            get_artist_by_id,
            get_albums_songs_by_id,
            get_artists_songs_by_id,
            // 资源加载
            get_album_cover,
            get_low_quality_album_cover,
            get_music_file,
            // 音乐目录管理
            get_all_music_dirs,
            add_music_dirs,
            remove_music_dirs,
            add_users_music_dir,
            get_users_music_dir,
            // 扫描管理
            refresh_music_cache,
            perform_incremental_scan,
            perform_full_scan,
            // 缓存管理
            get_cache_size_info,
            clear_image_cache,
            reset_all_data,
            is_cache_valid,
            get_cache_stats,
            clear_music_cache,
            // 其他
            close_app,
            // 性能监控
            performance_monitor::get_performance_stats,
            performance_monitor::get_performance_report,
            performance_monitor::reset_performance_stats,
            performance_monitor::record_resource_load,
            performance_monitor::start_performance_timer,
            performance_monitor::end_performance_timer,
        ])
        .setup(|_app| {
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
