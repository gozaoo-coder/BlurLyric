use serde::{Deserialize, Serialize};

/// 歌单
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Playlist {
    pub name: String,
    pub song_ids: Vec<String>,
}

impl Playlist {
    pub fn new(name: impl Into<String>) -> Self {
        Playlist {
            name: name.into(),
            song_ids: Vec::new(),
        }
    }

    pub fn add_song(&mut self, song_id: impl Into<String>) {
        let id = song_id.into();
        if !self.song_ids.contains(&id) {
            self.song_ids.push(id);
        }
    }

    pub fn remove_song(&mut self, song_id: &str) {
        self.song_ids.retain(|id| id != song_id);
    }

    pub fn contains(&self, song_id: &str) -> bool {
        self.song_ids.contains(&song_id.to_string())
    }
}
