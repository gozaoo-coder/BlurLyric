/**
 * Cache Manager - 多级缓存管理模块
 * 
 * 提供磁盘缓存和内存缓存的统一管理
 * 支持元数据缓存、文件指纹缓存、增量扫描
 */

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use lazy_static::lazy_static;

/// 文件指纹信息（用于增量扫描）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileFingerprint {
    pub path: PathBuf,
    pub modified_time: u64,
    pub size: u64,
    pub hash: String,
}

impl FileFingerprint {
    /// 从文件路径创建指纹
    pub fn from_path<P: AsRef<Path>>(path: P) -> Result<Self, String> {
        let path = path.as_ref().to_path_buf();
        let metadata = fs::metadata(&path)
            .map_err(|e| format!("Failed to read metadata: {}", e))?;
        
        let modified_time = metadata.modified()
            .map_err(|e| format!("Failed to get modified time: {}", e))?
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        
        let size = metadata.len();
        
        // 使用BLAKE3计算文件指纹
        let hash_input = format!("{}:{}:{}", path.display(), modified_time, size);
        let hash = blake3::hash(hash_input.as_bytes()).to_hex().to_string();
        
        Ok(FileFingerprint {
            path,
            modified_time,
            size,
            hash,
        })
    }
    
    /// 检查文件是否发生变化
    pub fn is_changed(&self) -> Result<bool, String> {
        let new_fingerprint = FileFingerprint::from_path(&self.path)?;
        Ok(self.hash != new_fingerprint.hash)
    }
}

/// 音轨来源信息（用于去重合并）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackSource {
    pub id: u32,
    pub path: PathBuf,
    pub file_size: u64,
    pub modified_time: u64,
    pub bitrate: Option<u32>,
    pub format: String,
    pub sample_rate: Option<u32>,
    pub duration: Option<f64>,
    pub quality_score: u32,
}

impl TrackSource {
    /// 计算音质评分
    pub fn calculate_quality_score(&self) -> u32 {
        let mut score = 0u32;
        
        // 比特率分数 (最高320分)
        if let Some(bitrate) = self.bitrate {
            score += bitrate.min(320);
        }
        
        // 格式分数 (无损格式优先)
        score += match self.format.to_lowercase().as_str() {
            "flac" => 500,
            "wav" | "aiff" => 400,
            "aac" | "m4a" => 300,
            "mp3" => 200,
            "ogg" => 250,
            "wma" => 150,
            _ => 100,
        };
        
        // 采样率分数 (最高480分，48kHz)
        if let Some(sample_rate) = self.sample_rate {
            score += (sample_rate / 100).min(480);
        }
        
        // 时长分数 (完整曲目优先，最高100分)
        if let Some(duration) = self.duration {
            if duration > 180.0 { // 超过3分钟
                score += 100;
            } else if duration > 60.0 { // 超过1分钟
                score += 50;
            }
        }
        
        score
    }
    
    /// 从元数据创建TrackSource
    pub fn from_metadata(
        id: u32,
        path: PathBuf,
        file_size: u64,
        modified_time: u64,
        bitrate: Option<u32>,
        format: &str,
        sample_rate: Option<u32>,
        duration: Option<f64>,
    ) -> Self {
        let mut source = Self {
            id,
            path,
            file_size,
            modified_time,
            bitrate,
            format: format.to_string(),
            sample_rate,
            duration,
            quality_score: 0,
        };
        source.quality_score = source.calculate_quality_score();
        source
    }
}

/// 歌曲元数据缓存
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedSongMetadata {
    pub id: u32,
    pub name: String,
    pub artists: Vec<String>,
    pub album: String,
    pub track_number: u16,
    pub lyric: String,
    pub fingerprint: FileFingerprint,
    pub cached_at: u64,
    // 新增字段：支持多来源
    pub primary_source: Option<TrackSource>,
    pub alternative_sources: Vec<TrackSource>,
    pub duration: Option<f64>,
    pub genre: Option<String>,
    pub year: Option<u32>,
    pub comment: Option<String>,
    pub composer: Option<String>,
    pub lyricist: Option<String>,
}

/// 艺术家缓存
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedArtist {
    pub id: u32,
    pub name: String,
    pub alias: Vec<String>,
}

/// 专辑缓存
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedAlbum {
    pub id: u32,
    pub name: String,
    pub pic_url: String,
}

/// 音乐库缓存数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MusicLibraryCache {
    pub version: u32,
    pub cached_at: u64,
    pub songs: Vec<CachedSongMetadata>,
    pub artists: Vec<CachedArtist>,
    pub albums: Vec<CachedAlbum>,
    pub file_fingerprints: HashMap<String, FileFingerprint>, // path -> fingerprint
    pub artist_songs_map: HashMap<u32, Vec<u32>>, // artist_id -> song_ids
    pub album_songs_map: HashMap<u32, Vec<u32>>, // album_id -> song_ids
}

impl MusicLibraryCache {
    pub fn new() -> Self {
        MusicLibraryCache {
            version: 1,
            cached_at: current_timestamp(),
            songs: Vec::new(),
            artists: Vec::new(),
            albums: Vec::new(),
            file_fingerprints: HashMap::new(),
            artist_songs_map: HashMap::new(),
            album_songs_map: HashMap::new(),
        }
    }
    
    /// 获取需要更新的文件列表
    pub fn get_files_to_update(&self, current_files: &[PathBuf]) -> (Vec<PathBuf>, Vec<PathBuf>) {
        let current_paths: std::collections::HashSet<String> = current_files
            .iter()
            .map(|p| p.display().to_string())
            .collect();
        
        let cached_paths: std::collections::HashSet<String> = self
            .file_fingerprints
            .keys()
            .cloned()
            .collect();
        
        // 新增的文件
        let to_add: Vec<PathBuf> = current_paths
            .difference(&cached_paths)
            .filter_map(|p| PathBuf::from(p).canonicalize().ok())
            .collect();
        
        // 删除的文件
        let to_remove: Vec<PathBuf> = cached_paths
            .difference(&current_paths)
            .map(PathBuf::from)
            .collect();
        
        (to_add, to_remove)
    }
    
    /// 检查文件是否需要重新扫描
    pub fn needs_rescan(&self, path: &Path) -> bool {
        let path_str = path.display().to_string();
        
        match self.file_fingerprints.get(&path_str) {
            None => true, // 新文件
            Some(fingerprint) => {
                match fingerprint.is_changed() {
                    Ok(changed) => changed,
                    Err(_) => true, // 出错时重新扫描
                }
            }
        }
    }
}

/// 缓存管理器
pub struct CacheManager {
    cache_dir: PathBuf,
    memory_cache: Mutex<Option<MusicLibraryCache>>,
}

lazy_static! {
    static ref CACHE_MANAGER: Mutex<Option<CacheManager>> = Mutex::new(None);
}

impl CacheManager {
    /// 初始化缓存管理器
    pub fn init() -> Result<(), String> {
        let cache_dir = get_cache_dir()?;
        let manager = CacheManager {
            cache_dir,
            memory_cache: Mutex::new(None),
        };
        
        // 尝试加载磁盘缓存到内存
        if let Ok(cache) = manager.load_from_disk() {
            *manager.memory_cache.lock().unwrap() = Some(cache);
        }
        
        *CACHE_MANAGER.lock().unwrap() = Some(manager);
        Ok(())
    }
    
    /// 获取缓存管理器实例
    pub fn instance() -> Option<std::sync::MutexGuard<'static, Option<CacheManager>>> {
        CACHE_MANAGER.lock().ok()
    }
    
    /// 获取缓存文件路径
    fn get_cache_file_path(&self) -> PathBuf {
        self.cache_dir.join("music_library_cache.json")
    }
    
    /// 从磁盘加载缓存
    pub fn load_from_disk(&self) -> Result<MusicLibraryCache, String> {
        let cache_file = self.get_cache_file_path();
        
        if !cache_file.exists() {
            return Ok(MusicLibraryCache::new());
        }
        
        let mut file = fs::File::open(&cache_file)
            .map_err(|e| format!("Failed to open cache file: {}", e))?;
        
        let mut contents = String::new();
        file.read_to_string(&mut contents)
            .map_err(|e| format!("Failed to read cache file: {}", e))?;
        
        let cache: MusicLibraryCache = serde_json::from_str(&contents)
            .map_err(|e| format!("Failed to parse cache: {}", e))?;
        
        Ok(cache)
    }
    
    /// 保存缓存到磁盘
    pub fn save_to_disk(&self, cache: &MusicLibraryCache) -> Result<(), String> {
        let cache_file = self.get_cache_file_path();
        
        // 确保目录存在
        if let Some(parent) = cache_file.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create cache directory: {}", e))?;
        }
        
        let json = serde_json::to_string_pretty(cache)
            .map_err(|e| format!("Failed to serialize cache: {}", e))?;
        
        let mut file = fs::File::create(&cache_file)
            .map_err(|e| format!("Failed to create cache file: {}", e))?;
        
        file.write_all(json.as_bytes())
            .map_err(|e| format!("Failed to write cache file: {}", e))?;
        
        Ok(())
    }
    
    /// 获取内存缓存
    pub fn get_memory_cache(&self) -> Option<MusicLibraryCache> {
        self.memory_cache.lock().unwrap().clone()
    }
    
    /// 更新内存缓存
    pub fn update_memory_cache(&self, cache: MusicLibraryCache) {
        *self.memory_cache.lock().unwrap() = Some(cache);
    }
    
    /// 清除所有缓存
    pub fn clear_cache(&self) -> Result<(), String> {
        *self.memory_cache.lock().unwrap() = None;
        
        let cache_file = self.get_cache_file_path();
        if cache_file.exists() {
            fs::remove_file(&cache_file)
                .map_err(|e| format!("Failed to remove cache file: {}", e))?;
        }
        
        Ok(())
    }
    
    /// 获取缓存统计信息
    pub fn get_cache_stats(&self) -> Result<CacheStats, String> {
        let cache = self.load_from_disk()?;
        
        Ok(CacheStats {
            total_songs: cache.songs.len(),
            total_artists: cache.artists.len(),
            total_albums: cache.albums.len(),
            cached_files: cache.file_fingerprints.len(),
            cache_version: cache.version,
            last_updated: cache.cached_at,
        })
    }
}

/// 缓存统计信息
#[derive(Debug, Clone, Serialize)]
pub struct CacheStats {
    pub total_songs: usize,
    pub total_artists: usize,
    pub total_albums: usize,
    pub cached_files: usize,
    pub cache_version: u32,
    pub last_updated: u64,
}

/// 获取缓存目录
fn get_cache_dir() -> Result<PathBuf, String> {
    let path = dirs::cache_dir().ok_or("Cannot get cache directory")?;
    let mut path = path;
    path.push("com.blurlyric.app");
    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }
    Ok(path)
}

/// 获取当前时间戳
fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

/// Tauri命令：获取缓存统计
#[tauri::command]
pub fn get_cache_stats() -> Result<CacheStats, String> {
    if let Some(manager_guard) = CacheManager::instance() {
        if let Some(manager) = manager_guard.as_ref() {
            return manager.get_cache_stats();
        }
    }
    Err("Cache manager not initialized".to_string())
}

/// Tauri命令：清除缓存
#[tauri::command]
pub fn clear_music_cache() -> Result<(), String> {
    if let Some(manager_guard) = CacheManager::instance() {
        if let Some(manager) = manager_guard.as_ref() {
            return manager.clear_cache();
        }
    }
    Err("Cache manager not initialized".to_string())
}

/// Tauri命令：检查缓存是否有效
#[tauri::command]
pub fn is_cache_valid() -> bool {
    if let Some(manager_guard) = CacheManager::instance() {
        if let Some(manager) = manager_guard.as_ref() {
            return manager.get_memory_cache().is_some();
        }
    }
    false
}
