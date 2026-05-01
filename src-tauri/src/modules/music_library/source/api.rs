use async_trait::async_trait;
use crate::modules::music_library::source::{Source, SourceType, FetchGuard};
use crate::modules::music_library::models::source_song::SourceSong;
use crate::modules::music_library::models::source_album::SourceAlbum;
use crate::modules::music_library::models::source_artist::SourceArtist;

/// APISource trait — 远程 API 来源的扩展接口
#[async_trait]
pub trait APISource: Source {
    async fn search_song(&self, keyword: &str) -> Result<Vec<SourceSong>, String>;
    async fn search_album(&self, keyword: &str) -> Result<Vec<SourceAlbum>, String>;
    async fn search_artist(&self, keyword: &str) -> Result<Vec<SourceArtist>, String>;
    async fn fetch_song_detail(&self, external_id: &str) -> Result<SourceSong, String>;
}

/// API 获取守卫（防重复请求）
#[derive(Debug)]
pub struct ApiFetchGuard {
    guard: FetchGuard,
}

impl ApiFetchGuard {
    pub fn new() -> Self {
        ApiFetchGuard {
            guard: FetchGuard::new(),
        }
    }
}
