use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AudioFormat {
    MP3,
    FLAC,
    OGG,
    WAV,
    AAC,
    M4A,
    WMA,
    #[serde(rename = "unknown")]
    Unknown,
}

impl fmt::Display for AudioFormat {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AudioFormat::MP3 => write!(f, "mp3"),
            AudioFormat::FLAC => write!(f, "flac"),
            AudioFormat::OGG => write!(f, "ogg"),
            AudioFormat::WAV => write!(f, "wav"),
            AudioFormat::AAC => write!(f, "aac"),
            AudioFormat::M4A => write!(f, "m4a"),
            AudioFormat::WMA => write!(f, "wma"),
            AudioFormat::Unknown => write!(f, "unknown"),
        }
    }
}

impl AudioFormat {
    pub fn from_extension(ext: &str) -> Self {
        match ext.to_lowercase().as_str() {
            "mp3" => AudioFormat::MP3,
            "flac" => AudioFormat::FLAC,
            "ogg" => AudioFormat::OGG,
            "wav" => AudioFormat::WAV,
            "aac" => AudioFormat::AAC,
            "m4a" => AudioFormat::M4A,
            "wma" => AudioFormat::WMA,
            _ => AudioFormat::Unknown,
        }
    }

    pub fn extension(&self) -> &'static str {
        match self {
            AudioFormat::MP3 => "mp3",
            AudioFormat::FLAC => "flac",
            AudioFormat::OGG => "ogg",
            AudioFormat::WAV => "wav",
            AudioFormat::AAC => "aac",
            AudioFormat::M4A => "m4a",
            AudioFormat::WMA => "wma",
            AudioFormat::Unknown => "",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MetadataStandard {
    Id3v1,
    Id3v2,
    VorbisComment,
    Ape,
    Mp4,
    Asf,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioFileInfo {
    pub path: String,
    pub format: AudioFormat,
    pub size: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modified_time: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawMetadataEntry {
    pub key: String,
    pub value: String,
    pub standard: MetadataStandard,
}
