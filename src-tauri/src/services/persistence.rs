// 数据持久化与应用初始化服务
//
// 本模块负责：
// - 应用启动时的初始化流程
// - 从持久化缓存加载数据到内存
// - 将内存数据保存到持久化缓存
// - 后台增量扫描

use std::collections::HashMap;
use std::path::PathBuf;
use tracing::{debug, error, info, warn};

use super::scanner::{cache_music_list, parse_music_file, scan_music_files};
use crate::common::utils;
use crate::core::incremental_scanner::IncrementalScanner;
use crate::models::legacy::{Album, Artist, Song, TrackSourceInfo};
use crate::models::Track;
use crate::cache::music_library_cache::{
    CachedAlbum, CachedArtist, CachedSongMetadata, FileFingerprint,
    MusicLibraryCache as LibraryCacheManager, MusicLibraryCacheData,
};
use crate::monitor::performance_monitor::{MetricType, PerformanceMonitor};
use crate::state::*;
use crate::core::trace::{ResourceInfo, Trace, TraceDataType};

/// 应用初始化入口
///
/// 执行以下步骤：
/// 1. 初始化音乐库缓存管理器
/// 2. 初始化资源缓存管理器
/// 3. 加载音乐目录配置
/// 4. 尝试从持久化缓存加载（快速启动）
///    - 如果缓存有效：加载后执行后台增量扫描
///    - 如果缓存无效：执行全量扫描并保存缓存
pub fn init_application() {
    PerformanceMonitor::start_timer("init_application");
    info!("Initializing application with optimized resource management");

    // 1. 初始化音乐库缓存管理器
    if let Err(e) = LibraryCacheManager::init() {
        error!(error = %e, "Failed to initialize music library cache");
    }

    // 2. 初始化资源缓存管理器（已在 run() 中初始化，此处可移除）

    // 3. 加载音乐目录
    if let Err(e) = load_music_dirs_from_disk() {
        error!(error = %e, "Failed to load music directories from disk");
    }

    // 4. 尝试从缓存加载数据（快速启动）
    let cache_loaded = load_from_persistent_cache();

    if !cache_loaded {
        info!("No valid cache found, performing full scan");
        // 首次启动或缓存无效,执行全量扫描
        if let Err(e) = refresh_music_cache() {
            error!(error = %e, "Failed to refresh music cache");
        }
        // 保存到持久化缓存
        save_to_persistent_cache();
    } else {
        info!("Loaded from cache successfully, performing incremental scan");
        // 后台执行增量扫描更新缓存
        perform_background_incremental_scan();
    }

    if let Some(duration) = PerformanceMonitor::end_timer("init_application") {
        info!(
            init_duration_ms = duration,
            "Application initialization completed"
        );
        PerformanceMonitor::record_metric(
            MetricType::ScanDuration,
            duration,
            "init_application".to_string(),
        );
    }
}

/// 从持久化缓存加载数据
///
/// 尝试从磁盘读取缓存的元数据，
/// 如果成功则重建内存中的数据结构。
///
/// # 返回值
/// - `true`: 成功从缓存加载
/// - `false`: 缓存不存在或无效
pub fn load_from_persistent_cache() -> bool {
    if let Some(manager_guard) = LibraryCacheManager::instance() {
        if let Some(manager) = manager_guard.as_ref() {
            match manager.load_from_disk() {
                Ok(cache) => {
                    if cache.songs.is_empty() {
                        return false;
                    }

                    // 将缓存数据加载到内存
                    rebuild_memory_cache_from_persistent(&cache);
                    info!(
                        song_count = cache.songs.len(),
                        "Loaded songs from persistent cache"
                    );
                    return true;
                }
                Err(e) => {
                    error!(error = %e, "Failed to load from persistent cache");
                }
            }
        }
    }
    false
}

/// 从持久化缓存重建内存缓存
///
/// 这是核心重建函数（约180行），
/// 负责将磁盘上的缓存数据完整还原到内存数据结构中。
///
/// 处理内容包括：
/// - 重置 ID 计数器
/// - 重建艺术家、专辑缓存
/// - 重建歌曲缓存和目录映射
/// - 重建艺术家-歌曲、专辑-歌曲映射关系
/// - 构建 TrackSourceInfo 和 Trace 对象
///
/// # 参数
/// - `cache`: 从磁盘读取的缓存数据
pub fn rebuild_memory_cache_from_persistent(cache: &MusicLibraryCacheData) {
    // 重置计数器
    let max_song_id = cache.songs.iter().map(|s| s.id).max().unwrap_or(0);
    let max_artist_id = cache.artists.iter().map(|a| a.id).max().unwrap_or(0);
    let max_album_id = cache.albums.iter().map(|a| a.id).max().unwrap_or(0);

    *SONG_ID_COUNTER.lock().unwrap_or_else(|e| e.into_inner()) = max_song_id;
    *ARTIST_ID_COUNTER.lock().unwrap_or_else(|e| e.into_inner()) = max_artist_id;
    *ALBUM_ID_COUNTER.lock().unwrap_or_else(|e| e.into_inner()) = max_album_id;

    // 重建艺术家缓存
    {
        let mut artist_cache = ARTIST_CACHE.lock().unwrap_or_else(|e| e.into_inner());
        artist_cache.clear();
        for artist in &cache.artists {
            artist_cache.insert(
                artist.name.clone(),
                Artist {
                    id: artist.id,
                    name: artist.name.clone(),
                    alias: artist.alias.clone(),
                },
            );
        }
    }

    // 重建专辑缓存
    {
        let mut album_cache = ALBUM_CACHE.lock().unwrap_or_else(|e| e.into_inner());
        album_cache.clear();
        for album in &cache.albums {
            album_cache.insert(
                album.name.clone(),
                Album {
                    id: album.id,
                    name: album.name.clone(),
                    pic_url: album.pic_url.clone(),
                },
            );
        }
    }

    // 重建歌曲缓存和映射关系
    {
        let mut music_cache = MUSIC_CACHE.lock().unwrap_or_else(|e| e.into_inner());
        let mut artist_songs_map = ARTIST_SONGS_MAP.lock().unwrap_or_else(|e| e.into_inner());
        let mut album_songs_map = ALBUM_SONGS_MAP.lock().unwrap_or_else(|e| e.into_inner());

        music_cache.clear();
        artist_songs_map.clear();
        album_songs_map.clear();

        // 按目录组织歌曲
        let mut dir_songs: HashMap<PathBuf, Vec<Song>> = HashMap::new();

        for cached_song in &cache.songs {
            let dir = cached_song
                .fingerprint
                .path
                .parent()
                .map(|p| p.to_path_buf())
                .unwrap_or_default();

            // 查找艺术家和专辑
            let artists: Vec<Artist> = cached_song
                .artists
                .iter()
                .filter_map(|name| {
                    ARTIST_CACHE
                        .lock()
                        .unwrap_or_else(|e| e.into_inner())
                        .get(name)
                        .cloned()
                })
                .collect();

            let album = ALBUM_CACHE
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .get(&cached_song.album)
                .cloned()
                .unwrap_or_else(|| Album {
                    id: 0,
                    name: cached_song.album.clone(),
                    pic_url: String::new(),
                });

            // 从缓存的来源信息构建sources
            let mut sources = Vec::new();

            // 主来源
            if let Some(ref primary) = cached_song.primary_source {
                sources.push(TrackSourceInfo {
                    id: primary.id,
                    path: primary.path.display().to_string(),
                    format: primary.format.clone(),
                    bitrate: primary.bitrate,
                    sample_rate: primary.sample_rate,
                    duration: primary.duration,
                    quality_score: primary.quality_score,
                    file_size: primary.file_size,
                });
            } else {
                // 如果没有主来源，从fingerprint构建
                let format = cached_song
                    .fingerprint
                    .path
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("unknown")
                    .to_string();

                sources.push(TrackSourceInfo {
                    id: cached_song.id,
                    path: cached_song.fingerprint.path.display().to_string(),
                    format,
                    bitrate: None,
                    sample_rate: None,
                    duration: cached_song.duration,
                    quality_score: 0,
                    file_size: cached_song.fingerprint.size,
                });
            }

            // 替代来源
            for source in &cached_song.alternative_sources {
                sources.push(TrackSourceInfo {
                    id: source.id,
                    path: source.path.display().to_string(),
                    format: source.format.clone(),
                    bitrate: source.bitrate,
                    sample_rate: source.sample_rate,
                    duration: source.duration,
                    quality_score: source.quality_score,
                    file_size: source.file_size,
                });
            }

            // 构建 Trace 列表（从 sources 转换）
            let traces: Vec<Trace> = sources
                .iter()
                .map(|s| {
                    Trace::local_file(s.path.clone(), TraceDataType::Track, s.id.to_string())
                        .with_resource_info(ResourceInfo {
                            format: Some(s.format.clone()),
                            bitrate: s.bitrate,
                            sample_rate: s.sample_rate,
                            size: Some(s.file_size),
                            duration: s.duration,
                            quality_score: Some(s.quality_score),
                        })
                })
                .collect();

            let song = Song {
                name: cached_song.name.clone(),
                id: cached_song.id,
                ar: artists,
                lyric: cached_song.lyric.clone(),
                al: album,
                src: cached_song.fingerprint.path.clone(),
                track_number: cached_song.track_number,
                // 新增字段
                duration: cached_song.duration,
                genre: cached_song.genre.clone(),
                year: cached_song.year,
                comment: cached_song.comment.clone(),
                composer: cached_song.composer.clone(),
                lyricist: cached_song.lyricist.clone(),
                bitrate: sources.first().and_then(|s| s.bitrate),
                sample_rate: sources.first().and_then(|s| s.sample_rate),
                channels: None, // 缓存中暂时没有声道数
                other_tags: None,
                // 去重合并相关字段（旧格式，向后兼容）
                sources,
                primary_source_index: 0,
                // 新格式：Trace 来源追踪
                traces,
                primary_trace_index: 0,
            };

            // TODO(Phase 2): 未来可使用 Track::from(song) 直接转换为新的统一模型
            // let track: Track = song.clone().into();
            // 目前保持 legacy Song 以确保运行时兼容性

            // 更新映射
            for artist in &song.ar {
                artist_songs_map
                    .entry(artist.id)
                    .or_insert_with(Vec::new)
                    .push(song.clone());
            }

            album_songs_map
                .entry(song.al.id)
                .or_insert_with(Vec::new)
                .push(song.clone());

            dir_songs.entry(dir).or_insert_with(Vec::new).push(song);
        }

        *music_cache = dir_songs;
    }
}

/// 保存到持久化缓存
///
/// 将当前内存中的数据构建为持久化格式并保存到磁盘。
pub fn save_to_persistent_cache() {
    if let Some(manager_guard) = LibraryCacheManager::instance() {
        if let Some(manager) = manager_guard.as_ref() {
            // 从内存缓存构建持久化缓存
            let cache = build_persistent_cache_from_memory();

            if let Err(e) = manager.save_to_disk(&cache) {
                error!(error = %e, "Failed to save to persistent cache");
            } else {
                manager.update_memory_cache(cache);
                info!("Saved to persistent cache successfully");
            }
        }
    }
}

/// 从内存缓存构建持久化缓存
///
/// 将内存中的所有数据结构转换为可序列化的缓存格式，
/// 包括：
/// - 艺术家列表
/// - 专辑列表
/// - 歌曲列表（含文件指纹）
/// - 映射关系（艺术家-歌曲、专辑-歌曲）
///
/// # 返回值
/// 构建好的 MusicLibraryCacheData 对象
pub fn build_persistent_cache_from_memory() -> MusicLibraryCacheData {
    use crate::cache::music_library_cache::{
        CachedAlbum, CachedArtist, CachedSongMetadata, FileFingerprint,
    };
    let now = utils::current_timestamp();
    let mut cache = MusicLibraryCacheData::new();

    // 复制艺术家
    {
        let artist_cache = ARTIST_CACHE.lock().unwrap_or_else(|e| e.into_inner());
        for (_, artist) in artist_cache.iter() {
            cache.artists.push(CachedArtist {
                id: artist.id,
                name: artist.name.clone(),
                alias: artist.alias.clone(),
            });
        }
    }

    // 复制专辑
    {
        let album_cache = ALBUM_CACHE.lock().unwrap_or_else(|e| e.into_inner());
        for (_, album) in album_cache.iter() {
            cache.albums.push(CachedAlbum {
                id: album.id,
                name: album.name.clone(),
                pic_url: album.pic_url.clone(),
            });
        }
    }

    // 复制歌曲
    {
        let music_cache = MUSIC_CACHE.lock().unwrap_or_else(|e| e.into_inner());
        for (_, songs) in music_cache.iter() {
            for song in songs {
                let fingerprint = match FileFingerprint::from_path(&song.src) {
                    Ok(fp) => fp,
                    Err(_) => continue,
                };

                cache.songs.push(CachedSongMetadata {
                    id: song.id,
                    name: song.name.clone(),
                    artists: song.ar.iter().map(|a| a.name.clone()).collect(),
                    album: song.al.name.clone(),
                    track_number: song.track_number,
                    lyric: song.lyric.clone(),
                    fingerprint,
                    cached_at: now,
                    // 新增字段
                    primary_source: None,
                    alternative_sources: Vec::new(),
                    duration: song.duration,
                    genre: song.genre.clone(),
                    year: song.year,
                    comment: song.comment.clone(),
                    composer: song.composer.clone(),
                    lyricist: song.lyricist.clone(),
                });
            }
        }
    }

    // 复制映射关系
    {
        let artist_songs_map = ARTIST_SONGS_MAP.lock().unwrap_or_else(|e| e.into_inner());
        for (artist_id, songs) in artist_songs_map.iter() {
            cache
                .artist_songs_map
                .insert(*artist_id, songs.iter().map(|s| s.id).collect());
        }
    }

    {
        let album_songs_map = ALBUM_SONGS_MAP.lock().unwrap_or_else(|e| e.into_inner());
        for (album_id, songs) in album_songs_map.iter() {
            cache
                .album_songs_map
                .insert(*album_id, songs.iter().map(|s| s.id).collect());
        }
    }

    cache.cached_at = now;
    cache
}

/// 后台执行增量扫描
///
/// 在独立线程中运行增量扫描，
/// 检测文件变化并更新缓存。
///
/// 执行流程：
/// 1. 加载现有缓存
/// 2. 使用 IncrementalScanner 执行增量扫描
/// 3. 如果有变化，更新磁盘和内存缓存
pub fn perform_background_incremental_scan() {
    std::thread::spawn(|| {
        info!("Starting background incremental scan");
        PerformanceMonitor::start_timer("background_scan");

        // 执行增量扫描
        let music_dirs = get_music_dirs();

        let existing_cache = if let Some(manager_guard) = LibraryCacheManager::instance() {
            if let Some(manager) = manager_guard.as_ref() {
                manager
                    .load_from_disk()
                    .unwrap_or_else(|_| MusicLibraryCacheData::new())
            } else {
                MusicLibraryCacheData::new()
            }
        } else {
            MusicLibraryCacheData::new()
        };

        let max_song_id = existing_cache.songs.iter().map(|s| s.id).max().unwrap_or(0);
        let max_artist_id = existing_cache
            .artists
            .iter()
            .map(|a| a.id)
            .max()
            .unwrap_or(0);
        let max_album_id = existing_cache
            .albums
            .iter()
            .map(|a| a.id)
            .max()
            .unwrap_or(0);

        let scanner = IncrementalScanner::new(max_song_id, max_artist_id, max_album_id);

        match scanner.scan_incremental(&music_dirs, &existing_cache) {
            Ok(scan_result) => {
                if scan_result.total_changes() > 0 {
                    info!(
                        changes = scan_result.total_changes(),
                        "Background scan found changes, updating cache"
                    );

                    let new_cache = crate::core::incremental_scanner::build_cache_from_scan(
                        scan_result,
                        Some(&existing_cache),
                    );

                    // 保存新缓存
                    if let Some(manager_guard) = LibraryCacheManager::instance() {
                        if let Some(manager) = manager_guard.as_ref() {
                            let _ = manager.save_to_disk(&new_cache);
                            manager.update_memory_cache(new_cache);
                        }
                    }

                    // 更新内存缓存
                    rebuild_memory_cache_from_persistent(
                        &LibraryCacheManager::instance()
                            .unwrap()
                            .as_ref()
                            .unwrap()
                            .load_from_disk()
                            .unwrap(),
                    );
                } else {
                    info!("No changes detected in background scan");
                }
            }
            Err(e) => {
                error!(error = %e, "Background incremental scan failed");
            }
        }

        if let Some(duration) = PerformanceMonitor::end_timer("background_scan") {
            info!(duration_ms = duration, "Background scan completed");
            PerformanceMonitor::record_metric(
                MetricType::ScanDuration,
                duration,
                "background_scan".to_string(),
            );
        }
    });
}

// ========== 辅助函数（内部使用）==========

/// 刷新音乐缓存（全量扫描）
///
/// 重置所有 ID 计数器和缓存，
/// 然后重新扫描所有音乐目录。
fn refresh_music_cache() -> Result<(), String> {
    // 重置ID计数器
    *SONG_ID_COUNTER
        .lock()
        .map_err(|e| format!("Mutex poisoned: {}", e))? = 0;
    *ARTIST_ID_COUNTER
        .lock()
        .map_err(|e| format!("Mutex poisoned: {}", e))? = 0;
    *ALBUM_ID_COUNTER
        .lock()
        .map_err(|e| format!("Mutex poisoned: {}", e))? = 0;

    // 清空音乐、艺术家和专辑的缓存
    MUSIC_CACHE
        .lock()
        .map_err(|e| format!("Mutex poisoned: {}", e))?
        .clear();
    ARTIST_CACHE
        .lock()
        .map_err(|e| format!("Mutex poisoned: {}", e))?
        .clear();
    ALBUM_CACHE
        .lock()
        .map_err(|e| format!("Mutex poisoned: {}", e))?
        .clear();
    ARTIST_SONGS_MAP
        .lock()
        .map_err(|e| format!("Mutex poisoned: {}", e))?
        .clear();
    ALBUM_SONGS_MAP
        .lock()
        .map_err(|e| format!("Mutex poisoned: {}", e))?
        .clear();

    let music_dirs = MUSIC_DIRS
        .lock()
        .map_err(|e| format!("Mutex poisoned: {}", e))?;
    let mut new_cache = HashMap::new();

    for dir in &*music_dirs {
        info!(scan_dir = %dir.display(), "Scanning music files");

        if dir.is_dir() {
            let songs = scan_music_files(dir);
            let parsed_songs: Result<Vec<Song>, String> =
                songs.into_iter().map(parse_music_file).collect();
            match parsed_songs {
                Ok(songs) => {
                    new_cache.insert(dir.clone(), songs);
                }
                Err(e) => {
                    error!(error = %e, dir = %dir.display(), "Error parsing music files");
                    return Err(e);
                }
            }
        } else {
            warn!(path = %dir.display(), "Path is not a directory");
            return Err(format!("Path is not a directory: {}", dir.display()));
        }
    }

    *MUSIC_CACHE
        .lock()
        .map_err(|e| format!("Mutex poisoned: {}", e))? = new_cache;
    Ok(())
}

/// 从磁盘加载音乐目录配置
fn load_music_dirs_from_disk() -> Result<(), String> {
    let cache_dir = utils::get_base_cache_dir()?;
    debug!(cache_dir = ?cache_dir, "Cache directory");
    if !cache_dir.exists() {
        if let Err(e) = std::fs::create_dir_all(&cache_dir) {
            return Err(format!("Failed to create cache directory: {}", e));
        }
    }
    let file_path = cache_dir.join("MUSIC_DIRS.json");
    debug!(file_path = ?file_path, "File path");
    if !file_path.exists() {
        let audio_dir = dirs::audio_dir().ok_or("No default audio directory found")?;
        let dirs = vec![audio_dir];
        let file = match std::fs::File::create(&file_path) {
            Ok(f) => f,
            Err(e) => return Err(format!("Failed to create file: {}", e)),
        };
        if let Err(e) = serde_json::to_writer(&file, &dirs) {
            return Err(format!("Failed to write to file: {}", e));
        }
    } else {
        let file = std::fs::File::open(&file_path).map_err(|e| e.to_string())?;
        let dirs: Vec<PathBuf> = serde_json::from_reader(file).map_err(|e| e.to_string())?;
        let mut music_dirs = MUSIC_DIRS
            .lock()
            .map_err(|e| format!("Mutex poisoned: {}", e))?;
        *music_dirs = dirs;
    }
    Ok(())
}

// ==================== 辅助函数（模型转换）====================

/// 将 legacy Song 列表转换为新的 Track 列表
///
/// # 使用场景
/// - 前端请求歌曲列表时，可使用此函数批量转换
/// - Phase 2 迁移时可直接替换内存缓存结构
///
/// # 示例
/// ```ignore
/// let songs: Vec<Song> = get_songs_from_cache();
/// let tracks: Vec<Track> = convert_songs_to_tracks(&songs);
/// ```
#[allow(dead_code)]
pub fn convert_songs_to_tracks(songs: &[Song]) -> Vec<Track> {
    songs.iter().map(|s| Track::from(s.clone())).collect()
}

/// 从 CachedSongMetadata 转换为 Track（单首）
///
/// # 使用场景
/// - 缓存加载时逐条转换
/// - 增量扫描结果处理
#[allow(dead_code)]
pub fn convert_cached_song_to_track(cached: &CachedSongMetadata) -> Track {
    Track::from(cached.clone())
}
