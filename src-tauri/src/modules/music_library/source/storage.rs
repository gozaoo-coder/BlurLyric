use std::path::{Path, PathBuf};
use std::collections::HashMap;
use async_trait::async_trait;
use crate::modules::music_library::error::{Result, MusicLibraryError};
use crate::modules::music_library::object_id::{ObjectId, R_SONG};
use crate::modules::music_library::models::source_song::{SourceSong, SourceSongDetails};
use crate::modules::music_library::manager::MusicStorageSourceLibraryManager;
use crate::modules::music_tag;

/// 文件扫描状态
#[derive(Debug, Clone)]
pub struct FileEntry {
    pub mtime: std::time::SystemTime,
    pub size: u64,
    pub record_id: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ScanState {
    pub files: HashMap<String, FileEntry>,
}

impl ScanState {
    pub fn new() -> Self {
        ScanState {
            files: HashMap::new(),
        }
    }

    pub fn save_to_disk(&self, path: &Path) -> Result<()> {
        let json = serde_json::to_string_pretty(self)?;
        let temp_path = path.with_extension("json.tmp");
        std::fs::write(&temp_path, &json)?;
        std::fs::rename(&temp_path, path)?;
        Ok(())
    }

    pub fn load_from_disk(path: &Path) -> Result<Self> {
        if !path.exists() {
            return Ok(ScanState::new());
        }
        let json = std::fs::read_to_string(path)?;
        let state: ScanState = serde_json::from_str(&json)?;
        Ok(state)
    }
}

impl serde::Serialize for ScanState {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeMap;
        let mut map = serializer.serialize_map(Some(self.files.len()))?;
        for (k, v) in &self.files {
            map.serialize_entry(k, &v)?;
        }
        map.end()
    }
}

impl<'de> serde::Deserialize<'de> for ScanState {
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let files: HashMap<String, FileEntry> = HashMap::deserialize(deserializer)?;
        Ok(ScanState { files })
    }
}

impl serde::Serialize for FileEntry {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("FileEntry", 3)?;
        let mtime_secs = self.mtime
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        state.serialize_field("mtime", &mtime_secs)?;
        state.serialize_field("size", &self.size)?;
        state.serialize_field("record_id", &self.record_id)?;
        state.end()
    }
}

impl<'de> serde::Deserialize<'de> for FileEntry {
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(serde::Deserialize)]
        struct FileEntryHelper {
            mtime: u64,
            size: u64,
            record_id: Option<String>,
        }
        let helper = FileEntryHelper::deserialize(deserializer)?;
        Ok(FileEntry {
            mtime: std::time::UNIX_EPOCH + std::time::Duration::from_secs(helper.mtime),
            size: helper.size,
            record_id: helper.record_id,
        })
    }
}

/// 扫描结果摘要
#[derive(Debug, Default)]
pub struct ScanSummary {
    pub added: u32,
    pub modified: u32,
    pub removed: u32,
    pub unchanged: u32,
    pub files_scanned: u32,
    pub scan_duration_ms: u64,
}

impl ScanSummary {
    pub fn total_changes(&self) -> u32 {
        self.added + self.modified + self.removed
    }
}

/// StorageSource — 文件系统来源基类
#[derive(Debug)]
pub struct StorageSource {
    pub id: String,
    pub base_paths: Vec<PathBuf>,
    pub scan_state: ScanState,
}

impl StorageSource {
    pub fn new(id: impl Into<String>) -> Self {
        StorageSource {
            id: id.into(),
            base_paths: Vec::new(),
            scan_state: ScanState::new(),
        }
    }

    pub fn add_path(&mut self, path: PathBuf) {
        if !self.base_paths.contains(&path) {
            self.base_paths.push(path);
        }
    }

    pub fn remove_path(&mut self, path: &Path) {
        self.base_paths.retain(|p| p != path);
    }

    /// 检查文件是否为支持的音频格式
    fn is_music_file(path: &Path) -> bool {
        matches!(
            path.extension().and_then(|e| e.to_str()),
            Some("mp3" | "ogg" | "flac" | "m4a" | "wav" | "aac")
        )
    }

    /// 递归收集目录下所有音乐文件
    fn collect_music_files(&self) -> Vec<PathBuf> {
        let mut files = Vec::new();
        for base_path in &self.base_paths {
            if base_path.is_dir() {
                Self::collect_files_recursive(base_path, &mut files);
            }
        }
        files
    }

    fn collect_files_recursive(dir: &Path, files: &mut Vec<PathBuf>) {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.filter_map(|r| r.ok()) {
                let path = entry.path();
                if path.is_dir() {
                    Self::collect_files_recursive(&path, files);
                } else if Self::is_music_file(&path) {
                    files.push(path);
                }
            }
        }
    }

    /// 获取当前所有文件的路径 + mtime + size
    fn collect_current_files(&self) -> Vec<(PathBuf, FileEntry)> {
        let mut result = Vec::new();
        for base_path in &self.base_paths {
            if base_path.is_dir() {
                Self::collect_files_with_metadata(base_path, &mut result);
            }
        }
        result
    }

    fn collect_files_with_metadata(dir: &Path, result: &mut Vec<(PathBuf, FileEntry)>) {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.filter_map(|r| r.ok()) {
                let path = entry.path();
                if path.is_dir() {
                    Self::collect_files_with_metadata(&path, result);
                } else if Self::is_music_file(&path) {
                    if let Ok(meta) = entry.metadata() {
                        let fe = FileEntry {
                            mtime: meta.modified().unwrap_or(std::time::UNIX_EPOCH),
                            size: meta.len(),
                            record_id: None,
                        };
                        result.push((path, fe));
                    }
                }
            }
        }
    }

    /// 全量分片扫描：收集所有音乐文件 → 分批解析元数据 → 注册到 Manager
    pub fn full_scan_chunked(
        &mut self,
        manager: &mut MusicStorageSourceLibraryManager,
        chunk_size: usize,
    ) -> Result<ScanSummary> {
        let start = std::time::Instant::now();
        let chunk_size = if chunk_size == 0 { 20 } else { chunk_size };
        let mut summary = ScanSummary::default();

        // 1. 收集所有音乐文件
        let files = self.collect_music_files();
        summary.files_scanned = files.len() as u32;
        println!("[{}] Full scan found {} files", self.id, files.len());

        // 2. 分片处理
        for chunk in files.chunks(chunk_size) {
            for file_path in chunk {
                match music_tag::read_metadata(file_path) {
                    Ok(metadata) => {
                        let artist_names: Vec<String> = metadata.artists.iter()
                            .map(|a| a.name.clone())
                            .collect();
                        let album_name = if metadata.album.name.is_empty()
                            || metadata.album.name == "Unknown Album"
                        { None } else { Some(metadata.album.name.as_str()) };

                        let details = SourceSongDetails::from_scan(
                            Some(file_path.display().to_string()),
                            Some(std::fs::metadata(file_path).ok().map(|m| m.len()).unwrap_or(0)),
                            file_path.extension().and_then(|e| e.to_str()).map(|s| s.to_string()),
                            metadata.bitrate,
                            metadata.sample_rate,
                            None, // bit_depth
                            metadata.channels,
                            metadata.duration,
                        );

                        let source_song = SourceSong::new(
                            ObjectId::new(R_SONG),
                            self.id.clone(),
                            file_path.display().to_string(),
                            details,
                        );

                        manager.register_or_merge_song(
                            source_song,
                            &metadata.title,
                            album_name,
                            artist_names,
                        );

                        summary.added += 1;
                    }
                    Err(e) => {
                        eprintln!("[{}] Failed to parse {}: {}", self.id, file_path.display(), e);
                    }
                }
            }
        }

        summary.scan_duration_ms = start.elapsed().as_millis() as u64;
        println!(
            "[{}] Full scan completed: {} files in {}ms",
            self.id, summary.files_scanned, summary.scan_duration_ms
        );

        Ok(summary)
    }

    /// 增量分片扫描：对比 ScanState → 只处理变更文件 → 分批解析 → 注册
    pub fn incremental_scan_chunked(
        &mut self,
        manager: &mut MusicStorageSourceLibraryManager,
        chunk_size: usize,
    ) -> Result<ScanSummary> {
        let start = std::time::Instant::now();
        let chunk_size = if chunk_size == 0 { 20 } else { chunk_size };
        let mut summary = ScanSummary::default();

        // 1. 收集当前所有文件
        let current_files = self.collect_current_files();
        summary.files_scanned = current_files.len() as u32;

        // 2. 与 ScanState 比对找出 added / modified / unchanged
        let mut scan_state_files = std::mem::take(&mut self.scan_state.files);

        let mut to_process: Vec<PathBuf> = Vec::new();

        for (path, fe) in &current_files {
            let path_str = path.display().to_string();
            if let Some(existing) = scan_state_files.remove(&path_str) {
                if existing.mtime != fe.mtime || existing.size != fe.size {
                    // modified
                    to_process.push(path.clone());
                } else {
                    summary.unchanged += 1;
                }
            } else {
                // added
                to_process.push(path.clone());
            }
        }

        // 剩余的 scan_state_files 条目对应已删除的文件
        let removed_count = scan_state_files.len() as u32;
        summary.removed = removed_count;

        // 3. 分片处理新增/修改的文件
        for chunk in to_process.chunks(chunk_size) {
            for file_path in chunk {
                match music_tag::read_metadata(file_path) {
                    Ok(metadata) => {
                        let artist_names: Vec<String> = metadata.artists.iter()
                            .map(|a| a.name.clone())
                            .collect();
                        let album_name = if metadata.album.name.is_empty()
                            || metadata.album.name == "Unknown Album"
                        { None } else { Some(metadata.album.name.as_str()) };

                        let details = SourceSongDetails::from_scan(
                            Some(file_path.display().to_string()),
                            Some(std::fs::metadata(file_path).ok().map(|m| m.len()).unwrap_or(0)),
                            file_path.extension().and_then(|e| e.to_str()).map(|s| s.to_string()),
                            metadata.bitrate,
                            metadata.sample_rate,
                            None,
                            metadata.channels,
                            metadata.duration,
                        );

                        let source_song = SourceSong::new(
                            ObjectId::new(R_SONG),
                            self.id.clone(),
                            file_path.display().to_string(),
                            details,
                        );

                        manager.register_or_merge_song(
                            source_song,
                            &metadata.title,
                            album_name,
                            artist_names,
                        );

                        // 检查该路径在 scan_state 中是否已存在，以判断 added / modified
                        let path_str = file_path.display().to_string();
                        let was_modified = self.scan_state.files.contains_key(&path_str);
                        if was_modified {
                            summary.modified += 1;
                        } else {
                            summary.added += 1;
                        }
                    }
                    Err(e) => {
                        eprintln!("[{}] Failed to parse {}: {}", self.id, file_path.display(), e);
                    }
                }
            }
        }

        // 4. 更新 ScanState
        for (path, fe) in &current_files {
            self.scan_state.files.insert(path.display().to_string(), fe.clone());
        }

        summary.scan_duration_ms = start.elapsed().as_millis() as u64;
        println!(
            "[{}] Incremental scan: {} added, {} modified, {} removed, {} unchanged ({}ms)",
            self.id, summary.added, summary.modified, summary.removed, summary.unchanged, summary.scan_duration_ms
        );

        Ok(summary)
    }
}
