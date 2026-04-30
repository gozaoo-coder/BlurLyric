use std::path::PathBuf;
use async_trait::async_trait;
use crate::modules::music_library::source::{Source, SourceType};
use crate::modules::music_library::source::storage::StorageSource;
use crate::modules::music_library::models::source_song::SourceSong;
use crate::modules::music_library::models::source_album::SourceAlbum;

/// LocalStorageSource — 用户本地音乐目录
#[derive(Debug)]
pub struct LocalStorageSource(StorageSource);

impl LocalStorageSource {
    pub fn new(id: impl Into<String>) -> Self {
        LocalStorageSource(StorageSource::new(id))
    }

    pub fn add_path(&mut self, path: PathBuf) {
        self.0.add_path(path);
    }
}

#[async_trait]
impl Source for LocalStorageSource {
    fn id(&self) -> &str {
        &self.0.id
    }

    fn source_type(&self) -> SourceType {
        SourceType::Storage
    }

    async fn get_song_file(&self, record: &SourceSong) -> Result<Vec<u8>, String> {
        let path = record.details.path.as_ref()
            .ok_or_else(|| "No file path".to_string())?;
        std::fs::read(path).map_err(|e| e.to_string())
    }

    async fn get_song_lyric(&self, record: &SourceSong) -> Result<String, String> {
        let path = record.details.path.as_ref()
            .ok_or_else(|| "No file path".to_string())?;

        // 1. 尝试 .lrc 旁路文件
        let lrc_path = PathBuf::from(path).with_extension("lrc");
        if lrc_path.exists() {
            return std::fs::read_to_string(&lrc_path).map_err(|e| e.to_string());
        }

        // 2. 尝试读取嵌入歌词
        if let Ok(metadata) = crate::modules::music_tag::read_metadata(path) {
            if let Some(lyrics) = metadata.lyrics {
                if !lyrics.content.is_empty() {
                    return Ok(lyrics.content);
                }
            }
        }

        Ok(String::new())
    }

    async fn get_album_picture(&self, record: &SourceAlbum) -> Result<Vec<u8>, String> {
        let path = record.details.path.as_ref()
            .ok_or_else(|| "No file path".to_string())?;
        let pb = PathBuf::from(path);

        // 1. 尝试目录中的封面图片文件
        if let Some(dir) = pb.parent() {
            for cover_name in &["cover.jpg", "cover.png", "folder.jpg", "album.jpg"] {
                let cover_path = dir.join(cover_name);
                if cover_path.exists() {
                    return std::fs::read(&cover_path).map_err(|e| e.to_string());
                }
            }
        }

        // 2. 尝试通过 music_tag 读取嵌入图片
        if let Ok(metadata) = crate::modules::music_tag::read_metadata(path) {
            if let Some(picture) = metadata.front_cover() {
                return Ok(picture.data.clone());
            }
        }

        Err("No cover found".to_string())
    }
}
