/**
 * MusicTag Rust模块 - 错误处理
 * 
 * 定义模块中使用的所有错误类型
 */

use std::fmt;
use std::io;
use std::path::PathBuf;

/// MusicTag错误类型
#[derive(Debug, Clone)]
pub enum MusicTagError {
    /// IO错误
    Io {
        path: PathBuf,
        message: String,
    },
    /// 不支持的格式
    UnsupportedFormat {
        path: PathBuf,
        format: String,
    },
    /// 解析错误
    ParseError {
        path: PathBuf,
        message: String,
    },
    /// 无效的元数据
    InvalidMetadata {
        field: String,
        message: String,
    },
    /// 文件不存在
    FileNotFound {
        path: PathBuf,
    },
    /// 编码错误
    EncodingError {
        encoding: String,
        message: String,
    },
    /// 其他错误
    Other {
        message: String,
    },
}

impl fmt::Display for MusicTagError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            MusicTagError::Io { path, message } => {
                write!(f, "IO错误 [{}]: {}", path.display(), message)
            }
            MusicTagError::UnsupportedFormat { path, format } => {
                write!(f, "不支持的格式 [{}]: {}", path.display(), format)
            }
            MusicTagError::ParseError { path, message } => {
                write!(f, "解析错误 [{}]: {}", path.display(), message)
            }
            MusicTagError::InvalidMetadata { field, message } => {
                write!(f, "无效元数据 [{}]: {}", field, message)
            }
            MusicTagError::FileNotFound { path } => {
                write!(f, "文件不存在: {}", path.display())
            }
            MusicTagError::EncodingError { encoding, message } => {
                write!(f, "编码错误 [{}]: {}", encoding, message)
            }
            MusicTagError::Other { message } => {
                write!(f, "错误: {}", message)
            }
        }
    }
}

impl std::error::Error for MusicTagError {}

impl From<io::Error> for MusicTagError {
    fn from(error: io::Error) -> Self {
        MusicTagError::Io {
            path: PathBuf::new(),
            message: error.to_string(),
        }
    }
}

impl From<String> for MusicTagError {
    fn from(message: String) -> Self {
        MusicTagError::Other { message }
    }
}

impl From<&str> for MusicTagError {
    fn from(message: &str) -> Self {
        MusicTagError::Other {
            message: message.to_string(),
        }
    }
}

/// 结果类型别名
pub type Result<T> = std::result::Result<T, MusicTagError>;

/// 创建IO错误
pub fn io_error<P: Into<PathBuf>>(path: P, message: impl Into<String>) -> MusicTagError {
    MusicTagError::Io {
        path: path.into(),
        message: message.into(),
    }
}

/// 创建不支持格式错误
pub fn unsupported_format<P: Into<PathBuf>>(path: P, format: impl Into<String>) -> MusicTagError {
    MusicTagError::UnsupportedFormat {
        path: path.into(),
        format: format.into(),
    }
}

/// 创建解析错误
pub fn parse_error<P: Into<PathBuf>>(path: P, message: impl Into<String>) -> MusicTagError {
    MusicTagError::ParseError {
        path: path.into(),
        message: message.into(),
    }
}

/// 创建无效元数据错误
pub fn invalid_metadata(field: impl Into<String>, message: impl Into<String>) -> MusicTagError {
    MusicTagError::InvalidMetadata {
        field: field.into(),
        message: message.into(),
    }
}

/// 创建文件不存在错误
pub fn file_not_found<P: Into<PathBuf>>(path: P) -> MusicTagError {
    MusicTagError::FileNotFound { path: path.into() }
}

/// 创建编码错误
pub fn encoding_error(encoding: impl Into<String>, message: impl Into<String>) -> MusicTagError {
    MusicTagError::EncodingError {
        encoding: encoding.into(),
        message: message.into(),
    }
}
