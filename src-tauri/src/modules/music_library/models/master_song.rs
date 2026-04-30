use serde::{Deserialize, Serialize};
use crate::modules::music_library::object_id::ObjectId;
use crate::modules::music_library::object_status::ObjectStatus;
use super::music_object::{MusicObject, ObjectKind};
use super::trace_link::TraceLink;

impl MusicObject for MasterSong {
    fn id(&self) -> &ObjectId { &self.id }
    fn kind(&self) -> ObjectKind { ObjectKind::MasterSong }
    fn status(&self) -> ObjectStatus { self.status.clone() }
    fn name(&self) -> &str { &self.name }
}

/// 聚合实体：代表一首歌的逻辑实体，聚合多个来源的 SourceRecord
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MasterSong {
    pub id: ObjectId,
    #[serde(rename = "type")]
    pub type_: String,
    pub status: ObjectStatus,
    pub name: String,
    pub duration_ms: Option<u64>,
    /// 关联的 MasterArtist ID 列表
    pub artist_refs: Vec<String>,
    /// 关联的 MasterAlbum ID
    pub album_ref: Option<String>,
    /// 来源关联记录
    pub traces: Vec<TraceLink>,
}

impl MasterSong {
    pub fn new(
        id: ObjectId,
        name: String,
        duration_ms: Option<u64>,
        artist_refs: Vec<String>,
        album_ref: Option<String>,
    ) -> Self {
        MasterSong {
            id,
            type_: "master_song".to_string(),
            status: ObjectStatus::Active,
            name,
            duration_ms,
            artist_refs,
            album_ref,
            traces: Vec::new(),
        }
    }

    pub fn add_trace(&mut self, trace: TraceLink) {
        self.traces.push(trace);
    }

    pub fn remove_trace(&mut self, source_id: &str, record_id: &str) {
        self.traces.retain(|t| t.source_id != source_id || t.record_id != record_id);
    }
}
