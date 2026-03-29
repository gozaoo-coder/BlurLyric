/**
 * Incremental Scanner - 增量扫描模块
 * 
 * 提供高效的增量扫描功能，只扫描新增或修改的文件
 * 大幅提升启动速度和后续更新速度
 */

use crate::music_library_cache::{MusicLibraryCache as LibraryCacheManager, CachedAlbum, CachedArtist, CachedSongMetadata, FileFingerprint, MusicLibraryCacheData};
use crate::music_tag::MetadataParser;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, DirEntry};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Instant;

/// 扫描结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub added: Vec<CachedSongMetadata>,
    pub modified: Vec<CachedSongMetadata>,
    pub removed: Vec<u32>, // song ids
    pub unchanged: Vec<CachedSongMetadata>,
    pub scan_duration_ms: u64,
    pub files_scanned: usize,
}

impl ScanResult {
    pub fn new() -> Self {
        ScanResult {
            added: Vec::new(),
            modified: Vec::new(),
            removed: Vec::new(),
            unchanged: Vec::new(),
            scan_duration_ms: 0,
            files_scanned: 0,
        }
    }
    
    pub fn total_changes(&self) -> usize {
        self.added.len() + self.modified.len() + self.removed.len()
    }
}

/// 增量扫描器
pub struct IncrementalScanner {
    parser: MetadataParser,
    song_id_counter: AtomicUsize,
    artist_id_counter: AtomicUsize,
    album_id_counter: AtomicUsize,
}

impl IncrementalScanner {
    pub fn new(start_song_id: u32, start_artist_id: u32, start_album_id: u32) -> Self {
        IncrementalScanner {
            parser: MetadataParser::new(),
            song_id_counter: AtomicUsize::new(start_song_id as usize),
            artist_id_counter: AtomicUsize::new(start_artist_id as usize),
            album_id_counter: AtomicUsize::new(start_album_id as usize),
        }
    }
    
    /// 执行增量扫描
    pub fn scan_incremental(
        &self,
        music_dirs: &[PathBuf],
        existing_cache: &MusicLibraryCacheData,
    ) -> Result<ScanResult, String> {
        let start_time = Instant::now();
        let mut result = ScanResult::new();
        
        // 1. 收集当前所有音乐文件
        let current_files = self.collect_music_files(music_dirs);
        result.files_scanned = current_files.len();
        
        // 2. 确定新增、修改、删除的文件
        let (to_add, to_remove) = existing_cache.get_files_to_update(&current_files);
        
        // 3. 处理删除的文件
        for path in &to_remove {
            let path_str = path.display().to_string();
            if let Some(song) = existing_cache.songs.iter().find(|s| s.fingerprint.path == *path) {
                result.removed.push(song.id);
            }
        }
        
        // 4. 处理需要重新扫描的文件（新增或修改）
        let files_to_scan: Vec<PathBuf> = current_files
            .into_iter()
            .filter(|path| existing_cache.needs_rescan(path))
            .collect();
        
        // 5. 扫描文件并解析元数据
        for file_path in files_to_scan {
            let path_str = file_path.display().to_string();
            
            // 检查是否是修改的文件
            let is_modified = existing_cache.file_fingerprints.contains_key(&path_str);
            
            match self.parse_music_file(&file_path) {
                Ok(song_metadata) => {
                    if is_modified {
                        result.modified.push(song_metadata);
                    } else {
                        result.added.push(song_metadata);
                    }
                }
                Err(e) => {
                    eprintln!("Failed to parse music file {}: {}", path_str, e);
                }
            }
        }
        
        // 6. 保留未变更的文件
        for song in &existing_cache.songs {
            let path_str = song.fingerprint.path.display().to_string();
            if !to_remove.iter().any(|p| p.display().to_string() == path_str) 
                && !result.modified.iter().any(|s| s.fingerprint.path == song.fingerprint.path) {
                result.unchanged.push(song.clone());
            }
        }
        
        result.scan_duration_ms = start_time.elapsed().as_millis() as u64;
        
        println!("Incremental scan completed:");
        println!("  - Files scanned: {}", result.files_scanned);
        println!("  - Added: {}", result.added.len());
        println!("  - Modified: {}", result.modified.len());
        println!("  - Removed: {}", result.removed.len());
        println!("  - Unchanged: {}", result.unchanged.len());
        println!("  - Duration: {}ms", result.scan_duration_ms);
        
        Ok(result)
    }
    
    /// 执行全量扫描（首次或强制刷新）
    pub fn scan_full(&self, music_dirs: &[PathBuf]) -> Result<ScanResult, String> {
        let start_time = Instant::now();
        let mut result = ScanResult::new();
        
        // 收集所有音乐文件
        let files = self.collect_music_files(music_dirs);
        result.files_scanned = files.len();
        
        // 扫描所有文件
        for file_path in files {
            match self.parse_music_file(&file_path) {
                Ok(song_metadata) => {
                    result.added.push(song_metadata);
                }
                Err(e) => {
                    eprintln!("Failed to parse music file {}: {}", 
                        file_path.display(), e);
                }
            }
        }
        
        result.scan_duration_ms = start_time.elapsed().as_millis() as u64;
        
        println!("Full scan completed:");
        println!("  - Files scanned: {}", result.files_scanned);
        println!("  - Added: {}", result.added.len());
        println!("  - Duration: {}ms", result.scan_duration_ms);
        
        Ok(result)
    }
    
    /// 收集所有音乐文件
    fn collect_music_files(&self, dirs: &[PathBuf]) -> Vec<PathBuf> {
        let mut files = Vec::new();
        for dir in dirs {
            self.collect_files_recursive(dir, &mut files);
        }
        files
    }
    
    /// 递归收集音乐文件
    fn collect_files_recursive(&self, dir: &Path, files: &mut Vec<PathBuf>) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.filter_map(Result::ok) {
                let path = entry.path();
                if path.is_dir() {
                    self.collect_files_recursive(&path, files);
                } else if self.is_music_file(&entry) {
                    files.push(path);
                }
            }
        }
    }
    
    /// 检查是否为音乐文件
    fn is_music_file(&self, entry: &DirEntry) -> bool {
        matches!(
            entry.path().extension().and_then(|ext| ext.to_str()),
            Some("mp3" | "ogg" | "flac" | "m4a" | "wav" | "aac")
        )
    }
    
    /// 解析音乐文件元数据
    fn parse_music_file(&self, file: &Path) -> Result<CachedSongMetadata, String> {
        // 生成文件指纹
        let fingerprint = FileFingerprint::from_path(file)?;
        
        // 解析元数据
        let metadata = self.parser.parse(file)
            .map_err(|e| format!("Failed to parse metadata: {}", e))?;
        
        // 获取文件名作为备用标题
        let file_name = file
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("Unknown Title")
            .to_string();
        
        // 提取歌曲信息
        let title = if metadata.title.is_empty() {
            file_name
        } else {
            metadata.title
        };
        
        // 处理艺术家
        let artists: Vec<String> = if metadata.artists.is_empty() {
            vec!["Unknown Artist".to_string()]
        } else {
            metadata.artists.iter()
                .flat_map(|artist| self.split_artist_names(&artist.name))
                .collect()
        };
        
        // 处理专辑
        let album = if metadata.album.name.is_empty() {
            "Unknown Album".to_string()
        } else {
            metadata.album.name
        };
        
        let track_number = metadata.track_number.unwrap_or(0);
        
        // 生成ID
        let id = self.next_song_id();
        
        Ok(CachedSongMetadata {
            id,
            name: title,
            artists,
            album,
            track_number,
            lyric: String::new(),
            fingerprint,
            cached_at: current_timestamp(),
            // 新增字段
            primary_source: None,
            alternative_sources: Vec::new(),
            duration: metadata.duration,
            genre: metadata.genre.clone(),
            year: metadata.year,
            comment: metadata.comment.clone(),
            composer: metadata.composer.clone(),
            lyricist: metadata.lyricist.clone(),
        })
    }
    
    /// 分割艺术家名称
    fn split_artist_names(&self, name: &str) -> Vec<String> {
        name.split(&['/', '&', '\\'][..])
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect()
    }
    
    /// 生成下一个歌曲ID
    fn next_song_id(&self) -> u32 {
        self.song_id_counter.fetch_add(1, Ordering::SeqCst) as u32
    }
}

/// 从扫描结果构建完整的缓存
pub fn build_cache_from_scan(
    scan_result: ScanResult,
    existing_cache: Option<&MusicLibraryCacheData>,
) -> MusicLibraryCacheData {
    let mut cache = MusicLibraryCacheData::new();
    
    // 合并所有歌曲
    let mut all_songs = scan_result.unchanged;
    all_songs.extend(scan_result.added);
    all_songs.extend(scan_result.modified);
    
    cache.songs = all_songs;
    
    // 重建艺术家和专辑信息
    let mut artist_map: HashMap<String, CachedArtist> = HashMap::new();
    let mut album_map: HashMap<String, CachedAlbum> = HashMap::new();
    let mut artist_id_counter = 1u32;
    let mut album_id_counter = 1u32;
    
    // 如果有现有缓存，保留ID映射
    if let Some(existing) = existing_cache {
        for artist in &existing.artists {
            artist_map.insert(artist.name.clone(), artist.clone());
            artist_id_counter = artist_id_counter.max(artist.id + 1);
        }
        for album in &existing.albums {
            album_map.insert(album.name.clone(), album.clone());
            album_id_counter = album_id_counter.max(album.id + 1);
        }
    }
    
    // 为每首歌建立映射关系
    for song in &cache.songs {
        // 更新文件指纹
        cache.file_fingerprints.insert(
            song.fingerprint.path.display().to_string(),
            song.fingerprint.clone(),
        );
        
        // 处理艺术家
        for artist_name in &song.artists {
            let artist = artist_map.entry(artist_name.clone()).or_insert_with(|| {
                let id = artist_id_counter;
                artist_id_counter += 1;
                CachedArtist {
                    id,
                    name: artist_name.clone(),
                    alias: Vec::new(),
                }
            });
            
            cache.artist_songs_map
                .entry(artist.id)
                .or_insert_with(Vec::new)
                .push(song.id);
        }
        
        // 处理专辑
        let album = album_map.entry(song.album.clone()).or_insert_with(|| {
            let id = album_id_counter;
            album_id_counter += 1;
            CachedAlbum {
                id,
                name: song.album.clone(),
                pic_url: String::new(),
            }
        });
        
        cache.album_songs_map
            .entry(album.id)
            .or_insert_with(Vec::new)
            .push(song.id);
    }
    
    cache.artists = artist_map.into_values().collect();
    cache.albums = album_map.into_values().collect();
    cache.cached_at = current_timestamp();
    
    cache
}

/// 获取当前时间戳
fn current_timestamp() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

/// 扫描结果摘要（用于前端展示）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResultSummary {
    pub files_scanned: usize,
    pub added: usize,
    pub modified: usize,
    pub removed: usize,
    pub unchanged: usize,
    pub scan_duration_ms: u64,
    pub success: bool,
}

impl From<ScanResult> for ScanResultSummary {
    fn from(result: ScanResult) -> Self {
        ScanResultSummary {
            files_scanned: result.files_scanned,
            added: result.added.len(),
            modified: result.modified.len(),
            removed: result.removed.len(),
            unchanged: result.unchanged.len(),
            scan_duration_ms: result.scan_duration_ms,
            success: true,
        }
    }
}

/// Tauri命令：执行增量扫描
#[tauri::command]
pub fn perform_incremental_scan() -> Result<ScanResultSummary, String> {
    // 获取音乐目录
    let music_dirs = crate::get_music_dirs();
    
    // 获取现有缓存
    let existing_cache = if let Some(manager_guard) = LibraryCacheManager::instance() {
        if let Some(manager) = manager_guard.as_ref() {
            manager.load_from_disk().unwrap_or_else(|_| MusicLibraryCacheData::new())
        } else {
            MusicLibraryCacheData::new()
        }
    } else {
        MusicLibraryCacheData::new()
    };
    
    // 确定起始ID
    let max_song_id = existing_cache.songs.iter().map(|s| s.id).max().unwrap_or(0);
    let max_artist_id = existing_cache.artists.iter().map(|a| a.id).max().unwrap_or(0);
    let max_album_id = existing_cache.albums.iter().map(|a| a.id).max().unwrap_or(0);
    
    // 执行增量扫描
    let scanner = IncrementalScanner::new(max_song_id, max_artist_id, max_album_id);
    let scan_result = scanner.scan_incremental(&music_dirs, &existing_cache)?;
    
    // 构建新缓存
    let new_cache = build_cache_from_scan(scan_result.clone(), Some(&existing_cache));
    
    // 保存到磁盘和内存
    if let Some(manager_guard) = LibraryCacheManager::instance() {
        if let Some(manager) = manager_guard.as_ref() {
            manager.save_to_disk(&new_cache)?;
            manager.update_memory_cache(new_cache);
        }
    }
    
    Ok(scan_result.into())
}

/// Tauri命令：执行全量扫描
#[tauri::command]
pub fn perform_full_scan() -> Result<ScanResultSummary, String> {
    // 获取音乐目录
    let music_dirs = crate::get_music_dirs();
    
    // 执行全量扫描
    let scanner = IncrementalScanner::new(0, 0, 0);
    let scan_result = scanner.scan_full(&music_dirs)?;
    
    // 构建新缓存
    let new_cache = build_cache_from_scan(scan_result.clone(), None);
    
    // 保存到磁盘和内存
    if let Some(manager_guard) = LibraryCacheManager::instance() {
        if let Some(manager) = manager_guard.as_ref() {
            manager.save_to_disk(&new_cache)?;
            manager.update_memory_cache(new_cache);
        }
    }
    
    Ok(scan_result.into())
}
