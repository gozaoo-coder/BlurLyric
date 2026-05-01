use std::path::Path;
use crate::modules::music_library::error::{Result, MusicLibraryError};
use crate::modules::music_library::object_id::{ObjectId, M_SONG, M_ALBUM, M_ARTIST, R_SONG, R_ALBUM, R_ARTIST};
use crate::modules::music_library::quality::Quality;
use crate::modules::music_library::models::source_song::{SourceSong, SourceSongDetails};
use crate::modules::music_library::models::source_album::{SourceAlbum, SourceAlbumDetails};
use crate::modules::music_library::models::source_artist::{SourceArtist, SourceArtistDetails};
use crate::modules::music_library::manager::MusicStorageSourceLibraryManager;

/// 旧缓存格式（来自于 cache_manager.rs 的 CachedSongMetadata 的简化版本）
#[derive(serde::Deserialize)]
struct OldCache {
    songs: Vec<OldSong>,
    artists: Vec<OldArtist>,
    albums: Vec<OldAlbum>,
}

#[derive(serde::Deserialize)]
struct OldSong {
    id: u32,
    name: String,
    artists: Vec<String>,
    album: String,
    duration: Option<f64>,
    bitrate: Option<u32>,
    sample_rate: Option<u32>,
    primary_source: Option<OldTrackSource>,
}

#[derive(serde::Deserialize)]
struct OldTrackSource {
    path: String,
    format: String,
    bitrate: Option<u32>,
    sample_rate: Option<u32>,
    duration: Option<f64>,
    file_size: u64,
}

#[derive(serde::Deserialize)]
struct OldArtist {
    id: u32,
    name: String,
}

#[derive(serde::Deserialize)]
struct OldAlbum {
    id: u32,
    name: String,
    pic_url: Option<String>,
}

/// 从旧 cache JSON 文件迁移到新的 Object 模型
pub fn migrate_from_old_cache(old_path: &Path) -> Result<MusicStorageSourceLibraryManager> {
    if !old_path.exists() {
        return Ok(MusicStorageSourceLibraryManager::new());
    }

    let json_str = std::fs::read_to_string(old_path)?;
    let old_cache: OldCache = serde_json::from_str(&json_str)
        .map_err(|e| MusicLibraryError::ParseError(format!(
            "Failed to parse old cache: {}", e
        )))?;

    let mut manager = MusicStorageSourceLibraryManager::new();

    // 1. 先创建所有 MasterArtist
    let mut artist_id_map: std::collections::HashMap<u32, String> = std::collections::HashMap::new();
    for old_artist in &old_cache.artists {
        let artist_id = ObjectId::new(M_ARTIST);
        artist_id_map.insert(old_artist.id, artist_id.as_str().to_string());

        // 创建 MasterArtist（SourceArtist 会由 Source 系统创建）
        let master = crate::modules::music_library::models::master_artist::MasterArtist::new(
            artist_id.clone(),
            old_artist.name.clone(),
        );
        manager.insert(crate::modules::music_library::manager::ObjectEntry::MasterArtist(master));
    }

    // 2. 创建所有 MasterAlbum
    let mut album_id_map: std::collections::HashMap<u32, String> = std::collections::HashMap::new();
    for old_album in &old_cache.albums {
        let album_id = ObjectId::new(M_ALBUM);
        album_id_map.insert(old_album.id, album_id.as_str().to_string());

        let master = crate::modules::music_library::models::master_album::MasterAlbum::new(
            album_id.clone(),
            old_album.name.clone(),
            Vec::new(),
        );
        manager.insert(crate::modules::music_library::manager::ObjectEntry::MasterAlbum(master));
    }

    // 3. 创建 MasterSong 和 SourceSong
    for old_song in &old_cache.songs {
        let song_id = ObjectId::new(M_SONG);
        let source_id = ObjectId::new(R_SONG);

        // 解析专辑关联
        let album_ref = album_id_map.get(&old_song.id).cloned();
        let artist_refs: Vec<String> = old_song.artists.iter()
            .filter_map(|name| {
                // Try to find artist by name
                old_cache.artists.iter()
                    .find(|a| &a.name == name)
                    .and_then(|a| artist_id_map.get(&a.id))
                    .cloned()
            })
            .collect();

        // 创建 SourceSong
        let (format, path, bitrate, sample_rate, file_size, duration) = old_song.primary_source
            .as_ref()
            .map(|s| (
                Some(s.format.clone()),
                Some(s.path.clone()),
                s.bitrate,
                s.sample_rate,
                Some(s.file_size),
                s.duration,
            ))
            .unwrap_or_else(|| (None, None, None, None, None, None));

        let details = SourceSongDetails::from_scan(
            path,
            file_size,
            format.as_deref().map(|s| s.to_string()),
            bitrate,
            sample_rate,
            None, // bit_depth - old format doesn't have this
            None, // channels
            duration,
        );
        let source_song = SourceSong::new(
            source_id.clone(),
            "local_storage",
            &old_song.id.to_string(),
            details,
        );
        manager.insert(crate::modules::music_library::manager::ObjectEntry::SourceSong(source_song));

        // 创建 MasterSong
        let mut master = crate::modules::music_library::models::master_song::MasterSong::new(
            song_id.clone(),
            old_song.name.clone(),
            old_song.duration.map(|d| (d * 1000.0) as u64),
            artist_refs.clone(),
            album_ref.clone(),
        );
        master.add_trace(crate::modules::music_library::models::trace_link::TraceLink::new(
            "local_storage",
            source_id.as_str(),
        ));

        // 建立反向引用
        for artist_ref in &artist_refs {
            if let Ok(aid) = ObjectId::from_string(artist_ref) {
                if let Some(entry) = manager.get_mut(&aid) {
                    if let crate::modules::music_library::manager::ObjectEntry::MasterArtist(ref mut artist) = entry {
                        artist.add_song(song_id.as_str().to_string());
                        if let Some(ref alb) = album_ref {
                            artist.add_album(alb.clone());
                        }
                    }
                }
            }
        }

        if let Some(ref alb_ref) = album_ref {
            if let Ok(aid) = ObjectId::from_string(alb_ref) {
                if let Some(entry) = manager.get_mut(&aid) {
                    if let crate::modules::music_library::manager::ObjectEntry::MasterAlbum(ref mut album) = entry {
                        album.add_song(song_id.as_str().to_string());
                    }
                }
            }
        }

        manager.insert(crate::modules::music_library::manager::ObjectEntry::MasterSong(master));
    }

    Ok(manager)
}
