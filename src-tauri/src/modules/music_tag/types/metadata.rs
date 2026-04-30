use serde::{Deserialize, Serialize};
use super::artist::Artist;
use super::album::Album;
use super::picture::Picture;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Lyrics {
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MusicMetadata {
    pub title: String,
    pub artists: Vec<Artist>,
    pub album: Album,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub track_number: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_tracks: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disc_number: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_discs: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub year: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub genre: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lyrics: Option<Lyrics>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub composer: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lyricist: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pictures: Option<Vec<Picture>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bitrate: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sample_rate: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channels: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub other_tags: Option<std::collections::HashMap<String, String>>,
}

impl MusicMetadata {
    pub fn new(title: impl Into<String>, artists: Vec<Artist>, album: Album) -> Self {
        Self {
            title: title.into(),
            artists,
            album,
            track_number: None,
            total_tracks: None,
            disc_number: None,
            total_discs: None,
            year: None,
            genre: None,
            lyrics: None,
            comment: None,
            composer: None,
            lyricist: None,
            pictures: None,
            duration: None,
            bitrate: None,
            sample_rate: None,
            channels: None,
            other_tags: None,
        }
    }

    pub fn front_cover(&self) -> Option<&Picture> {
        self.pictures.as_ref()?.iter()
            .find(|p| p.picture_type == super::picture::PictureType::FrontCover)
            .or_else(|| self.pictures.as_ref()?.first())
    }

    pub fn artists_string(&self) -> String {
        self.artists.iter()
            .map(|a| a.name.as_str())
            .collect::<Vec<_>>()
            .join(", ")
    }

    pub fn has_cover(&self) -> bool {
        self.pictures.as_ref()
            .map(|p| !p.is_empty())
            .unwrap_or(false)
    }
}
