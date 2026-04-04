use image::{imageops::FilterType, DynamicImage, GenericImageView};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value as serde_json_value};
use std::collections::HashMap;
use std::fs::{self, DirEntry};
use std::io::Cursor;
use std::path::PathBuf;
use std::sync::Mutex;
use tokio::fs as async_fs;

// 引入新的music_tag模块
mod music_tag;
use music_tag::MetadataParser;

// 引入图片处理器模块
mod image_processor;
use image_processor::IMAGE_PROCESSOR;

// 引入GPU图片处理器模块
mod gpu_image_processor;
use gpu_image_processor::{init_gpu_processor, resize_with_gpu_fallback};

// 引入音乐库缓存模块（本地音乐元数据缓存）
mod music_library_cache;
use music_library_cache::{MusicLibraryCache as LibraryCacheManager, CachedSongMetadata, MusicLibraryCacheData};

// 引入资源缓存模块（网络资源缓存）
mod resource_cache;
use resource_cache::{ResourceCacheManager, ResourcePoolType, CachedResource, ResourceCacheInfo, ResourcePoolStats};

// 引入增量扫描模块
mod incremental_scanner;
use incremental_scanner::{IncrementalScanner, ScanResult};

// 引入性能监控模块
mod performance_monitor;
use performance_monitor::{PerformanceMonitor, MetricType};

// 引入音乐去重模块
mod music_deduplicator;
use music_deduplicator::{MusicDeduplicator, MergedTrack, deduplicate_tracks};

// 引入 Trace 来源追踪模块
mod trace;
pub use trace::{Trace, TraceDataType, SourceType, StorageType, FetchMethod, ResourceInfo, BaseModel};

// 引入 HTTP 代理模块
mod http_proxy;
pub use http_proxy::{HttpRequest, HttpResponse, http_request, http_get, http_post};

// 已在上面引入 resource_cache 模块
// 引入统一数据模型模块（内部使用，不在此导出以避免与现有结构体冲突）
mod models;

// 引入公共工具模块
mod common;
use common::utils::{self as utils};

static SONG_ID_COUNTER: Lazy<Mutex<u32>> = Lazy::new(|| Mutex::new(0));
static ARTIST_ID_COUNTER: Lazy<Mutex<u32>> = Lazy::new(|| Mutex::new(0));
static ALBUM_ID_COUNTER: Lazy<Mutex<u32>> = Lazy::new(|| Mutex::new(0));

static MUSIC_CACHE: Lazy<Mutex<HashMap<PathBuf, Vec<Song>>>> = Lazy::new(|| Mutex::new(HashMap::new()));
static ARTIST_CACHE: Lazy<Mutex<HashMap<String, Artist>>> = Lazy::new(|| Mutex::new(HashMap::new()));
static ALBUM_CACHE: Lazy<Mutex<HashMap<String, Album>>> = Lazy::new(|| Mutex::new(HashMap::new()));

static ARTIST_SONGS_MAP: Lazy<Mutex<HashMap<u32, Vec<Song>>>> = Lazy::new(|| Mutex::new(HashMap::new()));
static ALBUM_SONGS_MAP: Lazy<Mutex<HashMap<u32, Vec<Song>>>> = Lazy::new(|| Mutex::new(HashMap::new()));
static MUSIC_DIRS: Lazy<Mutex<Vec<PathBuf>>> = Lazy::new(|| Mutex::new(Vec::new()));
static ALWAYS_ON_TOP_STATE: Lazy<Mutex<bool>> = Lazy::new(|| Mutex::new(false));

// 导出音乐目录列表供其他模块使用
pub fn get_music_dirs() -> Vec<PathBuf> {
    MUSIC_DIRS.lock().unwrap_or_else(|e| e.into_inner()).clone()
}

fn get_or_create_artist(name: String) -> Artist {
    let mut cache = ARTIST_CACHE.lock().unwrap_or_else(|e| e.into_inner());
    cache
        .entry(name.clone())
        .or_insert_with(|| {
            let id = next_id(&ARTIST_ID_COUNTER);
            Artist {
                id,
                name: name.clone(),
                alias: vec![],
            }
        })
        .clone()
}

fn get_or_create_album(name: String) -> Album {
    let mut cache = ALBUM_CACHE.lock().unwrap_or_else(|e| e.into_inner());
    cache
        .entry(name.clone())
        .or_insert_with(|| {
            let id = next_id(&ALBUM_ID_COUNTER);
            Album {
                id,
                name: name,
                pic_url: String::new(),
            }
        })
        .clone()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Song {
    name: String,
    id: u32,
    ar: Vec<Artist>,
    lyric: String,
    al: Album,
    src: PathBuf,
    track_number: u16,
    // 新增字段
    duration: Option<f64>,           // 音频时长（秒）
    genre: Option<String>,           // 流派
    year: Option<u32>,               // 发行年份
    comment: Option<String>,         // 评论
    composer: Option<String>,        // 作曲家
    lyricist: Option<String>,        // 作词家
    bitrate: Option<u32>,            // 比特率（kbps）
    sample_rate: Option<u32>,        // 采样率（Hz）
    channels: Option<u8>,            // 声道数
    other_tags: Option<std::collections::HashMap<String, String>>, // 其他标签
    // 去重合并相关字段（旧格式，向后兼容）
    sources: Vec<TrackSourceInfo>,   // 所有来源（包括主来源和替代来源）
    primary_source_index: usize,     // 主来源在sources中的索引
    // ========== 新增：Trace 来源追踪字段 ==========
    /// 所有来源 Trace（新格式）
    #[serde(default)]
    traces: Vec<Trace>,
    /// 主来源索引（新格式）
    #[serde(default)]
    primary_trace_index: usize,
}

/// 音轨来源信息（简化版，用于前端传输）
#[derive(Debug, Serialize, Deserialize, Clone)]
struct TrackSourceInfo {
    id: u32,
    path: String,
    format: String,
    bitrate: Option<u32>,
    sample_rate: Option<u32>,
    duration: Option<f64>,
    quality_score: u32,
    file_size: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Artist {
    id: u32,
    name: String,
    alias: Vec<String>,
}

impl Artist {
    fn get_songs(&self) -> Vec<Song> {
        let map = ARTIST_SONGS_MAP.lock().unwrap_or_else(|e| e.into_inner());
        map.get(&self.id).unwrap_or(&vec![]).clone()
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Album {
    id: u32,
    name: String,
    pic_url: String,
}

// 生成缓存图片路径
fn get_cache_image_path(cache_dir: &PathBuf, album_id: u32, max_resolution: u32) -> PathBuf {
    let mut path = cache_dir.clone();
    let binding = ALBUM_CACHE.lock().unwrap_or_else(|e| e.into_inner());
    let album = binding.values().find(|album| album.id == album_id).unwrap();
    path.push(sanitize_filename(format!(
        "album_{}_{}.webp",
        album.name, max_resolution
    )));
    path
}

fn get_cache_dir() -> Result<PathBuf, String> {
    let path = utils::get_base_cache_dir()?;
    utils::ensure_cache_dir(&path)?;
    Ok(path)
}

// 从缓存读取图片
fn read_image_from_cache(path: &PathBuf) -> Result<tauri::ipc::Response, String> {
    fs::read(path)
        .map(|data| tauri::ipc::Response::new(data))
        .map_err(|e| e.to_string())
}

// 从专辑获取封面数据
fn get_album_cover_data(album_id: u32) -> Result<Vec<u8>, String> {
    let cache = MUSIC_CACHE.lock().unwrap_or_else(|e| e.into_inner());
    for songs in cache.values() {
        for song in songs {
            if song.al.id == album_id {
                // 使用新的music_tag模块读取封面
                let parser = MetadataParser::new();
                match parser.parse(&song.src) {
                    Ok(metadata) => {
                        if let Some(picture) = metadata.front_cover() {
                            return Ok(picture.data.clone());
                        }
                    }
                    Err(_) => continue,
                }
            }
        }
    }
    Err("Album cover not found".to_string())
}

fn resize_image(image: DynamicImage, max_resolution: u32) -> DynamicImage {
    let (width, height) = image.dimensions();
    let scale = f32::max(width as f32, height as f32) / max_resolution as f32;
    if scale > 1.0 {
        let new_width = (width as f32 / scale) as u32;
        let new_height = (height as f32 / scale) as u32;
        image.resize(new_width, new_height, FilterType::Lanczos3)
    } else {
        image
    }
}

fn sanitize_filename(name: String) -> String {
    utils::sanitize_filename(name)
}

// ID生成器
fn next_id(counter: &Mutex<u32>) -> u32 {
    let mut id = counter.lock().unwrap_or_else(|e| e.into_inner());
    *id += 1;
    *id
}

fn is_music_file(entry: &DirEntry) -> bool {
    utils::is_music_file(entry)
}

#[tauri::command]
fn get_all_my_albums() -> Result<Vec<Album>, String> {
    let album_cache = ALBUM_CACHE.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
    let albums = album_cache.values().cloned().collect();
    Ok(albums)
}

#[tauri::command]
fn get_all_my_artists() -> Result<Vec<Artist>, String> {
    let artist_cache = ARTIST_CACHE.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
    let artists = artist_cache.values().cloned().collect();
    Ok(artists)
}

// Tauri命令
#[tauri::command]
fn get_music_list() -> Result<Vec<Song>, String> {
    let cache = MUSIC_CACHE.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
    let all_songs: Vec<Song> = cache
        .values()
        .flat_map(|songs| songs.iter().cloned())
        .collect();

    // 执行去重合并
    let deduplicated = deduplicate_songs(all_songs);
    Ok(deduplicated)
}

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
    utils::calculate_audio_quality_score(song.bitrate, format, song.sample_rate, song.duration)
}

#[tauri::command]
fn get_artist_by_id(artist_id: u32) -> Result<Artist, String> {
    let artist_cache = ARTIST_CACHE.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
    artist_cache
        .values()
        .find(|artist| artist.id == artist_id)
        .cloned()
        .ok_or_else(|| "Artist not found".to_string())
}

#[tauri::command]
fn get_album_by_id(album_id: u32) -> Result<Album, String> {
    let album_cache = ALBUM_CACHE.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
    album_cache
        .values()
        .find(|album| album.id == album_id)
        .cloned()
        .ok_or_else(|| "Album not found".to_string())
}

#[tauri::command]
fn get_artists_songs_by_id(artist_id: u32) -> Result<Vec<Song>, String> {
    let artist_songs_map = ARTIST_SONGS_MAP.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
    let songs = artist_songs_map.get(&artist_id).cloned().unwrap_or_default();
    // 执行去重合并
    let deduplicated = deduplicate_songs(songs);
    Ok(deduplicated)
}

#[tauri::command]
fn get_albums_songs_by_id(album_id: u32) -> Result<Vec<Song>, String> {
    let album_songs_map = ALBUM_SONGS_MAP.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
    let songs = album_songs_map.get(&album_id).cloned().unwrap_or_default();
    // 执行去重合并
    let deduplicated = deduplicate_songs(songs);
    Ok(deduplicated)
}

// 扫描文件夹中的音乐文件
fn scan_music_files(dir: &PathBuf) -> Vec<PathBuf> {
    fs::read_dir(dir)
        .ok()
        .into_iter()
        .flat_map(|entries| {
            entries.filter_map(Result::ok).flat_map(|entry| {
                if entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                    scan_music_files(&entry.path())
                } else if is_music_file(&entry) {
                    println!("Found music file: {}", entry.path().display());
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

// 假设Song, Artist, Album, Tag, next_id和SONG_ID_COUNTER等都已经定义
fn parse_music_file(file: PathBuf) -> Result<Song, String> {
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

// 缓存音乐列表
fn cache_music_list(dir: PathBuf, songs: Vec<Song>) {
    MUSIC_CACHE.lock().unwrap_or_else(|e| e.into_inner()).insert(dir, songs);
}

#[tauri::command]
fn refresh_music_cache() -> Result<(), String> {
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
        println!("Scanning music files in: {}", dir.display());

        if dir.is_dir() {
            let songs = scan_music_files(dir);
            let parsed_songs: Result<Vec<Song>, String> =
                songs.into_iter().map(parse_music_file).collect();
            match parsed_songs {
                Ok(songs) => {
                    new_cache.insert(dir.clone(), songs);
                }
                Err(e) => {
                    eprintln!("Error parsing music files in {}: {}", dir.display(), e);
                    return Err(e);
                }
            }
        } else {
            match remove_music_dirs(vec![dir.display().to_string()]) {
                Ok(_) => {
                    eprintln!(
                        "Path is not a directory, removed from music dirs: {}",
                        dir.display()
                    );
                }
                Err(e) => {
                    eprintln!("Failed to remove path from music dirs: {}", e);
                }
            }

            return Err(format!("Path is not a directory: {}", dir.display()));
        }
    }

    *MUSIC_CACHE.lock().map_err(|e| format!("Mutex poisoned: {}", e))? = new_cache;
    Ok(())
}

// Song结构体JSON序列化
impl Song {
    fn to_json(&self) -> serde_json_value {
        json!({
            "name": self.name,
            "id": self.id,
            "ar": self.ar.iter().map(|ar| {
                json!({
                    "id": ar.id,
                    "name": ar.name,
                    "alias": ar.alias,
                })
            }).collect::<Vec<serde_json_value>>(),
            "lyric": self.lyric,
            "al": {
                "id": self.al.id,
                "name": self.al.name,
                "picUrl": self.al.pic_url,
            },
            "src": self.src.display().to_string(),
            "trackNumber": self.track_number,
            // 新增字段
            "duration": self.duration,
            "genre": self.genre,
            "year": self.year,
            "comment": self.comment,
            "composer": self.composer,
            "lyricist": self.lyricist,
            "bitrate": self.bitrate,
            "sampleRate": self.sample_rate,
            "channels": self.channels,
            "otherTags": self.other_tags,
            // 去重合并相关字段（旧格式，向后兼容）
            "sources": self.sources.iter().map(|s| {
                json!({
                    "id": s.id,
                    "path": s.path,
                    "format": s.format,
                    "bitrate": s.bitrate,
                    "sampleRate": s.sample_rate,
                    "duration": s.duration,
                    "qualityScore": s.quality_score,
                    "fileSize": s.file_size,
                })
            }).collect::<Vec<serde_json_value>>(),
            "primarySourceIndex": self.primary_source_index,
            "sourceCount": self.sources.len(),
            // ========== 新格式：Trace 来源追踪 ==========
            "traces": self.traces.iter().map(|t| {
                serde_json::to_value(t).unwrap_or(json!(null))
            }).collect::<Vec<serde_json_value>>(),
            "primaryTraceIndex": self.primary_trace_index,
            "traceCount": self.traces.len(),
        })
    }
}

fn next_song_id() -> u32 {
    let mut id = SONG_ID_COUNTER.lock().unwrap_or_else(|e| e.into_inner());
    *id += 1;
    *id
}

fn next_artist_id() -> u32 {
    let mut id = ARTIST_ID_COUNTER.lock().unwrap_or_else(|e| e.into_inner());
    *id += 1;
    *id
}

fn next_album_id() -> u32 {
    let mut id = ALBUM_ID_COUNTER.lock().unwrap_or_else(|e| e.into_inner());
    *id += 1;
    *id
}

fn calculate_quality_score(
    bitrate: Option<u32>,
    format: &str,
    sample_rate: Option<u32>,
    duration: Option<f64>,
) -> u32 {
    utils::calculate_audio_quality_score(bitrate, format, sample_rate, duration)
}

// 独立的方法，用于添加用户音乐文件夹
#[tauri::command]
fn add_users_music_dir() {
    if let Some(audio_dir) = dirs::audio_dir() {
        let audio_dir_path = audio_dir.to_str().unwrap().to_string();
        let _ = add_music_dirs(vec![audio_dir_path]);
    }
}

#[tauri::command]
fn get_users_music_dir() -> String {
    dirs::audio_dir().map(|dir| dir.to_str().unwrap().to_string()).unwrap_or_default()
}

// 程序启动时调用的方法 - 优化版本
#[tauri::command]
fn init_application() {
    PerformanceMonitor::start_timer("init_application");
    println!("Initializing application with optimized resource management...");

    // 1. 初始化音乐库缓存管理器
    if let Err(e) = LibraryCacheManager::init() {
        eprintln!("Failed to initialize music library cache: {}", e);
    }

    // 2. 初始化资源缓存管理器
    if let Err(e) = ResourceCacheManager::init() {
        eprintln!("Failed to initialize resource cache: {}", e);
    }

    // 3. 加载音乐目录
    if let Err(e) = load_music_dirs_from_disk() {
        eprintln!("Failed to load music directories from disk: {}", e);
    }

    // 4. 尝试从缓存加载数据（快速启动）
    let cache_loaded = load_from_persistent_cache();
    
    if !cache_loaded {
        println!("No valid cache found, performing full scan...");
        // 首次启动或缓存无效，执行全量扫描
        if let Err(e) = refresh_music_cache() {
            eprintln!("Failed to refresh music cache: {}", e);
        }
        // 保存到持久化缓存
        save_to_persistent_cache();
    } else {
        println!("Loaded from cache successfully, performing incremental scan...");
        // 后台执行增量扫描更新缓存
        perform_background_incremental_scan();
    }

    if let Some(duration) = PerformanceMonitor::end_timer("init_application") {
        println!("Application initialization completed in {}ms", duration);
        PerformanceMonitor::record_metric(
            MetricType::ScanDuration,
            duration,
            "init_application".to_string(),
        );
    }
}

// 从持久化缓存加载数据
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
                    println!("Loaded {} songs from persistent cache", cache.songs.len());
                    return true;
                }
                Err(e) => {
                    eprintln!("Failed to load from persistent cache: {}", e);
                }
            }
        }
    }
    false
}

// 从持久化缓存重建内存缓存
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
}

// 保存到持久化缓存
fn save_to_persistent_cache() {
    if let Some(manager_guard) = LibraryCacheManager::instance() {
        if let Some(manager) = manager_guard.as_ref() {
            // 从内存缓存构建持久化缓存
            let cache = build_persistent_cache_from_memory();
            
            if let Err(e) = manager.save_to_disk(&cache) {
                eprintln!("Failed to save to persistent cache: {}", e);
            } else {
                manager.update_memory_cache(cache);
                println!("Saved to persistent cache successfully");
            }
        }
    }
}

// 从内存缓存构建持久化缓存
fn build_persistent_cache_from_memory() -> MusicLibraryCacheData {
    use music_library_cache::{CachedAlbum, CachedArtist, CachedSongMetadata, FileFingerprint};
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

// 后台执行增量扫描
fn perform_background_incremental_scan() {
    std::thread::spawn(|| {
        println!("Starting background incremental scan...");
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
                    println!("Background scan found {} changes, updating cache...", 
                        scan_result.total_changes());
                    
                    let new_cache = incremental_scanner::build_cache_from_scan(
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
                    println!("No changes detected in background scan");
                }
            }
            Err(e) => {
                eprintln!("Background incremental scan failed: {}", e);
            }
        }
        
        if let Some(duration) = PerformanceMonitor::end_timer("background_scan") {
            println!("Background scan completed in {}ms", duration);
            PerformanceMonitor::record_metric(
                MetricType::ScanDuration,
                duration,
                "background_scan".to_string(),
            );
        }
    });
}

#[tauri::command]
async fn get_low_quality_album_cover(
    album_id: u32,
    max_resolution: u32,
) -> Result<tauri::ipc::Response, String> {
    PerformanceMonitor::start_timer(&format!("album_cover_{}", album_id));
    
    let cache_dir = get_cache_dir().map_err(|e| e.to_string())?;
    let cache_path = get_cache_image_path(&cache_dir, album_id, max_resolution);
    
    // 检查缓存是否存在
    if cache_path.exists() {
        println!("Cache hit for album {} at resolution {}", album_id, max_resolution);
        
        if let Some(duration) = PerformanceMonitor::end_timer(&format!("album_cover_{}", album_id)) {
            PerformanceMonitor::record_metric(
                MetricType::CacheHit,
                duration,
                format!("album_cover:{}", album_id),
            );
        }
        
        return read_image_from_cache(&cache_path);
    }

    // 获取封面数据
    let cover_data = get_album_cover_data(album_id).map_err(|e| e.to_string())?;

    // 使用新的图片处理器（带线程池控制）
    let processed_data = IMAGE_PROCESSOR
        .process_album_cover(cover_data, max_resolution)
        .await?;

    // 写入缓存
    fs::write(&cache_path, &processed_data).map_err(|e| e.to_string())?;

    if let Some(duration) = PerformanceMonitor::end_timer(&format!("album_cover_{}", album_id)) {
        PerformanceMonitor::record_metric(
            MetricType::CacheMiss,
            duration,
            format!("album_cover:{}", album_id),
        );
    }

    Ok(tauri::ipc::Response::new(processed_data))
}

#[tauri::command]
fn get_album_cover(album_id: u32) -> Result<tauri::ipc::Response, String> {
    PerformanceMonitor::start_timer(&format!("album_cover_origin_{}", album_id));
    
    let result = (|| {
        let cache = MUSIC_CACHE.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
        for songs in cache.values() {
            for song in songs {
                if song.al.id == album_id {
                    // 使用新的music_tag模块读取封面
                    let parser = MetadataParser::new();
                    match parser.parse(&song.src) {
                        Ok(metadata) => {
                            if let Some(picture) = metadata.front_cover() {
                                return Ok(tauri::ipc::Response::new(picture.data.clone()));
                            }
                        }
                        Err(_) => continue,
                    }
                }
            }
        }
        Err("Album cover not found".into())
    })();
    
    if let Some(duration) = PerformanceMonitor::end_timer(&format!("album_cover_origin_{}", album_id)) {
        let from_cache = result.is_ok();
        PerformanceMonitor::record_metric(
            if from_cache { MetricType::CacheHit } else { MetricType::CacheMiss },
            duration,
            format!("album_cover_origin:{}", album_id),
        );
    }
    
    result
}

#[tauri::command]
async fn get_music_file(song_id: u32) -> Result<tauri::ipc::Response, String> {
    PerformanceMonitor::start_timer(&format!("music_file_{}", song_id));
    
    println!("Searching for song with ID: {}", song_id);

    // 查找具有匹配 song_id 的歌曲，并立即释放锁
    let song_path = {
        let cache = MUSIC_CACHE.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
        println!("Cache locked, searching for song...");
        cache.values().flatten().find_map(|s| {
            if s.id == song_id {
                Some(s.src.clone())
            } else {
                None
            }
        })
    };

    // 根据找到的路径读取文件
    let result = if let Some(song_path) = song_path {
        println!("Song found, trying to read file: {}", song_path.display());

        // 读取歌曲文件内容
        match async_fs::read(song_path).await {
            Ok(data) => {
                println!("Song finished reading, sending to front");
                Ok(tauri::ipc::Response::new(data))
            }
            Err(e) => Err(format!("Failed to read music file: {}", e)),
        }
    } else {
        println!("Music file not found in cache");
        Err("Music file not found".into())
    };
    
    if let Some(duration) = PerformanceMonitor::end_timer(&format!("music_file_{}", song_id)) {
        PerformanceMonitor::record_metric(
            MetricType::ResourceLoadTime,
            duration,
            format!("music_file:{}", song_id),
        );
    }
    
    result
}

#[tauri::command]
fn get_all_music_dirs() -> Result<Vec<String>, String> {
    // 返回用户手动添加的音乐目录，而不是缓存中的所有目录
    // 这样可以避免子目录被显示为独立的文件夹
    let music_dirs = MUSIC_DIRS.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
    let dirs: Vec<String> = music_dirs
        .iter()
        .map(|path| path.display().to_string())
        .collect();
    Ok(dirs)
}

#[tauri::command]
fn remove_music_dirs(dirs_to_remove: Vec<String>) -> Result<(), String> {
    {
        let mut music_dirs = MUSIC_DIRS.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
        music_dirs.retain(|dir| !dirs_to_remove.contains(&dir.display().to_string()));

        let mut cache = MUSIC_CACHE.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
        for dir_str in dirs_to_remove {
            let dir = PathBuf::from(dir_str);
            cache.remove(&dir);
        }
    }

    save_music_dirs_to_disk();
    Ok(())
}

// 保存音乐目录到磁盘
fn save_music_dirs_to_disk() -> Result<(), String> {
    let dirs_clone = {
        let dirs = MUSIC_DIRS.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
        dirs.clone()
    };
    let cache_dir = get_cache_dir().map_err(|e| e.to_string())?;
    println!("Cache directory: {:?}", cache_dir);
    if !cache_dir.exists() {
        if let Err(e) = fs::create_dir_all(&cache_dir) {
            return Err(format!("Failed to create cache directory: {}", e));
        }
    }
    let file_path = cache_dir.join("MUSIC_DIRS.json");
    println!("File path: {:?}", file_path);
    let file = match fs::File::create(&file_path) {
        Ok(f) => f,
        Err(e) => return Err(format!("Failed to create file: {}", e)),
    };
    if let Err(e) = serde_json::to_writer(&file, &dirs_clone) {
        return Err(format!("Failed to write to file: {}", e));
    }
    Ok(())
}

// 从磁盘加载音乐目录
fn load_music_dirs_from_disk() -> Result<(), String> {
    let cache_dir = get_cache_dir().map_err(|e| e.to_string())?;
    println!("Cache directory: {:?}", cache_dir);
    if !cache_dir.exists() {
        if let Err(e) = fs::create_dir_all(&cache_dir) {
            return Err(format!("Failed to create cache directory: {}", e));
        }
    }
    let file_path = cache_dir.join("MUSIC_DIRS.json");
    println!("File path: {:?}", file_path);
    if !file_path.exists() {
        let audio_dir = dirs::audio_dir().ok_or("No default audio directory found")?;
        let dirs = vec![audio_dir];
        let file = match fs::File::create(&file_path) {
            Ok(f) => f,
            Err(e) => return Err(format!("Failed to create file: {}", e)),
        };
        if let Err(e) = serde_json::to_writer(&file, &dirs) {
            return Err(format!("Failed to write to file: {}", e));
        }
    } else {
        let file = fs::File::open(&file_path).map_err(|e| e.to_string())?;
        let dirs: Vec<PathBuf> = serde_json::from_reader(file).map_err(|e| e.to_string())?;
        let mut music_dirs = MUSIC_DIRS.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
        *music_dirs = dirs;
    }
    Ok(())
}

#[tauri::command]
fn add_music_dirs(new_dirs: Vec<String>) -> Result<(), String> {
    for dir in &new_dirs {
        let path = PathBuf::from(dir);
        if !path.exists() {
            return Err(format!("Music directory does not exist: {}", dir));
        }
    }
    {
        let mut music_dirs = MUSIC_DIRS.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
        music_dirs.extend(new_dirs.iter().map(PathBuf::from));
    }
    save_music_dirs_to_disk();
    Ok(())
}

// 缓存大小信息结构体
#[derive(Debug, Serialize, Deserialize)]
struct CacheSizeInfo {
    total_size: u64,
    image_cache_size: u64,
    data_cache_size: u64,
    image_count: u32,
    file_count: u32,
}

// 获取缓存大小信息
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

// 清除图片缓存
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
                    fs::remove_file(&path).map_err(|e| {
                        format!("Failed to delete {}: {}", file_name, e)
                    })?;
                    deleted_count += 1;
                }
            }
        }
    }

    println!("Cleared {} image cache files", deleted_count);
    Ok(deleted_count)
}

// 重置所有应用数据
#[tauri::command]
fn reset_all_data() -> Result<(), String> {
    let cache_dir = get_cache_dir()?;

    // 1. 清空内存缓存
    *SONG_ID_COUNTER.lock().map_err(|e| format!("Mutex poisoned: {}", e))? = 0;
    *ARTIST_ID_COUNTER.lock().map_err(|e| format!("Mutex poisoned: {}", e))? = 0;
    *ALBUM_ID_COUNTER.lock().map_err(|e| format!("Mutex poisoned: {}", e))? = 0;
    MUSIC_CACHE.lock().map_err(|e| format!("Mutex poisoned: {}", e))?.clear();
    ARTIST_CACHE.lock().map_err(|e| format!("Mutex poisoned: {}", e))?.clear();
    ALBUM_CACHE.lock().map_err(|e| format!("Mutex poisoned: {}", e))?.clear();
    ARTIST_SONGS_MAP.lock().map_err(|e| format!("Mutex poisoned: {}", e))?.clear();
    ALBUM_SONGS_MAP.lock().map_err(|e| format!("Mutex poisoned: {}", e))?.clear();
    MUSIC_DIRS.lock().map_err(|e| format!("Mutex poisoned: {}", e))?.clear();

    // 2. 删除缓存目录中的所有文件
    if cache_dir.exists() {
        for entry in fs::read_dir(&cache_dir).map_err(|e| e.to_string())? {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_file() {
                    fs::remove_file(&path).map_err(|e| {
                        format!("Failed to delete {}: {}", path.display(), e)
                    })?;
                }
            }
        }
    }

    println!("All application data has been reset");
    Ok(())
}

// 新增的关闭应用的方法
#[tauri::command]
fn close_app(window: tauri::Window) {
    let _ = window.close();
}

#[tauri::command]
async fn minimize_window(window: tauri::Window) {
    let _ = window.minimize();
}

#[tauri::command]
async fn toggle_maximize(window: tauri::Window) {
    if window.is_maximized().unwrap_or(false) {
        let _ = window.unmaximize();
    } else {
        let _ = window.maximize();
    }
}

#[tauri::command]
async fn toggle_always_on_top(window: tauri::Window) -> Result<bool, String> {
    let new_state = {
        let mut state = ALWAYS_ON_TOP_STATE.lock().map_err(|e| e.to_string())?;
        *state = !*state;
        *state
    };
    window
        .set_always_on_top(new_state)
        .map_err(|e| e.to_string())?;
    Ok(new_state)
}

// Tauri应用入口点
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化缓存管理器
    let _ = LibraryCacheManager::init();
    let _ = ResourceCacheManager::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_music_list,
            get_all_music_dirs,
            add_music_dirs,
            remove_music_dirs,
            get_album_cover,
            get_music_file,
            refresh_music_cache,
            get_all_my_albums,
            get_all_my_artists,
            get_album_by_id,
            get_artist_by_id,
            get_albums_songs_by_id,
            get_artists_songs_by_id,
            close_app,
            minimize_window,
            toggle_maximize,
            toggle_always_on_top,
            get_low_quality_album_cover,
            init_application,
            add_users_music_dir,
            get_users_music_dir,
            // 数据管理命令
            get_cache_size_info,
            clear_image_cache,
            reset_all_data,
            // 音乐库缓存命令
            music_library_cache::get_library_cache_stats,
            music_library_cache::clear_library_cache,
            music_library_cache::is_library_cache_valid,
            // 增量扫描命令
            incremental_scanner::perform_incremental_scan,
            incremental_scanner::perform_full_scan,
            // 性能监控命令
            performance_monitor::get_performance_stats,
            performance_monitor::get_performance_report,
            performance_monitor::reset_performance_stats,
            performance_monitor::record_resource_load,
            performance_monitor::start_performance_timer,
            performance_monitor::end_performance_timer,
            // 资源缓存命令
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
            // HTTP 代理命令
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
