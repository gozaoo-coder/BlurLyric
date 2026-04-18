use crate::core_v2::models::{Song, Album, Artist, Trace};
use crate::sources::source::Source;
use async_trait::async_trait;

#[async_trait]
pub trait APISource: Source {
    async fn search_song(&self, keyword: &str) -> Result<Vec<Song>, String>;
    async fn search_album(&self, keyword: &str) -> Result<Vec<Album>, String>;
    async fn search_artist(&self, keyword: &str) -> Result<Vec<Artist>, String>;
    
    async fn get_song_detail(&self, trace: &Trace) -> Result<Song, String>;
    async fn get_album_detail(&self, trace: &Trace) -> Result<Album, String>;
    async fn get_artist_detail(&self, trace: &Trace) -> Result<Artist, String>;
    
    async fn fetch_song_file(&self, trace: &Trace) -> Result<Vec<u8>, String>;
    async fn fetch_song_lyric(&self, trace: &Trace) -> Result<String, String>;
    async fn fetch_album_picture(&self, trace: &Trace) -> Result<Vec<u8>, String>;
}
