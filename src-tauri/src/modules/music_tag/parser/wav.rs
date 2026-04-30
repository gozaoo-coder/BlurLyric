use std::path::Path;
use std::fs;
use crate::modules::music_tag::types::*;
use crate::modules::music_tag::error::*;
use super::MetadataParser;

impl MetadataParser {
    pub(super) fn parse_wav(&self, path: &Path) -> Result<MusicMetadata> {
        let data = fs::read(path)
            .map_err(|e| io_error(path, e.to_string()))?;

        if data.len() < 12 || &data[0..4] != b"RIFF" || &data[8..12] != b"WAVE" {
            return Err(parse_error(path, "无效的WAV文件"));
        }

        let title = path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Unknown")
            .to_string();

        Ok(MusicMetadata::new(
            title,
            vec![Artist::new("Unknown Artist")],
            Album::new("Unknown Album"),
        ))
    }
}
