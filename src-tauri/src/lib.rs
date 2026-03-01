use image::{imageops::FilterType, DynamicImage, GenericImageView};
use lazy_static::lazy_static;
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

// 引入缓存管理模块
mod cache_manager;
use cache_manager::{CacheManager, CachedSongMetadata, MusicLibraryCache};

// 引入增量扫描模块
mod incremental_scanner;
use incremental_scanner::{IncrementalScanner, ScanResult};

// 引入性能监控模块
mod performance_monitor;
use performance_monitor::{PerformanceMonitor, MetricType};

lazy_static! {
    // ID 计数器
    static ref SONG_ID_COUNTER: Mutex<u32> = Mutex::new(0);
    static ref ARTIST_ID_COUNTER: Mutex<u32> = Mutex::new(0);
    static ref ALBUM_ID_COUNTER: Mutex<u32> = Mutex::new(0);

    // 音乐、艺人、专辑的缓存
    static ref MUSIC_CACHE: Mutex<HashMap<PathBuf, Vec<Song>>> = Mutex::new(HashMap::new());
    static ref ARTIST_CACHE: Mutex<HashMap<String, Artist>> = Mutex::new(HashMap::new());
    static ref ALBUM_CACHE: Mutex<HashMap<String, Album>> = Mutex::new(HashMap::new());

    // 艺人相关缓存
    static ref ARTIST_SONGS_MAP: Mutex<HashMap<u32, Vec<Song>>> = Mutex::new(HashMap::new());
    static ref ALBUM_SONGS_MAP: Mutex<HashMap<u32, Vec<Song>>> = Mutex::new(HashMap::new());
    static ref MUSIC_DIRS: Mutex<Vec<PathBuf>> = Mutex::new(Vec::new());
}

// 导出音乐目录列表供其他模块使用
pub fn get_music_dirs() -> Vec<PathBuf> {
    MUSIC_DIRS.lock().unwrap().clone()
}

fn get_or_create_artist(name: String) -> Artist {
    let mut cache = ARTIST_CACHE.lock().unwrap();
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
    let mut cache = ALBUM_CACHE.lock().unwrap();
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
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Artist {
    id: u32,
    name: String,
    alias: Vec<String>,
}

impl Artist {
    fn get_songs(&self) -> Vec<Song> {
        let map = ARTIST_SONGS_MAP.lock().unwrap();
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
    let binding = ALBUM_CACHE.lock().unwrap();
    let album = binding.values().find(|album| album.id == album_id).unwrap();
    path.push(sanitize_filename(format!(
        "album_{}_{}.webp",
        album.name, max_resolution
    )));
    path
}

// 获取缓存目录
fn get_cache_dir() -> Result<PathBuf, String> {
    let path = dirs::cache_dir().ok_or("Cannot get cache directory")?;
    let mut path = path;
    path.push("com.blurlyric.app");
    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }
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
    let cache = MUSIC_CACHE.lock().unwrap();
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

const MAX_FILENAME_LENGTH: usize = 50;

fn sanitize_filename(name: String) -> String {
    let sanitized: String = name
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '_' || c == '-' || c == '.' {
                c.to_string()
            } else {
                "_".to_string()
            }
        })
        .collect();
    if sanitized.len() > MAX_FILENAME_LENGTH {
        let mut truncated = sanitized
            .chars()
            .take(MAX_FILENAME_LENGTH)
            .collect::<String>();
        while truncated.ends_with('.') || truncated.ends_with('_') {
            if !truncated.is_empty() {
                truncated.pop();
            } else {
                break;
            }
        }
        truncated
    } else {
        sanitized
    }
}

// ID生成器
fn next_id(counter: &Mutex<u32>) -> u32 {
    let mut id = counter.lock().unwrap();
    *id += 1;
    *id
}

// 文件是否是音乐文件
fn is_music_file(entry: &DirEntry) -> bool {
    matches!(
        entry.path().extension().and_then(|ext| ext.to_str()),
        Some("mp3" | "ogg" | "flac" | "m4a" | "wav" | "aac")
    )
}

#[tauri::command]
fn get_all_my_albums() -> Result<Vec<Album>, String> {
    let album_cache = ALBUM_CACHE.lock().unwrap();
    let albums = album_cache.values().cloned().collect();
    Ok(albums)
}

#[tauri::command]
fn get_all_my_artists() -> Result<Vec<Artist>, String> {
    let artist_cache = ARTIST_CACHE.lock().unwrap();
    let artists = artist_cache.values().cloned().collect();
    Ok(artists)
}

// Tauri命令
#[tauri::command]
fn get_music_list() -> Result<Vec<Song>, String> {
    let cache = MUSIC_CACHE.lock().unwrap();
    Ok(cache
        .values()
        .flat_map(|songs| songs.iter().cloned())
        .collect())
}

#[tauri::command]
fn get_artist_by_id(artist_id: u32) -> Result<Artist, String> {
    let artist_cache = ARTIST_CACHE.lock().unwrap();
    artist_cache
        .values()
        .find(|artist| artist.id == artist_id)
        .cloned()
        .ok_or_else(|| "Artist not found".to_string())
}

#[tauri::command]
fn get_album_by_id(album_id: u32) -> Result<Album, String> {
    let album_cache = ALBUM_CACHE.lock().unwrap();
    album_cache
        .values()
        .find(|album| album.id == album_id)
        .cloned()
        .ok_or_else(|| "Album not found".to_string())
}

#[tauri::command]
fn get_artists_songs_by_id(artist_id: u32) -> Result<Vec<Song>, String> {
    let artist_songs_map = ARTIST_SONGS_MAP.lock().unwrap();
    Ok(artist_songs_map.get(&artist_id).cloned().unwrap())
}

#[tauri::command]
fn get_albums_songs_by_id(album_id: u32) -> Result<Vec<Song>, String> {
    let album_songs_map = ALBUM_SONGS_MAP.lock().unwrap();
    Ok(album_songs_map.get(&album_id).cloned().unwrap())
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
    let song_data = match metadata_result {
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
            (title, artists, album, track_number)
        }
        Err(_) => {
            // 如果读取标签失败，则使用默认值
            (
                file_name.clone(),
                vec![get_or_create_artist("Unknown Artist".to_string())],
                get_or_create_album("Unknown Album".to_string()),
                0,
            )
        }
    };

    let song = Song {
        name: song_data.0,
        id: next_id(&SONG_ID_COUNTER),
        ar: song_data.1,
        lyric: String::new(),
        al: song_data.2,
        src: file,
        track_number: song_data.3,
    };
    {
        let mut artist_songs_map = ARTIST_SONGS_MAP.lock().unwrap();
        let mut album_songs_map = ALBUM_SONGS_MAP.lock().unwrap();

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
    MUSIC_CACHE.lock().unwrap().insert(dir, songs);
}

#[tauri::command]
fn refresh_music_cache() -> Result<(), String> {
    // 重置ID计数器
    *SONG_ID_COUNTER.lock().unwrap() = 0;
    *ARTIST_ID_COUNTER.lock().unwrap() = 0;
    *ALBUM_ID_COUNTER.lock().unwrap() = 0;

    // 清空音乐、艺术家和专辑的缓存
    MUSIC_CACHE.lock().unwrap().clear();
    ARTIST_CACHE.lock().unwrap().clear();
    ALBUM_CACHE.lock().unwrap().clear();
    ARTIST_SONGS_MAP.lock().unwrap().clear();
    ALBUM_SONGS_MAP.lock().unwrap().clear();

    let music_dirs = MUSIC_DIRS.lock().unwrap();
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

    *MUSIC_CACHE.lock().unwrap() = new_cache;
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
        })
    }
}

fn next_song_id() -> u32 {
    let mut id = SONG_ID_COUNTER.lock().unwrap();
    *id += 1;
    *id
}

fn next_artist_id() -> u32 {
    let mut id = ARTIST_ID_COUNTER.lock().unwrap();
    *id += 1;
    *id
}

fn next_album_id() -> u32 {
    let mut id = ALBUM_ID_COUNTER.lock().unwrap();
    *id += 1;
    *id
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

    // 1. 初始化缓存管理器
    if let Err(e) = CacheManager::init() {
        eprintln!("Failed to initialize cache manager: {}", e);
    }

    // 2. 加载音乐目录
    if let Err(e) = load_music_dirs_from_disk() {
        eprintln!("Failed to load music directories from disk: {}", e);
    }

    // 3. 尝试从缓存加载数据（快速启动）
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
    if let Some(manager_guard) = CacheManager::instance() {
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
fn rebuild_memory_cache_from_persistent(cache: &MusicLibraryCache) {
    // 重置计数器
    let max_song_id = cache.songs.iter().map(|s| s.id).max().unwrap_or(0);
    let max_artist_id = cache.artists.iter().map(|a| a.id).max().unwrap_or(0);
    let max_album_id = cache.albums.iter().map(|a| a.id).max().unwrap_or(0);
    
    *SONG_ID_COUNTER.lock().unwrap() = max_song_id;
    *ARTIST_ID_COUNTER.lock().unwrap() = max_artist_id;
    *ALBUM_ID_COUNTER.lock().unwrap() = max_album_id;
    
    // 重建艺术家缓存
    {
        let mut artist_cache = ARTIST_CACHE.lock().unwrap();
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
        let mut album_cache = ALBUM_CACHE.lock().unwrap();
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
        let mut music_cache = MUSIC_CACHE.lock().unwrap();
        let mut artist_songs_map = ARTIST_SONGS_MAP.lock().unwrap();
        let mut album_songs_map = ALBUM_SONGS_MAP.lock().unwrap();
        
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
                    ARTIST_CACHE.lock().unwrap().get(name).cloned()
                })
                .collect();
            
            let album = ALBUM_CACHE.lock().unwrap()
                .get(&cached_song.album)
                .cloned()
                .unwrap_or_else(|| Album {
                    id: 0,
                    name: cached_song.album.clone(),
                    pic_url: String::new(),
                });
            
            let song = Song {
                name: cached_song.name.clone(),
                id: cached_song.id,
                ar: artists,
                lyric: cached_song.lyric.clone(),
                al: album,
                src: cached_song.fingerprint.path.clone(),
                track_number: cached_song.track_number,
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
    if let Some(manager_guard) = CacheManager::instance() {
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
fn build_persistent_cache_from_memory() -> MusicLibraryCache {
    use cache_manager::{CachedAlbum, CachedArtist, CachedSongMetadata, FileFingerprint};
    use std::time::{SystemTime, UNIX_EPOCH};
    
    let mut cache = MusicLibraryCache::new();
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    
    // 复制艺术家
    {
        let artist_cache = ARTIST_CACHE.lock().unwrap();
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
        let album_cache = ALBUM_CACHE.lock().unwrap();
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
        let music_cache = MUSIC_CACHE.lock().unwrap();
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
                });
            }
        }
    }
    
    // 复制映射关系
    {
        let artist_songs_map = ARTIST_SONGS_MAP.lock().unwrap();
        for (artist_id, songs) in artist_songs_map.iter() {
            cache.artist_songs_map.insert(
                *artist_id,
                songs.iter().map(|s| s.id).collect(),
            );
        }
    }
    
    {
        let album_songs_map = ALBUM_SONGS_MAP.lock().unwrap();
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
        
        let existing_cache = if let Some(manager_guard) = CacheManager::instance() {
            if let Some(manager) = manager_guard.as_ref() {
                manager.load_from_disk().unwrap_or_else(|_| MusicLibraryCache::new())
            } else {
                MusicLibraryCache::new()
            }
        } else {
            MusicLibraryCache::new()
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
                    if let Some(manager_guard) = CacheManager::instance() {
                        if let Some(manager) = manager_guard.as_ref() {
                            let _ = manager.save_to_disk(&new_cache);
                            manager.update_memory_cache(new_cache);
                        }
                    }
                    
                    // 更新内存缓存
                    rebuild_memory_cache_from_persistent(
                        &CacheManager::instance().unwrap().as_ref().unwrap()
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
        let cache = MUSIC_CACHE.lock().unwrap();
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
        let cache = MUSIC_CACHE.lock().unwrap();
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
    let cache = MUSIC_CACHE.lock().unwrap();
    let dirs = cache
        .keys()
        .map(|path| path.display().to_string())
        .collect();
    Ok(dirs)
}

#[tauri::command]
fn remove_music_dirs(dirs_to_remove: Vec<String>) -> Result<(), String> {
    {
        let mut music_dirs = MUSIC_DIRS.lock().unwrap();
        music_dirs.retain(|dir| !dirs_to_remove.contains(&dir.display().to_string()));

        let mut cache = MUSIC_CACHE.lock().unwrap();
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
        let dirs = MUSIC_DIRS.lock().unwrap();
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
        let mut music_dirs = MUSIC_DIRS.lock().unwrap();
        *music_dirs = dirs;
    }
    Ok(())
}

#[tauri::command]
fn add_music_dirs(new_dirs: Vec<String>) -> Result<(), String> {
    {
        let mut music_dirs = MUSIC_DIRS.lock().unwrap();
        music_dirs.extend(new_dirs.iter().map(PathBuf::from));
    }
    save_music_dirs_to_disk();
    Ok(())
}

// 新增的关闭应用的方法
#[tauri::command]
fn close_app(window: tauri::Window) {
    // 关闭当前窗口
    window.close().unwrap();
}

// Tauri应用入口点
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化缓存管理器
    let _ = CacheManager::init();

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
            get_low_quality_album_cover,
            init_application,
            add_users_music_dir,
            get_users_music_dir,
            // 缓存管理命令
            cache_manager::get_cache_stats,
            cache_manager::clear_music_cache,
            cache_manager::is_cache_valid,
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
        ])
        .setup(|_app| {
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
