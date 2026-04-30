use std::path::Path;
use std::collections::HashMap;
use crate::modules::music_tag::types::*;
use crate::modules::music_tag::error::*;
use super::{MetadataParser, read_head, PROGRESSIVE_SCAN_SIZE};

impl MetadataParser {
    /// 渐进式扫描 FLAC 元数据：先读头部 32KB，
    /// 若所有元数据块均在该范围内则直接解析；
    /// 否则回退到全量读取（罕见，如超大内嵌封面）。
    pub(super) fn parse_flac(&self, path: &Path) -> Result<MusicMetadata> {
        let head = read_head(path, PROGRESSIVE_SCAN_SIZE)?;

        if head.len() < 4 || &head[0..4] != b"fLaC" {
            return Err(parse_error(path, "无效的FLAC文件"));
        }

        // 快速预检：所有元数据块是否都在 32KB 范围内
        let mut pos = 4;
        let mut all_fit = true;
        'check: while pos < head.len() {
            if pos + 4 > head.len() { all_fit = false; break; }
            let is_last = (head[pos] & 0x80) != 0;
            let block_size = ((head[pos + 1] as usize) << 16)
                | ((head[pos + 2] as usize) << 8)
                | (head[pos + 3] as usize);
            pos += 4;
            if pos + block_size > head.len() { all_fit = false; break 'check; }
            pos += block_size;
            if is_last { break; }
        }

        if all_fit {
            self.parse_flac_data(&head, path)
        } else {
            // 元数据超出 32KB 回退到全量读取
            let full = std::fs::read(path)
                .map_err(|e| io_error(path, e.to_string()))?;
            self.parse_flac_data(&full, path)
        }
    }

    /// 从内存数据中解析 FLAC 元数据块
    fn parse_flac_data(&self, data: &[u8], path: &Path) -> Result<MusicMetadata> {
        let mut pos = 4;
        let mut comments: HashMap<String, String> = HashMap::new();
        let mut pictures: Vec<Picture> = Vec::new();

        while pos < data.len() {
            if pos + 4 > data.len() {
                break;
            }

            let block_header = data[pos];
            let is_last = (block_header & 0x80) != 0;
            let block_type = block_header & 0x7F;
            let block_size = ((data[pos + 1] as usize) << 16)
                | ((data[pos + 2] as usize) << 8)
                | (data[pos + 3] as usize);

            pos += 4;

            if pos + block_size > data.len() {
                break;
            }

            match block_type {
                4 => {
                    if let Some((c, pics)) = self.parse_vorbis_comment(&data[pos..pos + block_size]) {
                        comments = c;
                        if let Some(p) = pics {
                            pictures = p;
                        }
                    }
                }
                6 => {
                    if let Some(picture) = self.parse_flac_picture(&data[pos..pos + block_size]) {
                        pictures.push(picture);
                    }
                }
                _ => {}
            }

            pos += block_size;

            if is_last {
                break;
            }
        }

        let title = comments.get("TITLE")
            .cloned()
            .unwrap_or_else(|| {
                path.file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("Unknown")
                    .to_string()
            });

        let artists: Vec<Artist> = comments.get("ARTIST")
            .map(|a| a.split(&['/', ';'][..])
                .map(|s| Artist::new(s.trim()))
                .collect())
            .unwrap_or_else(|| vec![Artist::new("Unknown Artist")]);

        let album_name = comments.get("ALBUM")
            .cloned()
            .unwrap_or_else(|| "Unknown Album".to_string());

        let mut metadata = MusicMetadata::new(title, artists, Album::new(album_name));

        if let Some(album_artist) = comments.get("ALBUMARTIST") {
            metadata.album.artist = Some(album_artist.clone());
        }

        if let Some(track) = comments.get("TRACKNUMBER") {
            metadata.track_number = track.parse().ok();
        }

        if let Some(total_tracks) = comments.get("TRACKTOTAL") {
            metadata.total_tracks = total_tracks.parse().ok();
        }

        if let Some(disc) = comments.get("DISCNUMBER") {
            metadata.disc_number = disc.parse().ok();
        }

        if let Some(total_discs) = comments.get("DISCTOTAL") {
            metadata.total_discs = total_discs.parse().ok();
        }

        if let Some(year) = comments.get("DATE") {
            metadata.year = year.parse().ok();
        }

        if let Some(genre) = comments.get("GENRE") {
            metadata.genre = Some(genre.clone());
        }

        if let Some(comment) = comments.get("COMMENT") {
            metadata.comment = Some(comment.clone());
        }

        if let Some(composer) = comments.get("COMPOSER") {
            metadata.composer = Some(composer.clone());
        }

        if let Some(lyricist) = comments.get("LYRICIST") {
            metadata.lyricist = Some(lyricist.clone());
        }

        if let Some(lyrics) = comments.get("LYRICS") {
            metadata.lyrics = Some(Lyrics {
                content: lyrics.clone(),
                language: None,
                description: None,
            });
        }

        if !pictures.is_empty() {
            metadata.pictures = Some(pictures);
        }

        Ok(metadata)
    }

    fn parse_vorbis_comment(&self, data: &[u8]) -> Option<(std::collections::HashMap<String, String>, Option<Vec<Picture>>)> {
        let mut pos = 0;
        let mut comments = std::collections::HashMap::new();

        if pos + 4 > data.len() {
            return None;
        }
        let vendor_len = u32::from_le_bytes([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]) as usize;
        pos += 4;

        if pos + vendor_len > data.len() {
            return None;
        }
        pos += vendor_len;

        if pos + 4 > data.len() {
            return None;
        }
        let comment_count = u32::from_le_bytes([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]) as usize;
        pos += 4;

        for _ in 0..comment_count {
            if pos + 4 > data.len() {
                break;
            }
            let comment_len = u32::from_le_bytes([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]) as usize;
            pos += 4;

            if pos + comment_len > data.len() {
                break;
            }

            let comment = String::from_utf8_lossy(&data[pos..pos + comment_len]);
            pos += comment_len;

            if let Some(eq_pos) = comment.find('=') {
                let field = comment[..eq_pos].to_uppercase();
                let value = comment[eq_pos + 1..].to_string();
                comments.insert(field, value);
            }
        }

        Some((comments, None))
    }

    fn parse_flac_picture(&self, data: &[u8]) -> Option<Picture> {
        if data.len() < 8 {
            return None;
        }

        let mut pos = 0;

        let _picture_type = u32::from_be_bytes([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]) as u8;
        pos += 4;

        let mime_len = u32::from_be_bytes([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]) as usize;
        pos += 4;

        if pos + mime_len > data.len() {
            return None;
        }

        let mime_type = String::from_utf8_lossy(&data[pos..pos + mime_len]).to_string();
        pos += mime_len;

        if pos + 4 > data.len() {
            return None;
        }

        let _desc_len = u32::from_be_bytes([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]) as usize;
        pos += 4;

        if pos + _desc_len > data.len() {
            return None;
        }

        pos += _desc_len;

        if pos + 16 > data.len() {
            return None;
        }

        pos += 16;

        if pos + 4 > data.len() {
            return None;
        }

        let data_len = u32::from_be_bytes([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]) as usize;
        pos += 4;

        if pos + data_len > data.len() {
            return None;
        }

        let picture_data = data[pos..pos + data_len].to_vec();

        Some(Picture {
            mime_type,
            picture_type: crate::modules::music_tag::types::PictureType::FrontCover,
            description: String::new(),
            data: picture_data,
        })
    }
}
