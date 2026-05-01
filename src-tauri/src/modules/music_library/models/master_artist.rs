use serde::{Deserialize, Serialize};
use crate::modules::music_library::object_id::ObjectId;
use crate::modules::music_library::object_status::ObjectStatus;
use super::music_object::{MusicObject, ObjectKind};
use super::trace_link::TraceLink;

impl MusicObject for MasterArtist {
    fn id(&self) -> &ObjectId { &self.id }
    fn kind(&self) -> ObjectKind { ObjectKind::MasterArtist }
    fn status(&self) -> ObjectStatus { self.status.clone() }
    fn name(&self) -> &str { &self.name }
}

/// 聚合实体：代表一位艺术家的逻辑实体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MasterArtist {
    pub id: ObjectId,
    #[serde(rename = "type")]
    pub type_: String,
    pub status: ObjectStatus,
    pub name: String,
    /// 关联的 MasterAlbum ID 列表
    pub album_refs: Vec<String>,
    /// 关联的 MasterSong ID 列表
    pub song_refs: Vec<String>,
    /// 来源关联记录
    pub traces: Vec<TraceLink>,
}

impl MasterArtist {
    pub fn new(id: ObjectId, name: String) -> Self {
        MasterArtist {
            id,
            type_: "master_artist".to_string(),
            status: ObjectStatus::Active,
            name,
            album_refs: Vec::new(),
            song_refs: Vec::new(),
            traces: Vec::new(),
        }
    }

    pub fn add_song(&mut self, song_id: String) {
        if !self.song_refs.contains(&song_id) {
            self.song_refs.push(song_id);
        }
    }

    pub fn add_album(&mut self, album_id: String) {
        if !self.album_refs.contains(&album_id) {
            self.album_refs.push(album_id);
        }
    }

    pub fn add_trace(&mut self, trace: TraceLink) {
        self.traces.push(trace);
    }

    pub fn remove_trace(&mut self, source_id: &str, record_id: &str) {
        self.traces.retain(|t| t.source_id != source_id || t.record_id != record_id);
    }
}
