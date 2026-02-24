/**
 * MusicTag Rust模块 - 元数据解析器
 * 
 * 提供音乐元数据解析功能，支持多种音频格式
 */

use super::types::*;
use super::error::*;
use std::path::{Path, PathBuf};
use std::fs;

/// 元数据解析器
pub struct MetadataParser {
    config: MusicTagConfig,
}

impl MetadataParser {
    /// 创建新的解析器实例
    pub fn new() -> Self {
        Self {
            config: MusicTagConfig::default(),
        }
    }

    /// 使用配置创建解析器实例
    pub fn with_config(config: MusicTagConfig) -> Self {
        Self { config }
    }

    /// 检测音频格式
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

    /// 检查是否为支持的音频格式
    pub fn is_supported_format<P: AsRef<Path>>(path: P) -> bool {
        Self::detect_format(path).is_some()
    }

    /// 解析音乐文件元数据
    pub fn parse<P: AsRef<Path>>(&self, path: P) -> Result<MusicMetadata> {
        let path = path.as_ref();
        
        // 检查文件是否存在
        if !path.exists() {
            return Err(file_not_found(path));
        }

        // 检测音频格式
        let format = Self::detect_format(path)
            .ok_or_else(|| unsupported_format(
                path,
                path.extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("unknown")
            ))?;

        // 根据格式选择解析方法
        match format {
            AudioFormat::MP3 => self.parse_mp3(path),
            AudioFormat::FLAC => self.parse_flac(path),
            AudioFormat::OGG => self.parse_ogg(path),
            AudioFormat::WAV => self.parse_wav(path),
            _ => Err(unsupported_format(path, format.to_string())),
        }
    }

    /// 解析MP3文件（ID3标签）
    fn parse_mp3(&self, path: &Path) -> Result<MusicMetadata> {
        // 读取文件内容
        let data = fs::read(path)
            .map_err(|e| io_error(path, e.to_string()))?;

        // 尝试解析ID3v2标签
        if let Some(metadata) = self.parse_id3v2(&data, path) {
            return Ok(metadata);
        }

        // 回退到ID3v1
        if let Some(metadata) = self.parse_id3v1(&data, path) {
            return Ok(metadata);
        }

        // 如果都没有标签，使用文件名作为标题
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

    /// 解析ID3v2标签
    fn parse_id3v2(&self, data: &[u8], path: &Path) -> Option<MusicMetadata> {
        // 检查ID3v2标识
        if data.len() < 10 || &data[0..3] != b"ID3" {
            return None;
        }

        let version = data[3];
        let _revision = data[4];
        let flags = data[5];
        
        // 计算标签大小（同步安全整数）
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

        // 解析各个帧
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

        // 如果没有标题，使用文件名
        if metadata.title.is_empty() {
            metadata.title = path.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Unknown")
                .to_string();
        }

        // 如果没有艺术家，设置为Unknown
        if metadata.artists.is_empty() {
            metadata.artists.push(Artist::new("Unknown Artist"));
        }

        // 如果没有专辑名称，设置为Unknown
        if metadata.album.name.is_empty() {
            metadata.album.name = "Unknown Album".to_string();
        }

        Some(metadata)
    }

    /// 读取ID3v2帧大小
    fn read_frame_size(&self, bytes: &[u8], version: u8) -> usize {
        if version >= 4 {
            // ID3v2.4使用同步安全整数
            ((bytes[0] as usize) << 21)
                | ((bytes[1] as usize) << 14)
                | ((bytes[2] as usize) << 7)
                | (bytes[3] as usize)
        } else {
            // ID3v2.3使用普通整数
            u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) as usize
        }
    }

    /// 解析ID3v2帧
    fn parse_id3v2_frame(&self, frame_id: &str, data: &[u8], metadata: &mut MusicMetadata) {
        if data.is_empty() {
            return;
        }

        // 获取编码
        let encoding = data[0];
        let text = if encoding == 0 {
            // ISO-8859-1
            String::from_utf8_lossy(&data[1..]).to_string()
        } else if encoding == 1 || encoding == 2 {
            // UTF-16
            self.decode_utf16(&data[1..])
        } else if encoding == 3 {
            // UTF-8
            String::from_utf8_lossy(&data[1..]).to_string()
        } else {
            String::from_utf8_lossy(data).to_string()
        };

        match frame_id {
            "TIT2" => metadata.title = text,
            "TPE1" => {
                // 主艺术家（可以有多个，以/或\0分隔）
                let artists: Vec<Artist> = text.split(&['/', '\0'][..])
                    .filter(|s| !s.is_empty())
                    .map(|s| Artist::new(s.trim()))
                    .collect();
                if !artists.is_empty() {
                    metadata.artists = artists;
                }
            }
            "TALB" => metadata.album.name = text,
            "TPE2" => metadata.album.artist = Some(text), // 专辑艺术家
            "TRCK" => {
                // 音轨号/总音轨数
                if let Some(idx) = text.find('/') {
                    metadata.track_number = text[..idx].parse().ok();
                    metadata.total_tracks = text[idx + 1..].parse().ok();
                } else {
                    metadata.track_number = text.parse().ok();
                }
            }
            "TPOS" => {
                // 碟片号/总碟片数
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
                // 非同步歌词
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
                // 图片
                if let Some(picture) = self.parse_apic_frame(data) {
                    metadata.pictures.get_or_insert_with(Vec::new).push(picture);
                }
            }
            _ => {}
        }
    }

    /// 解码UTF-16字符串
    fn decode_utf16(&self, data: &[u8]) -> String {
        if data.len() < 2 {
            return String::new();
        }

        // 检测BOM
        let (is_be, start) = if data[0] == 0xFE && data[1] == 0xFF {
            (true, 2)
        } else if data[0] == 0xFF && data[1] == 0xFE {
            (false, 2)
        } else {
            // 默认小端
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

    /// 解析APIC（图片）帧
    fn parse_apic_frame(&self, data: &[u8]) -> Option<Picture> {
        if data.is_empty() {
            return None;
        }

        let encoding = data[0];
        let mut pos = 1;

        // 读取MIME类型（以null结尾）
        let mime_type = if encoding == 0 || encoding == 3 {
            let end = data[pos..].iter().position(|&b| b == 0)?;
            let mime = String::from_utf8_lossy(&data[pos..pos + end]).to_string();
            pos += end + 1;
            mime
        } else {
            // UTF-16编码的MIME类型（很少见）
            pos += 2; // 跳过BOM
            let end = data[pos..].chunks_exact(2).position(|chunk| chunk == [0, 0])?;
            let mime_bytes: Vec<u8> = data[pos..pos + end * 2].to_vec();
            pos += end * 2 + 2;
            String::from_utf8_lossy(&mime_bytes).to_string()
        };

        if pos >= data.len() {
            return None;
        }

        // 图片类型
        let picture_type = data[pos];
        pos += 1;

        // 图片描述（以null结尾）
        let description = if encoding == 0 || encoding == 3 {
            let end = data[pos..].iter().position(|&b| b == 0)?;
            let desc = String::from_utf8_lossy(&data[pos..pos + end]).to_string();
            pos += end + 1;
            desc
        } else {
            pos += 2; // 跳过BOM
            let end = data[pos..].chunks_exact(2).position(|chunk| chunk == [0, 0])?;
            let desc_bytes: Vec<u8> = data[pos..pos + end * 2].to_vec();
            pos += end * 2 + 2;
            String::from_utf8_lossy(&desc_bytes).to_string()
        };

        // 图片数据
        let picture_data = data[pos..].to_vec();

        Some(Picture {
            mime_type,
            picture_type: unsafe { std::mem::transmute(picture_type) },
            description,
            data: picture_data,
        })
    }

    /// 解析ID3v1标签
    fn parse_id3v1(&self, data: &[u8], path: &Path) -> Option<MusicMetadata> {
        if data.len() < 128 {
            return None;
        }

        // ID3v1标签在文件末尾
        let start = data.len() - 128;
        
        // 检查TAG标识
        if &data[start..start + 3] != b"TAG" {
            return None;
        }

        let read_string = |offset: usize, len: usize| -> String {
            let bytes = &data[start + offset..start + offset + len];
            // 去除尾部空格和null字节
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
        let genre = data[start + 127];

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

        // ID3v1流派（可选）
        let _genre_name = match genre {
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

    /// 解析FLAC文件（Vorbis Comment）
    fn parse_flac(&self, path: &Path) -> Result<MusicMetadata> {
        let data = fs::read(path)
            .map_err(|e| io_error(path, e.to_string()))?;

        // 检查FLAC标识
        if data.len() < 4 || &data[0..4] != b"fLaC" {
            return Err(parse_error(path, "无效的FLAC文件"));
        }

        let mut pos = 4;
        let mut comments: std::collections::HashMap<String, String> = std::collections::HashMap::new();
        let mut pictures: Vec<Picture> = Vec::new();

        // 解析FLAC元数据块
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
                    // Vorbis Comment
                    if let Some((c, pics)) = self.parse_vorbis_comment(&data[pos..pos + block_size]) {
                        comments = c;
                        if let Some(p) = pics {
                            pictures = p;
                        }
                    }
                }
                6 => {
                    // Picture
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

        // 构建元数据
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

        // 设置可选字段
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

    /// 解析Vorbis Comment
    fn parse_vorbis_comment(&self, data: &[u8]) -> Option<(std::collections::HashMap<String, String>, Option<Vec<Picture>>)> {
        let mut pos = 0;
        let mut comments = std::collections::HashMap::new();

        // 读取vendor string长度
        if pos + 4 > data.len() {
            return None;
        }
        let vendor_len = u32::from_le_bytes([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]) as usize;
        pos += 4;

        if pos + vendor_len > data.len() {
            return None;
        }
        // 跳过vendor string
        pos += vendor_len;

        // 读取comment list length
        if pos + 4 > data.len() {
            return None;
        }
        let comment_count = u32::from_le_bytes([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]) as usize;
        pos += 4;

        // 读取每个comment
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

            // 解析field=value格式
            if let Some(eq_pos) = comment.find('=') {
                let field = comment[..eq_pos].to_uppercase();
                let value = comment[eq_pos + 1..].to_string();
                comments.insert(field, value);
            }
        }

        Some((comments, None))
    }

    /// 解析FLAC图片块
    fn parse_flac_picture(&self, data: &[u8]) -> Option<Picture> {
        if data.len() < 8 {
            return None;
        }

        let mut pos = 0;

        // 图片类型（4字节）
        let picture_type = u32::from_be_bytes([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]) as u8;
        pos += 4;

        // MIME类型长度
        let mime_len = u32::from_be_bytes([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]) as usize;
        pos += 4;

        if pos + mime_len > data.len() {
            return None;
        }

        // MIME类型
        let mime_type = String::from_utf8_lossy(&data[pos..pos + mime_len]).to_string();
        pos += mime_len;

        if pos + 4 > data.len() {
            return None;
        }

        // 描述长度
        let desc_len = u32::from_be_bytes([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]) as usize;
        pos += 4;

        if pos + desc_len > data.len() {
            return None;
        }

        // 描述
        let description = String::from_utf8_lossy(&data[pos..pos + desc_len]).to_string();
        pos += desc_len;

        if pos + 16 > data.len() {
            return None;
        }

        // 跳过宽度、高度、颜色深度、索引颜色数（各4字节）
        pos += 16;

        if pos + 4 > data.len() {
            return None;
        }

        // 图片数据长度
        let data_len = u32::from_be_bytes([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]) as usize;
        pos += 4;

        if pos + data_len > data.len() {
            return None;
        }

        // 图片数据
        let picture_data = data[pos..pos + data_len].to_vec();

        Some(Picture {
            mime_type,
            picture_type: unsafe { std::mem::transmute(picture_type) },
            description,
            data: picture_data,
        })
    }

    /// 解析OGG文件
    fn parse_ogg(&self, path: &Path) -> Result<MusicMetadata> {
        // OGG使用与FLAC相同的Vorbis Comment格式
        // 简化处理：复用FLAC解析逻辑
        self.parse_flac(path)
    }

    /// 解析WAV文件
    fn parse_wav(&self, path: &Path) -> Result<MusicMetadata> {
        let data = fs::read(path)
            .map_err(|e| io_error(path, e.to_string()))?;

        // 检查RIFF标识
        if data.len() < 12 || &data[0..4] != b"RIFF" || &data[8..12] != b"WAVE" {
            return Err(parse_error(path, "无效的WAV文件"));
        }

        // WAV文件通常没有标准元数据标签
        // 使用文件名作为标题
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

    /// 读取音频文件信息
    pub fn read_file_info<P: AsRef<Path>>(&self, path: P) -> Result<AudioFileInfo> {
        let path = path.as_ref();
        
        if !path.exists() {
            return Err(file_not_found(path));
        }

        let metadata = fs::metadata(path)
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
