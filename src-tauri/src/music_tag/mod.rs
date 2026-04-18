pub mod audio_properties;
pub mod error;
pub mod parser;
/**
 * MusicTag Rust模块
 *
 * 提供音乐元数据读取和处理功能，替代audiotags crate
 */
pub mod types;

pub use error::*;
pub use parser::*;
pub use types::*;

use std::path::Path;

/// 读取音乐文件元数据
///
/// # Arguments
/// * `path` - 音乐文件路径
///
/// # Returns
/// * `Result<MusicMetadata, MusicTagError>` - 元数据或错误
///
/// # Example
/// ```rust
/// use music_tag::read_metadata;
///
/// let metadata = read_metadata("/path/to/song.mp3")?;
/// println!("Title: {}", metadata.title);
/// ```
pub fn read_metadata<P: AsRef<Path>>(path: P) -> crate::music_tag::error::Result<MusicMetadata> {
    let parser = MetadataParser::new();
    parser.parse(path)
}

/// 批量读取音乐文件元数据
///
/// # Arguments
/// * `paths` - 音乐文件路径列表
///
/// # Returns
/// * `Vec<Result<MusicMetadata, MusicTagError>>` - 元数据结果列表
pub fn read_metadata_batch<P: AsRef<Path>>(
    paths: &[P],
) -> Vec<crate::music_tag::error::Result<MusicMetadata>> {
    let parser = MetadataParser::new();
    paths.iter().map(|path| parser.parse(path)).collect()
}

/// 检查文件是否为支持的音频格式
///
/// # Arguments
/// * `path` - 文件路径
///
/// # Returns
/// * `bool` - 是否支持
pub fn is_supported_format<P: AsRef<Path>>(path: P) -> bool {
    MetadataParser::is_supported_format(path)
}

/// 获取音频文件格式
///
/// # Arguments
/// * `path` - 文件路径
///
/// # Returns
/// * `Option<AudioFormat>` - 音频格式
pub fn get_audio_format<P: AsRef<Path>>(path: P) -> Option<AudioFormat> {
    MetadataParser::detect_format(path)
}
