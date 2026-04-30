use std::path::PathBuf;
use async_trait::async_trait;
use crate::modules::music_library::source::{Source, SourceType};
use crate::modules::music_library::models::source_song::SourceSong;
use crate::modules::music_library::models::source_album::SourceAlbum;

/// WebDevSource — 开发用来源
#[derive(Debug)]
pub struct WebDevSource {
    pub id: String,
    pub base_path: PathBuf,
}

impl WebDevSource {
    pub fn new(id: impl Into<String>, base_path: PathBuf) -> Self {
        WebDevSource {
            id: id.into(),
            base_path,
        }
    }
}

#[async_trait]
impl Source for WebDevSource {
    fn id(&self) -> &str {
        &self.id
    }

    fn source_type(&self) -> SourceType {
        SourceType::Storage
    }

    async fn get_song_file(&self, _record: &SourceSong) -> Result<Vec<u8>, String> {
        Err("WebDevSource does not provide actual file data".to_string())
    }

    async fn get_song_lyric(&self, record: &SourceSong) -> Result<String, String> {
        // 尝试从嵌入歌词读取
        let path = record.details.path.as_ref()
            .map(|s| s.as_str())
            .or_else(|| self.base_path.to_str())
            .unwrap_or("");
        if path.is_empty() {
            return Ok(String::new());
        }
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
        // 尝试从嵌入图片读取
        let path = record.details.path.as_ref()
            .map(|s| s.as_str())
            .or_else(|| self.base_path.to_str())
            .unwrap_or("");
        if path.is_empty() {
            return Err("No path available".to_string());
        }
        if let Ok(metadata) = crate::modules::music_tag::read_metadata(path) {
            if let Some(picture) = metadata.front_cover() {
                return Ok(picture.data.clone());
            }
        }
        Err("No cover found".to_string())
    }
}
