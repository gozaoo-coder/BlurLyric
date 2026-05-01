use crate::modules::music_library::object_id::ObjectId;
use crate::modules::music_library::object_status::ObjectStatus;
use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub enum ObjectKind {
    MasterSong,
    MasterAlbum,
    MasterArtist,
    SourceSong,
    SourceAlbum,
    SourceArtist,
}

pub trait MusicObject: std::fmt::Debug {
    fn id(&self) -> &ObjectId;
    fn kind(&self) -> ObjectKind;
    fn status(&self) -> ObjectStatus;
    fn name(&self) -> &str;
}
