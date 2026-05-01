use std::any::Any;
use std::path::PathBuf;
use std::sync::Mutex;
use std::collections::VecDeque;
use async_trait::async_trait;
use crate::modules::music_library::source::{Source, SourceType};
use crate::modules::music_library::source::storage::StorageSource;
use crate::modules::music_library::models::source_song::SourceSong;
use crate::modules::music_library::models::source_album::SourceAlbum;

/// TempStorageSource — 缓存目录，容量上限可配置
#[derive(Debug)]
pub struct TempStorageSource {
    inner: StorageSource,
    capacity: u64,
    lru_tracker: Mutex<VecDeque<PathBuf>>,
}

impl TempStorageSource {
    pub fn new(id: impl Into<String>, capacity: u64) -> Self {
        TempStorageSource {
            inner: StorageSource::new(id),
            capacity,
            lru_tracker: Mutex::new(VecDeque::new()),
        }
    }

    /// 记录文件访问（更新 LRU）
    pub fn record_access(&self, path: &PathBuf) {
        if let Ok(mut tracker) = self.lru_tracker.lock() {
            // 移到队尾（最近使用）
            if let Some(pos) = tracker.iter().position(|p| p == path) {
                tracker.remove(pos);
            }
            tracker.push_back(path.clone());
        }
    }
}

#[async_trait]
impl Source for TempStorageSource {
    fn id(&self) -> &str {
        &self.inner.id
    }

    fn source_type(&self) -> SourceType {
        SourceType::Storage
    }

    fn as_any_mut(&mut self) -> &mut dyn Any {
        self
    }

    async fn get_song_file(&self, record: &SourceSong) -> Result<Vec<u8>, String> {
        let path = record.details.path.as_ref()
            .ok_or_else(|| "No file path".to_string())?;
        let pb = PathBuf::from(path);
        self.record_access(&pb);
        std::fs::read(&pb).map_err(|e| e.to_string())
    }

    async fn get_song_lyric(&self, _record: &SourceSong) -> Result<String, String> {
        Ok(String::new())
    }

    async fn get_album_picture(&self, _record: &SourceAlbum) -> Result<Vec<u8>, String> {
        Err("Temp storage does not store album pictures".to_string())
    }
}
