use serde::{Deserialize, Serialize};
use crate::modules::music_library::object_id::ObjectId;
use crate::modules::music_library::object_status::ObjectStatus;
use crate::modules::music_library::quality::Quality;
use super::music_object::{MusicObject, ObjectKind};

impl MusicObject for SourceSong {
    fn id(&self) -> &ObjectId { &self.id }
    fn kind(&self) -> ObjectKind { ObjectKind::SourceSong }
    fn status(&self) -> ObjectStatus { ObjectStatus::Active }
    fn name(&self) -> &str { "" } // SourceSong 通过 master_ref 获取名称
}

/// 来源实体：代表某个来源（如本地文件、远程API）中的一首歌
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceSong {
    pub id: ObjectId,
    #[serde(rename = "type")]
    pub type_: String,
    pub source_id: String,
    pub external_id: String,
    pub master_ref: Option<String>,
    pub details: SourceSongDetails,
}

impl SourceSong {
    pub fn new(
        id: ObjectId,
        source_id: impl Into<String>,
        external_id: impl Into<String>,
        details: SourceSongDetails,
    ) -> Self {
        SourceSong {
            id,
            type_: "source_song".to_string(),
            source_id: source_id.into(),
            external_id: external_id.into(),
            master_ref: None,
            details,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceSongDetails {
    pub path: Option<String>,
    pub size: Option<u64>,
    pub format: Option<String>,
    pub bitrate: Option<u32>,
    pub sample_rate: Option<u32>,
    pub bit_depth: Option<u8>,
    pub channels: Option<u8>,
    pub duration: Option<f64>,
    pub quality: Quality,
}

impl SourceSongDetails {
    pub fn from_scan(
        path: Option<String>,
        size: Option<u64>,
        format: Option<String>,
        bitrate: Option<u32>,
        sample_rate: Option<u32>,
        bit_depth: Option<u8>,
        channels: Option<u8>,
        duration: Option<f64>,
    ) -> Self {
        let quality = Quality::from_media_info(
            format.as_deref(),
            sample_rate,
            bit_depth,
            bitrate,
        );
        SourceSongDetails {
            path,
            size,
            format,
            bitrate,
            sample_rate,
            bit_depth,
            channels,
            duration,
            quality,
        }
    }
}
