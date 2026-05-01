use std::collections::HashMap;
use std::path::Path;
use async_trait::async_trait;
use crate::modules::music_library::error::{Result, MusicLibraryError};
use crate::modules::music_library::models::source_song::SourceSong;
use crate::modules::music_library::models::source_album::SourceAlbum;
use crate::modules::music_library::source::{Source, SourceType};

/// 来源管理器
#[derive(Debug)]
pub struct SourceManager {
    sources: HashMap<String, Box<dyn Source>>,
}

impl SourceManager {
    pub fn new() -> Self {
        SourceManager {
            sources: HashMap::new(),
        }
    }

    /// 注册一个 Source
    pub fn register(&mut self, source: Box<dyn Source>) {
        let id = source.id().to_string();
        self.sources.insert(id, source);
    }

    /// 注销一个 Source
    pub fn unregister(&mut self, id: &str) -> Result<Box<dyn Source>> {
        self.sources.remove(id)
            .ok_or_else(|| MusicLibraryError::NotFound(format!("Source not found: {}", id)))
    }

    /// 获取 Source 引用
    pub fn get(&self, id: &str) -> Option<&dyn Source> {
        self.sources.get(id).map(|s| s.as_ref())
    }

    /// 获取 Source 可变引用
    pub fn get_mut(&mut self, id: &str) -> Option<&mut (dyn Source + '_)> {
        self.sources.get_mut(id).map(|s| s.as_mut() as &mut (dyn Source + '_))
    }

    /// 获取所有 Source
    pub fn get_all(&self) -> Vec<&dyn Source> {
        self.sources.values().map(|s| s.as_ref()).collect()
    }

    /// 获取所有 Source 的 ID
    pub fn get_all_ids(&self) -> Vec<String> {
        self.sources.keys().cloned().collect()
    }

    /// Source 数量
    pub fn len(&self) -> usize {
        self.sources.len()
    }

    pub fn is_empty(&self) -> bool {
        self.sources.is_empty()
    }
}
