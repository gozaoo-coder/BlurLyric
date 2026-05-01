use std::path::Path;
use crate::modules::music_tag::types::*;
use crate::modules::music_tag::error::*;
use super::MetadataParser;

impl MetadataParser {
    pub(super) fn parse_ogg(&self, path: &Path) -> Result<MusicMetadata> {
        self.parse_flac(path)
    }
}
