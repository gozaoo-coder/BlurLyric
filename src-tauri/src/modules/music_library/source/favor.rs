use std::path::PathBuf;
use async_trait::async_trait;
use crate::modules::music_library::source::{Source, SourceType};
use crate::modules::music_library::source::local::LocalStorageSource;
use crate::modules::music_library::models::source_song::SourceSong;
use crate::modules::music_library::models::source_album::SourceAlbum;

/// FavorStorageSource — 收藏持久存储
/// 基于 LocalStorageSource 实现，文件不会自动清理
#[derive(Debug)]
pub struct FavorStorageSource(LocalStorageSource);

impl FavorStorageSource {
    pub fn new(id: impl Into<String>) -> Self {
        FavorStorageSource(LocalStorageSource::new(id))
    }

    pub fn add_path(&mut self, path: PathBuf) {
        self.0.add_path(path);
    }
}

#[async_trait]
impl Source for FavorStorageSource {
    fn id(&self) -> &str {
        self.0.id()
    }

    fn source_type(&self) -> SourceType {
        SourceType::Storage
    }

    async fn get_song_file(&self, record: &SourceSong) -> Result<Vec<u8>, String> {
        self.0.get_song_file(record).await
    }

    async fn get_song_lyric(&self, record: &SourceSong) -> Result<String, String> {
        self.0.get_song_lyric(record).await
    }

    async fn get_album_picture(&self, record: &SourceAlbum) -> Result<Vec<u8>, String> {
        self.0.get_album_picture(record).await
    }
}
