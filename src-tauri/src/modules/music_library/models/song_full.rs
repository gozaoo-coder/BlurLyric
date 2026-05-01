use serde::Serialize;
use super::master_song::MasterSong;
use super::master_album::MasterAlbum;
use super::master_artist::MasterArtist;
use super::trace_link::TraceLink;
use super::source_song::SourceSong;

/// 完整歌曲信息（装配结果）
#[derive(Debug, Clone, Serialize)]
pub struct SongFull {
    pub song: MasterSong,
    pub album: Option<MasterAlbum>,
    pub artists: Vec<MasterArtist>,
    pub sources: Vec<(TraceLink, SourceSong)>,
}

/// 完整专辑信息（装配结果）
#[derive(Debug, Clone, Serialize)]
pub struct AlbumFull {
    pub album: MasterAlbum,
    pub artists: Vec<MasterArtist>,
    pub songs: Vec<SongFull>,
}

/// 完整艺术家信息（装配结果）
#[derive(Debug, Clone, Serialize)]
pub struct ArtistFull {
    pub artist: MasterArtist,
    pub albums: Vec<MasterAlbum>,
    pub songs: Vec<SongFull>,
}
