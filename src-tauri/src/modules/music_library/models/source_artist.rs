use serde::{Deserialize, Serialize};
use crate::modules::music_library::object_id::ObjectId;
use crate::modules::music_library::object_status::ObjectStatus;
use super::music_object::{MusicObject, ObjectKind};

impl MusicObject for SourceArtist {
    fn id(&self) -> &ObjectId { &self.id }
    fn kind(&self) -> ObjectKind { ObjectKind::SourceArtist }
    fn status(&self) -> ObjectStatus { ObjectStatus::Active }
    fn name(&self) -> &str { "" }
}

/// 来源实体：代表某个来源中的一位艺术家
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceArtist {
    pub id: ObjectId,
    #[serde(rename = "type")]
    pub type_: String,
    pub source_id: String,
    pub external_id: String,
    pub master_ref: Option<String>,
    pub details: SourceArtistDetails,
}

impl SourceArtist {
    pub fn new(
        id: ObjectId,
        source_id: impl Into<String>,
        external_id: impl Into<String>,
        details: SourceArtistDetails,
    ) -> Self {
        SourceArtist {
            id,
            type_: "source_artist".to_string(),
            source_id: source_id.into(),
            external_id: external_id.into(),
            master_ref: None,
            details,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceArtistDetails {
    pub alias: Vec<String>,
}
