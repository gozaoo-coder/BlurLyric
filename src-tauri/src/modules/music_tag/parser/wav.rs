use std::path::Path;
use crate::modules::music_tag::types::*;
use crate::modules::music_tag::error::*;
use super::{MetadataParser, read_head};

impl MetadataParser {
    /// WAV 仅需读取文件头 12 字节验证 RIFF/WAVE 格式
    pub(super) fn parse_wav(&self, path: &Path) -> Result<MusicMetadata> {
        let data = read_head(path, 12)?;

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
