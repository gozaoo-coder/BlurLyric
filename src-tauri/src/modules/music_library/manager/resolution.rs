use crate::modules::music_library::object_id::ObjectId;
use crate::modules::music_library::models::master_album::MasterAlbum;
use crate::modules::music_library::models::master_artist::MasterArtist;
use crate::modules::music_library::models::source_song::SourceSong;
use crate::modules::music_library::models::trace_link::TraceLink;
use crate::modules::music_library::models::song_full::{SongFull, AlbumFull, ArtistFull};
use crate::modules::music_library::manager::MusicStorageSourceLibraryManager;
use crate::modules::music_library::manager::ObjectEntry;

impl MusicStorageSourceLibraryManager {
    /// 装配完整歌曲信息
    pub fn resolve_song_full(&self, master_id: &ObjectId) -> Option<SongFull> {
        let entry = self.objects.get(master_id)?;
        let master_song = match entry {
            ObjectEntry::MasterSong(s) => s.clone(),
            _ => return None,
        };

        // 解析 Album
        let album = master_song.album_ref.as_ref().and_then(|album_id_str| {
            ObjectId::from_string(album_id_str).ok()
                .and_then(|id| self.objects.get(&id))
                .and_then(|entry| match entry {
                    ObjectEntry::MasterAlbum(a) => Some(a.clone()),
                    _ => None,
                })
        });

        // 解析 Artists
        let artists: Vec<MasterArtist> = master_song.artist_refs.iter()
            .filter_map(|ref_str| {
                ObjectId::from_string(ref_str).ok()
                    .and_then(|id| self.objects.get(&id))
                    .and_then(|entry| match entry {
                        ObjectEntry::MasterArtist(a) => Some(a.clone()),
                        _ => None,
                    })
            })
            .collect();

        // 解析 Sources（通过 TraceLink -> SourceSong）
        let sources: Vec<(TraceLink, SourceSong)> = master_song.traces.iter()
            .filter_map(|trace| {
                ObjectId::from_string(&trace.record_id).ok()
                    .and_then(|id| self.objects.get(&id))
                    .and_then(|entry| match entry {
                        ObjectEntry::SourceSong(s) => Some((trace.clone(), s.clone())),
                        _ => None,
                    })
            })
            .collect();

        // 过滤掉没有可用音源的歌曲
        if sources.is_empty() {
            return None;
        }

        Some(SongFull {
            song: master_song,
            album,
            artists,
            sources,
        })
    }

    /// 装配所有歌曲
    pub fn resolve_all_songs(&self) -> Vec<SongFull> {
        let master_ids: Vec<ObjectId> = self.all_master_songs().iter()
            .map(|s| s.id.clone())
            .collect();

        master_ids.iter()
            .filter_map(|id| self.resolve_song_full(id))
            .collect()
    }

    /// 装配完整专辑信息
    pub fn resolve_album_full(&self, album_id: &ObjectId) -> Option<AlbumFull> {
        let entry = self.objects.get(album_id)?;
        let master_album = match entry {
            ObjectEntry::MasterAlbum(a) => a.clone(),
            _ => return None,
        };

        let artists: Vec<MasterArtist> = master_album.artist_refs.iter()
            .filter_map(|ref_str| {
                ObjectId::from_string(ref_str).ok()
                    .and_then(|id| self.objects.get(&id))
                    .and_then(|entry| match entry {
                        ObjectEntry::MasterArtist(a) => Some(a.clone()),
                        _ => None,
                    })
            })
            .collect();

        let songs: Vec<SongFull> = master_album.song_refs.iter()
            .filter_map(|song_id_str| {
                ObjectId::from_string(song_id_str).ok()
                    .and_then(|id| self.resolve_song_full(&id))
            })
            .collect();

        // 过滤掉没有歌曲的专辑
        if songs.is_empty() {
            return None;
        }

        Some(AlbumFull {
            album: master_album,
            artists,
            songs,
        })
    }

    /// 装配所有专辑
    pub fn resolve_all_albums(&self) -> Vec<AlbumFull> {
        let album_ids: Vec<ObjectId> = self.all_master_albums().iter()
            .map(|a| a.id.clone())
            .collect();

        album_ids.iter()
            .filter_map(|id| self.resolve_album_full(id))
            .collect()
    }

    /// 装配完整艺术家信息
    pub fn resolve_artist_full(&self, artist_id: &ObjectId) -> Option<ArtistFull> {
        let entry = self.objects.get(artist_id)?;
        let master_artist = match entry {
            ObjectEntry::MasterArtist(a) => a.clone(),
            _ => return None,
        };

        let albums: Vec<MasterAlbum> = master_artist.album_refs.iter()
            .filter_map(|ref_str| {
                ObjectId::from_string(ref_str).ok()
                    .and_then(|id| self.objects.get(&id))
                    .and_then(|entry| match entry {
                        ObjectEntry::MasterAlbum(a) => Some(a.clone()),
                        _ => None,
                    })
            })
            .collect();

        let songs: Vec<SongFull> = master_artist.song_refs.iter()
            .filter_map(|song_id_str| {
                ObjectId::from_string(song_id_str).ok()
                    .and_then(|id| self.resolve_song_full(&id))
            })
            .collect();

        // 过滤掉没有歌曲的艺术家
        if songs.is_empty() {
            return None;
        }

        Some(ArtistFull {
            artist: master_artist,
            albums,
            songs,
        })
    }

    /// 装配所有艺术家
    pub fn resolve_all_artists(&self) -> Vec<ArtistFull> {
        let artist_ids: Vec<ObjectId> = self.all_master_artists().iter()
            .map(|a| a.id.clone())
            .collect();

        artist_ids.iter()
            .filter_map(|id| self.resolve_artist_full(id))
            .collect()
    }
}
