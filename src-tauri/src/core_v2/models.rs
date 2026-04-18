use serde::{Deserialize, Serialize};
use std::time::Duration;

use super::quality::Quality;

pub type SongID = String;
pub type AlbumID = String;
pub type ArtistID = String;
pub type SourceID = String;
pub type ObjectID = String;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum SourceType {
    StorageSource,
    APISource,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectInfo {
    #[serde(rename = "type")]
    pub object_type: String,
    pub id: ObjectID,
    pub details: Option<Details>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "sourceType")]
pub enum Details {
    StorageSong {
        path: String,
        size: u64,
        quality: Quality,
        fingerprint: Option<String>,
    },
    StorageAlbum {
        path: String,
    },
    APISong {
        api_endpoint: String,
        size: u64,
        quality: Quality,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trace {
    pub source_type: SourceType,
    pub source_id: SourceID,
    pub object_info: ObjectInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Artist {
    pub id: ArtistID,
    pub name: String,
    #[serde(default)]
    pub album_ids: Vec<AlbumID>,
    #[serde(default)]
    pub song_ids: Vec<SongID>,
    #[serde(default)]
    pub traces: Vec<Trace>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Album {
    pub id: AlbumID,
    pub name: String,
    #[serde(default)]
    pub artist_ids: Vec<ArtistID>,
    #[serde(default)]
    pub song_ids: Vec<SongID>,
    #[serde(default)]
    pub traces: Vec<Trace>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Song {
    pub id: SongID,
    pub name: String,
    #[serde(default)]
    pub artist_ids: Vec<ArtistID>,
    pub album_id: Option<AlbumID>,
    #[serde(default)]
    pub traces: Vec<Trace>,
    #[serde(with = "duration_serde", default)]
    pub duration: Option<Duration>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SongWithRelations {
    pub song: Song,
    pub artists: Vec<Artist>,
    pub album: Option<Album>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlbumWithRelations {
    pub album: Album,
    pub artists: Vec<Artist>,
    pub songs: Vec<Song>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtistWithRelations {
    pub artist: Artist,
    pub albums: Vec<Album>,
    pub songs: Vec<Song>,
}

mod duration_serde {
    use serde::{Deserialize, Deserializer, Serialize, Serializer};
    use std::time::Duration;

    pub fn serialize<S>(duration: &Option<Duration>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        duration.map(|d| d.as_secs_f64()).serialize(serializer)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Option<Duration>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let secs = Option::<f64>::deserialize(deserializer)?;
        Ok(secs.map(Duration::from_secs_f64))
    }
}
