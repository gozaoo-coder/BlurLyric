use std::path::Path;
use std::fs;
use crate::modules::music_tag::types::*;
use crate::modules::music_tag::error::*;
use super::MetadataParser;

impl MetadataParser {
    pub(super) fn parse_mp3(&self, path: &Path) -> Result<MusicMetadata> {
        let data = fs::read(path)
            .map_err(|e| io_error(path, e.to_string()))?;

        if let Some(metadata) = self.parse_id3v2(&data, path) {
            return Ok(metadata);
        }

        if let Some(metadata) = self.parse_id3v1(&data, path) {
            return Ok(metadata);
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

    fn parse_id3v2(&self, data: &[u8], path: &Path) -> Option<MusicMetadata> {
        if data.len() < 10 || &data[0..3] != b"ID3" {
            return None;
        }

        let version = data[3];
        let _revision = data[4];
        let _flags = data[5];

        let size = ((data[6] as usize) << 21)
            | ((data[7] as usize) << 14)
            | ((data[8] as usize) << 7)
            | (data[9] as usize);

        if size > data.len() - 10 {
            return None;
        }

        let mut metadata = MusicMetadata::new(
            String::new(),
            Vec::new(),
            Album::new(String::new()),
        );

        let mut pos = 10;
        let end = 10 + size;

        while pos + 10 <= end {
            let frame_id = std::str::from_utf8(&data[pos..pos + 4]).ok()?;
            let frame_size = self.read_frame_size(&data[pos + 4..pos + 8], version);
            let _frame_flags = u16::from_be_bytes([data[pos + 8], data[pos + 9]]);

            if frame_id == "\0\0\0\0" {
                break;
            }

            if pos + 10 + frame_size > end {
                break;
            }

            let frame_data = &data[pos + 10..pos + 10 + frame_size];
            self.parse_id3v2_frame(frame_id, frame_data, &mut metadata);

            pos += 10 + frame_size;
        }

        if metadata.title.is_empty() {
            metadata.title = path.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Unknown")
                .to_string();
        }

        if metadata.artists.is_empty() {
            metadata.artists.push(Artist::new("Unknown Artist"));
        }

        if metadata.album.name.is_empty() {
            metadata.album.name = "Unknown Album".to_string();
        }

        Some(metadata)
    }

    fn read_frame_size(&self, bytes: &[u8], version: u8) -> usize {
        if version >= 4 {
            ((bytes[0] as usize) << 21)
                | ((bytes[1] as usize) << 14)
                | ((bytes[2] as usize) << 7)
                | (bytes[3] as usize)
        } else {
            u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) as usize
        }
    }

    fn parse_id3v2_frame(&self, frame_id: &str, data: &[u8], metadata: &mut MusicMetadata) {
        if data.is_empty() {
            return;
        }

        let encoding = data[0];
        let text = if encoding == 0 {
            String::from_utf8_lossy(&data[1..]).to_string()
        } else if encoding == 1 || encoding == 2 {
            self.decode_utf16(&data[1..])
        } else if encoding == 3 {
            String::from_utf8_lossy(&data[1..]).to_string()
        } else {
            String::from_utf8_lossy(data).to_string()
        };

        match frame_id {
            "TIT2" => metadata.title = text,
            "TPE1" => {
                let artists: Vec<Artist> = text.split(&['/', '\0'][..])
                    .filter(|s| !s.is_empty())
                    .map(|s| Artist::new(s.trim()))
                    .collect();
                if !artists.is_empty() {
                    metadata.artists = artists;
                }
            }
            "TALB" => metadata.album.name = text,
            "TPE2" => metadata.album.artist = Some(text),
            "TRCK" => {
                if let Some(idx) = text.find('/') {
                    metadata.track_number = text[..idx].parse().ok();
                    metadata.total_tracks = text[idx + 1..].parse().ok();
                } else {
                    metadata.track_number = text.parse().ok();
                }
            }
            "TPOS" => {
                if let Some(idx) = text.find('/') {
                    metadata.disc_number = text[..idx].parse().ok();
                    metadata.total_discs = text[idx + 1..].parse().ok();
                } else {
                    metadata.disc_number = text.parse().ok();
                }
            }
            "TYER" | "TDRC" => metadata.year = text.parse().ok(),
            "TCON" => metadata.genre = Some(text),
            "COMM" => metadata.comment = Some(text),
            "TCOM" => metadata.composer = Some(text),
            "TEXT" => metadata.lyricist = Some(text),
            "USLT" => {
                if data.len() > 4 {
                    let lang = String::from_utf8_lossy(&data[1..4]).to_string();
                    let content = if data[4] == 3 {
                        String::from_utf8_lossy(&data[5..]).to_string()
                    } else {
                        String::from_utf8_lossy(&data[4..]).to_string()
                    };
                    metadata.lyrics = Some(Lyrics {
                        content,
                        language: Some(lang),
                        description: None,
                    });
                }
            }
            "APIC" => {
                if let Some(picture) = self.parse_apic_frame(data) {
                    metadata.pictures.get_or_insert_with(Vec::new).push(picture);
                }
            }
            _ => {
                if frame_id.starts_with('T') && !text.is_empty() {
                    metadata.other_tags
                        .get_or_insert_with(std::collections::HashMap::new)
                        .insert(frame_id.to_string(), text);
                }
            }
        }
    }

    fn decode_utf16(&self, data: &[u8]) -> String {
        if data.len() < 2 {
            return String::new();
        }

        let (is_be, start) = if data[0] == 0xFE && data[1] == 0xFF {
            (true, 2)
        } else if data[0] == 0xFF && data[1] == 0xFE {
            (false, 2)
        } else {
            (false, 0)
        };

        let u16_data: Vec<u16> = if is_be {
            data[start..]
                .chunks_exact(2)
                .map(|chunk| u16::from_be_bytes([chunk[0], chunk[1]]))
                .collect()
        } else {
            data[start..]
                .chunks_exact(2)
                .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
                .collect()
        };

        String::from_utf16_lossy(&u16_data)
    }

    fn parse_apic_frame(&self, data: &[u8]) -> Option<Picture> {
        if data.is_empty() {
            return None;
        }

        let encoding = data[0];
        let mut pos = 1;

        let mime_type = if encoding == 0 || encoding == 3 {
            let end = data[pos..].iter().position(|&b| b == 0)?;
            let mime = String::from_utf8_lossy(&data[pos..pos + end]).to_string();
            pos += end + 1;
            mime
        } else {
            pos += 2;
            let end = data[pos..].chunks_exact(2).position(|chunk| chunk == [0, 0])?;
            let mime_bytes: Vec<u8> = data[pos..pos + end * 2].to_vec();
            pos += end * 2 + 2;
            String::from_utf8_lossy(&mime_bytes).to_string()
        };

        if pos >= data.len() {
            return None;
        }

        let picture_type = data[pos];
        pos += 1;

        let _description = if encoding == 0 || encoding == 3 {
            let end = data[pos..].iter().position(|&b| b == 0)?;
            let desc = String::from_utf8_lossy(&data[pos..pos + end]).to_string();
            pos += end + 1;
            desc
        } else {
            pos += 2;
            let end = data[pos..].chunks_exact(2).position(|chunk| chunk == [0, 0])?;
            let desc_bytes: Vec<u8> = data[pos..pos + end * 2].to_vec();
            pos += end * 2 + 2;
            String::from_utf8_lossy(&desc_bytes).to_string()
        };

        let picture_data = data[pos..].to_vec();

        Some(Picture {
            mime_type,
            picture_type: unsafe { std::mem::transmute(picture_type) },
            description: String::new(),
            data: picture_data,
        })
    }

    fn parse_id3v1(&self, data: &[u8], path: &Path) -> Option<MusicMetadata> {
        if data.len() < 128 {
            return None;
        }

        let start = data.len() - 128;

        if &data[start..start + 3] != b"TAG" {
            return None;
        }

        let read_string = |offset: usize, len: usize| -> String {
            let bytes = &data[start + offset..start + offset + len];
            let trimmed: Vec<u8> = bytes.iter()
                .take_while(|&&b| b != 0)
                .copied()
                .collect();
            String::from_utf8_lossy(&trimmed).to_string()
        };

        let title = read_string(3, 30);
        let artist = read_string(33, 30);
        let album = read_string(63, 30);
        let year = read_string(93, 4);
        let comment = read_string(97, 30);
        let track = data[start + 126];
        let _genre = data[start + 127];

        let mut metadata = MusicMetadata::new(
            if title.is_empty() {
                path.file_stem()?.to_str()?.to_string()
            } else {
                title
            },
            vec![Artist::new(if artist.is_empty() { "Unknown Artist" } else { &artist })],
            Album::new(if album.is_empty() { "Unknown Album" } else { &album }),
        );

        if let Ok(y) = year.parse::<u32>() {
            metadata.year = Some(y);
        }

        if track > 0 {
            metadata.track_number = Some(track as u16);
        }

        if !comment.is_empty() {
            metadata.comment = Some(comment);
        }

        let _genre_name = match _genre {
            0 => "Blues",
            1 => "Classic Rock",
            2 => "Country",
            3 => "Dance",
            4 => "Disco",
            5 => "Funk",
            6 => "Grunge",
            7 => "Hip-Hop",
            8 => "Jazz",
            9 => "Metal",
            10 => "New Age",
            11 => "Oldies",
            12 => "Other",
            13 => "Pop",
            14 => "R&B",
            15 => "Rap",
            16 => "Reggae",
            17 => "Rock",
            18 => "Techno",
            19 => "Industrial",
            20 => "Alternative",
            21 => "Ska",
            22 => "Death Metal",
            23 => "Pranks",
            24 => "Soundtrack",
            25 => "Euro-Techno",
            26 => "Ambient",
            27 => "Trip-Hop",
            28 => "Vocal",
            29 => "Jazz+Funk",
            30 => "Fusion",
            31 => "Trance",
            32 => "Classical",
            33 => "Instrumental",
            34 => "Acid",
            35 => "House",
            36 => "Game",
            37 => "Sound Clip",
            38 => "Gospel",
            39 => "Noise",
            40 => "AlternRock",
            41 => "Bass",
            42 => "Soul",
            43 => "Punk",
            44 => "Space",
            45 => "Meditative",
            46 => "Instrumental Pop",
            47 => "Instrumental Rock",
            48 => "Ethnic",
            49 => "Gothic",
            50 => "Darkwave",
            51 => "Techno-Industrial",
            52 => "Electronic",
            53 => "Pop-Folk",
            54 => "Eurodance",
            55 => "Dream",
            56 => "Southern Rock",
            57 => "Comedy",
            58 => "Cult",
            59 => "Gangsta",
            60 => "Top 40",
            61 => "Christian Rap",
            62 => "Pop/Funk",
            63 => "Jungle",
            64 => "Native American",
            65 => "Cabaret",
            66 => "New Wave",
            67 => "Psychadelic",
            68 => "Rave",
            69 => "Showtunes",
            70 => "Trailer",
            71 => "Lo-Fi",
            72 => "Tribal",
            73 => "Acid Punk",
            74 => "Acid Jazz",
            75 => "Polka",
            76 => "Retro",
            77 => "Musical",
            78 => "Rock & Roll",
            79 => "Hard Rock",
            _ => "Unknown",
        };

        metadata.genre = Some(_genre_name.to_string());

        Some(metadata)
    }
}
