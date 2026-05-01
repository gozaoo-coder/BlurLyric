pub mod manager;
pub mod storage;
pub mod local;
pub mod temp;
pub mod favor;
pub mod webdev;
pub mod api;

use std::sync::Mutex;
use std::collections::HashMap;
use std::any::Any;
use async_trait::async_trait;
use tokio::task::JoinHandle;
use crate::modules::music_library::models::source_song::SourceSong;
use crate::modules::music_library::models::source_album::SourceAlbum;

/// 来源类型
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SourceType {
    Storage,
    Api,
}

/// Source trait — 所有来源的统一接口
#[async_trait]
pub trait Source: std::fmt::Debug + Send + Sync {
    fn id(&self) -> &str;
    fn source_type(&self) -> SourceType;

    async fn get_song_file(&self, record: &SourceSong) -> Result<Vec<u8>, String>;
    async fn get_song_lyric(&self, record: &SourceSong) -> Result<String, String>;
    async fn get_album_picture(&self, record: &SourceAlbum) -> Result<Vec<u8>, String>;

    /// 向下转型为 &mut Any（用于获取子类特有方法）
    fn as_any_mut(&mut self) -> &mut dyn Any;
}

/// 统一获取守卫（防重复请求）
#[derive(Debug)]
pub struct FetchGuard {
    in_flight: Mutex<HashMap<String, JoinHandle<Result<Vec<u8>, String>>>>,
}

impl FetchGuard {
    pub fn new() -> Self {
        FetchGuard {
            in_flight: Mutex::new(HashMap::new()),
        }
    }
}
