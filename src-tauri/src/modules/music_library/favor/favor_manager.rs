use std::path::Path;
use serde::{Deserialize, Serialize};
use crate::modules::music_library::error::{Result, MusicLibraryError};
use super::playlist::Playlist;

/// 持久化格式
#[derive(Debug, Serialize, Deserialize)]
struct PlaylistsData {
    version: u32,
    playlists: Vec<Playlist>,
}

/// 收藏管理器
#[derive(Debug)]
pub struct FavorManager {
    playlists: Vec<Playlist>,
}

impl FavorManager {
    pub fn new() -> Self {
        FavorManager {
            playlists: vec![Playlist::new("default")],
        }
    }

    /// 添加歌曲到歌单
    pub fn add_to_playlist(&mut self, song_id: impl Into<String>, playlist_name: &str) -> Result<()> {
        let playlist = self.find_or_create(playlist_name);
        playlist.add_song(song_id);
        Ok(())
    }

    /// 从歌单移除歌曲
    pub fn remove_from_playlist(&mut self, song_id: &str, playlist_name: &str) {
        if let Some(playlist) = self.find_mut(playlist_name) {
            playlist.remove_song(song_id);
        }
    }

    /// 获取歌单
    pub fn get_playlist(&self, name: &str) -> Option<&Playlist> {
        self.playlists.iter().find(|p| p.name == name)
    }

    /// 获取所有歌单
    pub fn get_all_playlists(&self) -> &[Playlist] {
        &self.playlists
    }

    /// 创建新歌单
    pub fn create_playlist(&mut self, name: &str) -> Result<()> {
        if self.playlists.iter().any(|p| p.name == name) {
            return Err(MusicLibraryError::DuplicateError(
                format!("Playlist already exists: {}", name)
            ));
        }
        self.playlists.push(Playlist::new(name));
        Ok(())
    }

    /// 删除歌单
    pub fn delete_playlist(&mut self, name: &str) -> Result<()> {
        if name == "default" {
            return Err(MusicLibraryError::InvalidState(
                "Cannot delete the default playlist".to_string()
            ));
        }
        let idx = self.playlists.iter()
            .position(|p| p.name == name)
            .ok_or_else(|| MusicLibraryError::NotFound(
                format!("Playlist not found: {}", name)
            ))?;
        self.playlists.remove(idx);
        Ok(())
    }

    /// 检查歌曲是否在某个歌单中
    pub fn is_in_playlist(&self, song_id: &str, playlist_name: &str) -> bool {
        self.get_playlist(playlist_name)
            .map(|p| p.contains(song_id))
            .unwrap_or(false)
    }

    /// 获取引用某歌曲的所有歌单名
    pub fn find_playlists_containing(&self, song_id: &str) -> Vec<&str> {
        self.playlists.iter()
            .filter(|p| p.contains(song_id))
            .map(|p| p.name.as_str())
            .collect()
    }

    /// 序列化到磁盘
    pub fn save_to_disk(&self, path: &Path) -> Result<()> {
        let data = PlaylistsData {
            version: 1,
            playlists: self.playlists.clone(),
        };
        let temp_path = path.with_extension("json.tmp");
        let json_str = serde_json::to_string_pretty(&data)?;
        std::fs::write(&temp_path, json_str)?;
        std::fs::rename(&temp_path, path)?;
        Ok(())
    }

    /// 从磁盘加载
    pub fn load_from_disk(path: &Path) -> Result<Self> {
        if !path.exists() {
            return Ok(FavorManager::new());
        }
        let json_str = std::fs::read_to_string(path)?;
        let data: PlaylistsData = serde_json::from_str(&json_str)?;
        Ok(FavorManager {
            playlists: data.playlists,
        })
    }

    fn find_mut(&mut self, name: &str) -> Option<&mut Playlist> {
        self.playlists.iter_mut().find(|p| p.name == name)
    }

    fn find_or_create(&mut self, name: &str) -> &mut Playlist {
        let idx = self.playlists.iter().position(|p| p.name == name);
        match idx {
            Some(i) => &mut self.playlists[i],
            None => {
                self.playlists.push(Playlist::new(name));
                self.playlists.last_mut().unwrap()
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_and_get_playlist() {
        let mut fm = FavorManager::new();
        fm.create_playlist("favorites").unwrap();
        assert!(fm.get_playlist("favorites").is_some());
    }

    #[test]
    fn test_add_and_remove_song() {
        let mut fm = FavorManager::new();
        fm.add_to_playlist("m_song_001", "default").unwrap();
        assert!(fm.is_in_playlist("m_song_001", "default"));

        fm.remove_from_playlist("m_song_001", "default");
        assert!(!fm.is_in_playlist("m_song_001", "default"));
    }

    #[test]
    fn test_delete_playlist() {
        let mut fm = FavorManager::new();
        fm.create_playlist("custom").unwrap();
        fm.delete_playlist("custom").unwrap();
        assert!(fm.get_playlist("custom").is_none());
    }

    #[test]
    fn test_cannot_delete_default() {
        let mut fm = FavorManager::new();
        assert!(fm.delete_playlist("default").is_err());
    }

    #[test]
    fn test_duplicate_playlist() {
        let mut fm = FavorManager::new();
        assert!(fm.create_playlist("default").is_err());
    }
}
