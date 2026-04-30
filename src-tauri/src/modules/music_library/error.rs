use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub enum MusicLibraryError {
    IoError(String),
    ParseError(String),
    NetworkError(String),
    NotFound(String),
    DuplicateError(String),
    InvalidState(String),
}

impl std::fmt::Display for MusicLibraryError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MusicLibraryError::IoError(msg) => write!(f, "IO error: {}", msg),
            MusicLibraryError::ParseError(msg) => write!(f, "Parse error: {}", msg),
            MusicLibraryError::NetworkError(msg) => write!(f, "Network error: {}", msg),
            MusicLibraryError::NotFound(msg) => write!(f, "Not found: {}", msg),
            MusicLibraryError::DuplicateError(msg) => write!(f, "Duplicate: {}", msg),
            MusicLibraryError::InvalidState(msg) => write!(f, "Invalid state: {}", msg),
        }
    }
}

impl std::error::Error for MusicLibraryError {}

impl From<std::io::Error> for MusicLibraryError {
    fn from(e: std::io::Error) -> Self {
        MusicLibraryError::IoError(e.to_string())
    }
}

impl From<serde_json::Error> for MusicLibraryError {
    fn from(e: serde_json::Error) -> Self {
        MusicLibraryError::ParseError(e.to_string())
    }
}

pub type Result<T> = std::result::Result<T, MusicLibraryError>;
