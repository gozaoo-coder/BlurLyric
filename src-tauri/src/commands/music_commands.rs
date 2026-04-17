//! 音乐查询命令模块
//!
//! 包含音乐列表、艺术家、专辑相关的查询和管理命令

use crate::trace::{Trace, TraceDataType, ResourceInfo};
use crate::music_tag::MetadataParser;
use crate::monitoring::{PerformanceMonitor, MetricType};
use crate::cache::MusicLibraryCacheData;
use crate::cache::MusicLibraryCache as LibraryCacheManager;
use crate::scanner::{IncrementalScanner, ScanResult};
use std::collections::HashMap;
use std::path::PathBuf;
use tracing::{info, warn, error};

use crate::state::*;
use crate::models::legacy::{Song, Artist, Album, TrackSourceInfo};
use crate::common::utils;
use crate::services::scanner::{is_music_file, calculate_quality_score};

/// 获取所有专辑
#[tauri::command]
pub fn get_all_my_albums() -> Result<Vec<Album>, String> {
    let album_cache = ALBUM_CACHE.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
    let albums = album_cache.values().cloned().collect();
    Ok(albums)
}

/// 获取所有艺术家
#[tauri::command]
pub fn get_all_my_artists() -> Result<Vec<Artist>, String> {
    let artist_cache = ARTIST_CACHE.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
    let artists = artist_cache.values().cloned().collect();
    Ok(artists)
}

/// 获取音乐列表（带去重合并）
#[tauri::command]
pub fn get_music_list() -> Result<Vec<Song>, String> {
    let cache = MUSIC_CACHE.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
    let all_songs: Vec<Song> = cache
        .values()
        .flat_map(|songs| songs.iter().cloned())
        .collect();

    // 执行去重合并
    let deduplicated = deduplicate_songs(all_songs);
    Ok(deduplicated)
}

/// 根据ID获取艺术家
#[tauri::command]
pub fn get_artist_by_id(artist_id: u32) -> Result<Artist, String> {
    // 使用 O(1) 索引查找艺术家
    let artist_index = ARTIST_INDEX.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
    artist_index
        .get(&artist_id)
        .cloned()
        .ok_or_else(|| "Artist not found".to_string())
}

/// 根据ID获取专辑
#[tauri::command]
pub fn get_album_by_id(album_id: u32) -> Result<Album, String> {
    // 使用 O(1) 索引查找专辑
    let album_index = ALBUM_INDEX.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
    album_index
        .get(&album_id)
        .cloned()
        .ok_or_else(|| "Album not found".to_string())
}

/// 根据艺术家ID获取其歌曲列表
#[tauri::command]
pub fn get_artists_songs_by_id(artist_id: u32) -> Result<Vec<Song>, String> {
    let artist_songs_map = ARTIST_SONGS_MAP.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
    let songs = artist_songs_map.get(&artist_id).cloned().unwrap_or_default();
    // 执行去重合并
    let deduplicated = deduplicate_songs(songs);
    Ok(deduplicated)
}

/// 根据专辑ID获取其歌曲列表
#[tauri::command]
pub fn get_albums_songs_by_id(album_id: u32) -> Result<Vec<Song>, String> {
    let album_songs_map = ALBUM_SONGS_MAP.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
    let songs = album_songs_map.get(&album_id).cloned().unwrap_or_default();
    // 执行去重合并
    let deduplicated = deduplicate_songs(songs);
    Ok(deduplicated)
}

/// 刷新音乐缓存（重新扫描所有音乐目录）
#[tauri::command]
pub fn refresh_music_cache() -> Result<(), String> {
    use super::directory_commands::remove_music_dirs;

    // 重置ID计数器
    *SONG_ID_COUNTER.lock().map_err(|e| format!("Mutex poisoned: {}", e))? = 0;
    *ARTIST_ID_COUNTER.lock().map_err(|e| format!("Mutex poisoned: {}", e))? = 0;
    *ALBUM_ID_COUNTER.lock().map_err(|e| format!("Mutex poisoned: {}", e))? = 0;

    // 清空音乐、艺术家和专辑的缓存
    MUSIC_CACHE.lock().map_err(|e| format!("Mutex poisoned: {}", e))?.clear();
    ARTIST_CACHE.lock().map_err(|e| format!("Mutex poisoned: {}", e))?.clear();
    ALBUM_CACHE.lock().map_err(|e| format!("Mutex poisoned: {}", e))?.clear();
    ARTIST_SONGS_MAP.lock().map_err(|e| format!("Mutex poisoned: {}", e))?.clear();
    ALBUM_SONGS_MAP.lock().map_err(|e| format!("Mutex poisoned: {}", e))?.clear();

    let music_dirs = MUSIC_DIRS.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
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
            match remove_music_dirs(vec![dir.display().to_string()]) {
                Ok(_) => {
                    warn!(path = %dir.display(), "Path is not a directory, removed from music dirs");
                }
                Err(e) => {
                    error!(error = %e, "Failed to remove path from music dirs");
                }
            }

            return Err(format!("Path is not a directory: {}", dir.display()));
        }
    }

    *MUSIC_CACHE.lock().map_err(|e| format!("Mutex poisoned: {}", e))? = new_cache;

    // 重建所有 O(1) 索引
    rebuild_all_indexes();

    Ok(())
}

/// 初始化应用程序（启动时调用）
#[tauri::command]
pub fn init_application() {
    PerformanceMonitor::start_timer("init_application");
    info!("Initializing application with optimized resource management");

    // 1. 初始化音乐库缓存管理器
    if let Err(e) = LibraryCacheManager::init() {
        error!(error = %e, "Failed to initialize music library cache");
    }

    // 2. 初始化资源缓存管理器
    use crate::cache::ResourceCacheManager;
    if let Err(e) = ResourceCacheManager::init() {
        error!(error = %e, "Failed to initialize resource cache");
    }

    // 3. 加载音乐目录
    use super::directory_commands::load_music_dirs_from_disk;
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
        info!(init_duration_ms = duration, "Application initialization completed");
        PerformanceMonitor::record_metric(
            MetricType::ScanDuration,
            duration,
            "init_application".to_string(),
        );
    }
}

// ==================== 辅助函数 ====================

/// 对歌曲列表进行去重合并
fn deduplicate_songs(songs: Vec<Song>) -> Vec<Song> {
    use std::collections::HashMap;

    // 使用指纹作为key进行分组
    let mut groups: HashMap<String, Vec<Song>> = HashMap::new();

    for song in songs {
        // 生成指纹（标准化后的标题+艺术家+专辑）
        let fingerprint = generate_fingerprint(&song);
        groups.entry(fingerprint).or_insert_with(Vec::new).push(song);
    }

    // 合并每组歌曲
    let mut result = Vec::new();
    for (_, group) in groups {
        if group.len() == 1 {
            // 只有一首，直接添加
            result.push(group.into_iter().next().unwrap());
        } else {
            // 有多首，合并它们
            let merged = merge_songs(group);
            result.push(merged);
        }
    }

    result
}

/// 生成歌曲指纹
fn generate_fingerprint(song: &Song) -> String {
    let normalized_title = normalize_for_dedup(&song.name);
    let normalized_artists: Vec<String> = song.ar.iter()
        .map(|a| normalize_for_dedup(&a.name))
        .collect();
    let normalized_album = normalize_for_dedup(&song.al.name);

    format!("{}|{}|{}",
        normalized_title,
        normalized_artists.join("&"),
        normalized_album
    )
}

fn normalize_for_dedup(s: &str) -> String {
    use crate::common::utils;
    utils::normalize_for_matching(s)
}

/// 合并多首相同歌曲（按音质排序）
fn merge_songs(mut songs: Vec<Song>) -> Song {
    // 按音质评分排序（降序）
    songs.sort_by(|a, b| {
        let score_a = calculate_song_quality_score(a);
        let score_b = calculate_song_quality_score(b);
        score_b.cmp(&score_a)
    });

    // 主歌曲（音质最高的）
    let mut primary = songs.remove(0);

    // 收集所有来源
    let mut all_sources = primary.sources.clone();

    // 添加其他歌曲的来源
    for song in songs {
        all_sources.extend(song.sources);
    }

    // 重新计算音质评分并排序来源
    all_sources.sort_by(|a, b| b.quality_score.cmp(&a.quality_score));

    // 更新主歌曲的来源信息
    primary.sources = all_sources;
    primary.primary_source_index = 0;

    // 更新主歌曲的路径为音质最高的来源
    if let Some(best_source) = primary.sources.first() {
        primary.src = PathBuf::from(&best_source.path);
    }

    primary
}

fn calculate_song_quality_score(song: &Song) -> u32 {
    let format = song.src
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("unknown");
    use crate::common::utils;
    utils::calculate_audio_quality_score(song.bitrate, format, song.sample_rate, song.duration)
}

/// 扫描文件夹中的音乐文件
fn scan_music_files(dir: &PathBuf) -> Vec<PathBuf> {
    use std::fs;
    fs::read_dir(dir)
        .ok()
        .into_iter()
        .flat_map(|entries| {
            entries.filter_map(Result::ok).flat_map(|entry| {
                if entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                    scan_music_files(&entry.path())
                } else if is_music_file(&entry) {
                    info!(found_file = %entry.path().display(), "Found music file");
                    vec![entry.path()]
                } else {
                    vec![]
                }
            })
        })
        .collect()
}

fn split_artist_names(artists: Vec<&str>) -> Vec<&str> {
    let mut split_names = Vec::new();
    for name in artists {
        // 检查并分割特定字符
        let parts: Vec<&str> = name
            .split('/')
            .flat_map(|part| part.split('&'))
            .flat_map(|part| part.split('\\'))
            .filter(|part| !part.is_empty()) // 过滤掉空字符串
            .collect();
        split_names.extend(parts);
    }
    split_names
}

/// 解析音乐文件元数据
fn parse_music_file(file: PathBuf) -> Result<Song, String> {
    use std::fs;
    // 使用新的music_tag模块读取元数据
    let parser = MetadataParser::new();
    let metadata_result = parser.parse(&file);

    // 获取文件名作为备用标题
    let file_name = file
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Unknown Title")
        .to_string();

    // 根据元数据读取结果处理
    let song = match metadata_result {
        Ok(metadata) => {
            // 如果成功读取标签，则使用标签中的信息
            let track_number = metadata.track_number.unwrap_or(0);
            let title = if metadata.title.is_empty() {
                file_name.clone()
            } else {
                metadata.title
            };

            // 处理多个艺术家
            let artists: Vec<Artist> = if metadata.artists.is_empty() {
                vec![get_or_create_artist("Unknown Artist".to_string())]
            } else {
                metadata.artists.iter()
                    .flat_map(|artist| {
                        split_artist_names(vec![&artist.name])
                            .iter()
                            .map(|name| get_or_create_artist(name.to_string()))
                            .collect::<Vec<Artist>>()
                    })
                    .collect()
            };

            let album_name = if metadata.album.name.is_empty() {
                "Unknown Album".to_string()
            } else {
                metadata.album.name
            };

            let album = get_or_create_album(album_name);

            // 获取文件格式
            let format = file.extension()
                .and_then(|e| e.to_str())
                .unwrap_or("unknown")
                .to_string();

            // 计算音质评分
            let quality_score = calculate_quality_score(
                metadata.bitrate,
                &format,
                metadata.sample_rate,
                metadata.duration,
            );

            // 创建来源信息
            let source_info = TrackSourceInfo {
                id: next_id(&SONG_ID_COUNTER),
                path: file.display().to_string(),
                format: format.clone(),
                bitrate: metadata.bitrate,
                sample_rate: metadata.sample_rate,
                duration: metadata.duration,
                quality_score,
                file_size: std::fs::metadata(&file).map(|m| m.len()).unwrap_or(0),
            };

            // 创建 Trace 来源追踪信息
            let trace = Trace::local_file(
                file.display().to_string(),
                TraceDataType::Track,
                source_info.id.to_string(),
            ).with_resource_info(ResourceInfo {
                format: Some(format.clone()),
                bitrate: metadata.bitrate,
                sample_rate: metadata.sample_rate,
                size: Some(std::fs::metadata(&file).map(|m| m.len()).unwrap_or(0)),
                duration: metadata.duration,
                quality_score: Some(quality_score),
            });

            Song {
                name: title,
                id: source_info.id,
                ar: artists,
                lyric: metadata.lyrics.map(|l| l.content).unwrap_or_default(),
                al: album,
                src: file,
                track_number,
                // 新增字段
                duration: metadata.duration,
                genre: metadata.genre,
                year: metadata.year,
                comment: metadata.comment,
                composer: metadata.composer,
                lyricist: metadata.lyricist,
                bitrate: metadata.bitrate,
                sample_rate: metadata.sample_rate,
                channels: metadata.channels,
                other_tags: metadata.other_tags,
                // 去重合并相关字段（旧格式，向后兼容）
                sources: vec![source_info],
                primary_source_index: 0,
                // 新格式：Trace 来源追踪
                traces: vec![trace],
                primary_trace_index: 0,
            }
        }
        Err(_) => {
            // 如果读取标签失败，则使用默认值
            let album = get_or_create_album("Unknown Album".to_string());
            let format = file.extension()
                .and_then(|e| e.to_str())
                .unwrap_or("unknown")
                .to_string();

            let source_info = TrackSourceInfo {
                id: next_id(&SONG_ID_COUNTER),
                path: file.display().to_string(),
                format,
                bitrate: None,
                sample_rate: None,
                duration: None,
                quality_score: 0,
                file_size: std::fs::metadata(&file).map(|m| m.len()).unwrap_or(0),
            };

            // 创建 Trace 来源追踪信息
            let trace = Trace::local_file(
                file.display().to_string(),
                TraceDataType::Track,
                source_info.id.to_string(),
            ).with_resource_info(ResourceInfo {
                format: None,
                bitrate: None,
                sample_rate: None,
                size: Some(std::fs::metadata(&file).map(|m| m.len()).unwrap_or(0)),
                duration: None,
                quality_score: Some(0),
            });

            Song {
                name: file_name,
                id: source_info.id,
                ar: vec![get_or_create_artist("Unknown Artist".to_string())],
                lyric: String::new(),
                al: album,
                src: file,
                track_number: 0,
                duration: None,
                genre: None,
                year: None,
                comment: None,
                composer: None,
                lyricist: None,
                bitrate: None,
                sample_rate: None,
                channels: None,
                other_tags: None,
                // 去重合并相关字段（旧格式，向后兼容）
                sources: vec![source_info],
                primary_source_index: 0,
                // 新格式：Trace 来源追踪
                traces: vec![trace],
                primary_trace_index: 0,
            }
        }
    };

    {
        let mut artist_songs_map = ARTIST_SONGS_MAP.lock().unwrap_or_else(|e| e.into_inner());
        let mut album_songs_map = ALBUM_SONGS_MAP.lock().unwrap_or_else(|e| e.into_inner());

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
    }
    Ok(song)
}

/// 缓存音乐列表
fn cache_music_list(dir: PathBuf, songs: Vec<Song>) {
    MUSIC_CACHE.lock().unwrap_or_else(|e| e.into_inner()).insert(dir, songs);
}

// ==================== 持久化缓存相关函数 ====================

/// 从持久化缓存加载数据
fn load_from_persistent_cache() -> bool {
    if let Some(manager_guard) = LibraryCacheManager::instance() {
        if let Some(manager) = manager_guard.as_ref() {
            match manager.load_from_disk() {
                Ok(cache) => {
                    if cache.songs.is_empty() {
                        return false;
                    }

                    // 将缓存数据加载到内存
                    rebuild_memory_cache_from_persistent(&cache);
                    info!(song_count = cache.songs.len(), "Loaded songs from persistent cache");
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
fn rebuild_memory_cache_from_persistent(cache: &MusicLibraryCacheData) {
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
            artist_cache.insert(artist.name.clone(), Artist {
                id: artist.id,
                name: artist.name.clone(),
                alias: artist.alias.clone(),
            });
        }
    }

    // 重建专辑缓存
    {
        let mut album_cache = ALBUM_CACHE.lock().unwrap_or_else(|e| e.into_inner());
        album_cache.clear();
        for album in &cache.albums {
            album_cache.insert(album.name.clone(), Album {
                id: album.id,
                name: album.name.clone(),
                pic_url: album.pic_url.clone(),
            });
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
            let dir = cached_song.fingerprint.path.parent()
                .map(|p| p.to_path_buf())
                .unwrap_or_default();

            // 查找艺术家和专辑
            let artists: Vec<Artist> = cached_song.artists.iter()
                .filter_map(|name| {
                    ARTIST_CACHE.lock().unwrap_or_else(|e| e.into_inner()).get(name).cloned()
                })
                .collect();

            let album = ALBUM_CACHE.lock().unwrap_or_else(|e| e.into_inner())
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
                let format = cached_song.fingerprint.path.extension()
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
            let traces: Vec<Trace> = sources.iter().map(|s| {
                Trace::local_file(
                    s.path.clone(),
                    TraceDataType::Track,
                    s.id.to_string(),
                ).with_resource_info(ResourceInfo {
                    format: Some(s.format.clone()),
                    bitrate: s.bitrate,
                    sample_rate: s.sample_rate,
                    size: Some(s.file_size),
                    duration: s.duration,
                    quality_score: Some(s.quality_score),
                })
            }).collect();

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

    // 重建所有 O(1) 索引
    rebuild_all_indexes();
}

/// 保存到持久化缓存
fn save_to_persistent_cache() {
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
fn build_persistent_cache_from_memory() -> MusicLibraryCacheData {
    use crate::cache::{CachedAlbum, CachedArtist, CachedSongMetadata, FileFingerprint};
    use crate::common::utils;
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
            cache.artist_songs_map.insert(
                *artist_id,
                songs.iter().map(|s| s.id).collect(),
            );
        }
    }

    {
        let album_songs_map = ALBUM_SONGS_MAP.lock().unwrap_or_else(|e| e.into_inner());
        for (album_id, songs) in album_songs_map.iter() {
            cache.album_songs_map.insert(
                *album_id,
                songs.iter().map(|s| s.id).collect(),
            );
        }
    }

    cache.cached_at = now;
    cache
}

/// 后台执行增量扫描
fn perform_background_incremental_scan() {
    std::thread::spawn(|| {
        info!("Starting background incremental scan");
        PerformanceMonitor::start_timer("background_scan");

        // 执行增量扫描
        let music_dirs = get_music_dirs();

        let existing_cache = if let Some(manager_guard) = LibraryCacheManager::instance() {
            if let Some(manager) = manager_guard.as_ref() {
                manager.load_from_disk().unwrap_or_else(|_| MusicLibraryCacheData::new())
            } else {
                MusicLibraryCacheData::new()
            }
        } else {
            MusicLibraryCacheData::new()
        };

        let max_song_id = existing_cache.songs.iter().map(|s| s.id).max().unwrap_or(0);
        let max_artist_id = existing_cache.artists.iter().map(|a| a.id).max().unwrap_or(0);
        let max_album_id = existing_cache.albums.iter().map(|a| a.id).max().unwrap_or(0);

        let scanner = IncrementalScanner::new(max_song_id, max_artist_id, max_album_id);

        match scanner.scan_incremental(&music_dirs, &existing_cache) {
            Ok(scan_result) => {
                if scan_result.total_changes() > 0 {
                    info!(changes = scan_result.total_changes(), "Background scan found changes, updating cache");

                    let new_cache = crate::scanner::build_cache_from_scan(
                        scan_result,
                        Some(&existing_cache)
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
                        &LibraryCacheManager::instance().unwrap().as_ref().unwrap()
                            .load_from_disk().unwrap()
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
