use crate::core_v2::models::{Song, Album, Artist, Trace};
use crate::sources::source::Source;
use async_trait::async_trait;

#[async_trait]
pub trait StorageSource: Source {
    async fn full_rescan(&self) -> Result<(Vec<Song>, Vec<Album>, Vec<Artist>), String>;
    
    fn get_all_songs(&self) -> Vec<Song>;
    fn get_all_albums(&self) -> Vec<Album>;
    fn get_all_artists(&self) -> Vec<Artist>;
    fn search(&self, keyword: &str) -> SearchResult;
}

pub struct SearchResult {
    pub songs: Vec<Song>,
    pub albums: Vec<Album>,
    pub artists: Vec<Artist>,
}
