mod id3;
mod flac;
mod ogg;
mod wav;
mod symphonia;

use std::path::{Path, PathBuf};
use crate::modules::music_tag::types::*;
use crate::modules::music_tag::error::*;

#[derive(Debug)]
pub struct MetadataParser {
    config: MusicTagConfig,
}

impl MetadataParser {
    pub fn new() -> Self {
        Self {
            config: MusicTagConfig::default(),
        }
    }

    pub fn with_config(config: MusicTagConfig) -> Self {
        Self { config }
    }

    pub fn detect_format<P: AsRef<Path>>(path: P) -> Option<AudioFormat> {
        let path = path.as_ref();
        let ext = path.extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");
        let format = AudioFormat::from_extension(ext);
        if format == AudioFormat::Unknown {
            None
        } else {
            Some(format)
        }
    }

    pub fn is_supported_format<P: AsRef<Path>>(path: P) -> bool {
        Self::detect_format(path).is_some()
    }

    pub fn parse<P: AsRef<Path>>(&self, path: P) -> Result<MusicMetadata> {
        let path = path.as_ref();

        if !path.exists() {
            return Err(file_not_found(path));
        }

        let format = Self::detect_format(path)
            .ok_or_else(|| unsupported_format(
                path,
                path.extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("unknown"),
            ))?;

        let mut metadata = match format {
            AudioFormat::MP3 => self.parse_mp3(path),
            AudioFormat::FLAC => self.parse_flac(path),
            AudioFormat::OGG => self.parse_ogg(path),
            AudioFormat::WAV => self.parse_wav(path),
            _ => Err(unsupported_format(path, format.to_string())),
        }?;

        let (duration, bitrate, sample_rate, channels) = self.parse_audio_properties(path);
        metadata.duration = duration;
        metadata.bitrate = bitrate;
        metadata.sample_rate = sample_rate;
        metadata.channels = channels;

        Ok(metadata)
    }

    pub fn read_file_info<P: AsRef<Path>>(&self, path: P) -> Result<AudioFileInfo> {
        let path = path.as_ref();

        if !path.exists() {
            return Err(file_not_found(path));
        }

        let metadata = std::fs::metadata(path)
            .map_err(|e| io_error(path, e.to_string()))?;

        let format = Self::detect_format(path)
            .ok_or_else(|| unsupported_format(path, "unknown"))?;

        Ok(AudioFileInfo {
            path: path.to_string_lossy().to_string(),
            format,
            size: metadata.len(),
            modified_time: metadata.modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs()),
        })
    }
}

impl Default for MetadataParser {
    fn default() -> Self {
        Self::new()
    }
}
