use serde::{Deserialize, Serialize};
use crate::modules::music_library::object_id::ObjectId;
use crate::modules::music_library::object_status::ObjectStatus;
use super::music_object::{MusicObject, ObjectKind};

impl MusicObject for SourceAlbum {
    fn id(&self) -> &ObjectId { &self.id }
    fn kind(&self) -> ObjectKind { ObjectKind::SourceAlbum }
    fn status(&self) -> ObjectStatus { ObjectStatus::Active }
    fn name(&self) -> &str { "" }
}

/// 来源实体：代表某个来源中的一张专辑
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceAlbum {
    pub id: ObjectId,
    #[serde(rename = "type")]
    pub type_: String,
    pub source_id: String,
    pub external_id: String,
    pub master_ref: Option<String>,
    pub details: SourceAlbumDetails,
}

impl SourceAlbum {
    pub fn new(
        id: ObjectId,
        source_id: impl Into<String>,
        external_id: impl Into<String>,
        details: SourceAlbumDetails,
    ) -> Self {
        SourceAlbum {
            id,
            type_: "source_album".to_string(),
            source_id: source_id.into(),
            external_id: external_id.into(),
            master_ref: None,
            details,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceAlbumDetails {
    pub path: Option<String>,
    pub song_count: Option<u32>,
    pub year: Option<i32>,
    pub pic_url: Option<String>,
}
