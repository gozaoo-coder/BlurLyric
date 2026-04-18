use crate::core_v2::models::Trace;
use async_trait::async_trait;

#[async_trait]
pub trait Source {
    fn get_source_id(&self) -> String;
    fn get_name(&self) -> String;
    fn get_type(&self) -> String;
    
    async fn get_song_file(&self, trace: &Trace) -> Result<Vec<u8>, String>;
    async fn get_song_lyric(&self, trace: &Trace) -> Result<String, String>;
    async fn get_album_picture(&self, trace: &Trace) -> Result<Vec<u8>, String>;
}
