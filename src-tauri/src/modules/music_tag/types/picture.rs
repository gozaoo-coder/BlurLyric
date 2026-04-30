use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum PictureType {
    Other = 0x00,
    FileIcon = 0x01,
    OtherFileIcon = 0x02,
    FrontCover = 0x03,
    BackCover = 0x04,
    LeafletPage = 0x05,
    Media = 0x06,
    LeadArtist = 0x07,
    Artist = 0x08,
    Conductor = 0x09,
    Band = 0x0A,
    Composer = 0x0B,
    Lyricist = 0x0C,
    RecordingLocation = 0x0D,
    DuringRecording = 0x0E,
    DuringPerformance = 0x0F,
    VideoScreenCapture = 0x10,
    Fish = 0x11,
    Illustration = 0x12,
    BandLogotype = 0x13,
    PublisherLogotype = 0x14,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Picture {
    pub mime_type: String,
    pub picture_type: PictureType,
    pub description: String,
    pub data: Vec<u8>,
}
