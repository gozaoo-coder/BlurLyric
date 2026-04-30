pub mod playlist;
pub mod favor_manager;
pub mod downloads;

use std::sync::Mutex;
use std::collections::HashMap;

/// 收藏系统
pub struct FavorSystem {
    playlists: Vec<self::playlist::Playlist>,
    // source_manager: Arc<Mutex<SourceManager>>,
    // library_manager: Arc<Mutex<MusicStorageSourceLibraryManager>>,
}

impl FavorSystem {
    pub fn new() -> Self {
        FavorSystem {
            playlists: Vec::new(),
        }
    }
}
