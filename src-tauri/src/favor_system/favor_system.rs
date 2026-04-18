use std::sync::{Arc, Mutex};

use crate::core_v2::events::LibraryEvent;
use crate::core_v2::models::SongID;
use crate::library_manager::MusicStorageSourceLibraryManager;
use tokio::sync::broadcast;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Playlist {
    pub name: String,
    #[serde(default)]
    pub song_ids: Vec<SongID>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, Default)]
pub struct Playlists {
    #[serde(default)]
    pub lists: Vec<Playlist>,
}

pub struct FavorSystem {
    playlists: Arc<Mutex<Playlists>>,
    library_manager: Arc<Mutex<MusicStorageSourceLibraryManager>>,
}

impl FavorSystem {
    pub fn new(
        library_manager: Arc<Mutex<MusicStorageSourceLibraryManager>>,
        mut event_receiver: broadcast::Receiver<LibraryEvent>
    ) -> Self {
        let system = Self {
            playlists: Arc::new(Mutex::new(Playlists { lists: Vec::new() })),
            library_manager,
        };
        
        let playlists_clone = Arc::clone(&system.playlists);
        tokio::spawn(async move {
            while let Ok(event) = event_receiver.recv().await {
                if let LibraryEvent::EntityCleanup { entity_id } = event {
                    let mut playlists = playlists_clone.lock().unwrap();
                    for playlist in &mut playlists.lists {
                        playlist.song_ids.retain(|id| id != &entity_id);
                    }
                }
            }
        });
        
        system
    }

    pub fn add_favorite(&self, song_id: SongID) {
        let mut playlists = self.playlists.lock().unwrap();
        
        if let Some(playlist) = playlists.lists.iter_mut().find(|p| p.name == "我喜欢的音乐") {
            if !playlist.song_ids.contains(&song_id) {
                playlist.song_ids.push(song_id);
            }
        } else {
            playlists.lists.push(Playlist {
                name: "我喜欢的音乐".to_string(),
                song_ids: vec![song_id],
            });
        }
    }

    pub fn remove_favorite(&self, song_id: &SongID) {
        let mut playlists = self.playlists.lock().unwrap();
        
        if let Some(playlist) = playlists.lists.iter_mut().find(|p| p.name == "我喜欢的音乐") {
            playlist.song_ids.retain(|id| id != song_id);
        }
    }

    pub fn get_playlist(&self, name: &str) -> Option<Playlist> {
        let playlists = self.playlists.lock().unwrap();
        playlists.lists.iter().find(|p| p.name == name).cloned()
    }

    pub fn get_all_playlists(&self) -> Vec<Playlist> {
        let playlists = self.playlists.lock().unwrap();
        playlists.lists.clone()
    }

    pub fn create_playlist(&self, name: String) {
        let mut playlists = self.playlists.lock().unwrap();
        if !playlists.lists.iter().any(|p| p.name == name) {
            playlists.lists.push(Playlist {
                name,
                song_ids: Vec::new(),
            });
        }
    }

    pub fn add_to_playlist(&self, playlist_name: &str, song_id: SongID) {
        let mut playlists = self.playlists.lock().unwrap();
        if let Some(playlist) = playlists.lists.iter_mut().find(|p| p.name == playlist_name) {
            if !playlist.song_ids.contains(&song_id) {
                playlist.song_ids.push(song_id);
            }
        }
    }

    pub fn remove_from_playlist(&self, playlist_name: &str, song_id: &SongID) {
        let mut playlists = self.playlists.lock().unwrap();
        if let Some(playlist) = playlists.lists.iter_mut().find(|p| p.name == playlist_name) {
            playlist.song_ids.retain(|id| id != song_id);
        }
    }
}

impl Clone for FavorSystem {
    fn clone(&self) -> Self {
        Self {
            playlists: Arc::clone(&self.playlists),
            library_manager: Arc::clone(&self.library_manager),
        }
    }
}
