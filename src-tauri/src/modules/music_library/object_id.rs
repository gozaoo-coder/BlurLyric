use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

pub const M_SONG: &str = "m_song";
pub const M_ALBUM: &str = "m_album";
pub const M_ARTIST: &str = "m_artist";
pub const R_SONG: &str = "r_song";
pub const R_ALBUM: &str = "r_album";
pub const R_ARTIST: &str = "r_artist";

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ObjectId(String);

impl ObjectId {
    pub fn new(prefix: &str) -> Self {
        let ulid = ulid::Ulid::new();
        ObjectId(format!("{}_{}", prefix, ulid))
    }

    pub fn from_string(s: &str) -> Result<Self, String> {
        let valid_prefixes = [M_SONG, M_ALBUM, M_ARTIST, R_SONG, R_ALBUM, R_ARTIST];
        let prefix = s.rsplit('_').last().unwrap_or("");
        if valid_prefixes.contains(&prefix) {
            Ok(ObjectId(s.to_string()))
        } else {
            // Try to extract prefix from format "prefix_suffix"
            for &p in &valid_prefixes {
                if s.starts_with(p) {
                    return Ok(ObjectId(s.to_string()));
                }
            }
            Err(format!("Invalid ObjectId format: {}", s))
        }
    }

    pub fn prefix(&self) -> &str {
        for &p in &[M_SONG, M_ALBUM, M_ARTIST, R_SONG, R_ALBUM, R_ARTIST] {
            if self.0.starts_with(p) {
                return p;
            }
        }
        "unknown"
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    pub fn into_inner(self) -> String {
        self.0
    }
}

impl fmt::Display for ObjectId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl FromStr for ObjectId {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        ObjectId::from_string(s)
    }
}

impl From<String> for ObjectId {
    fn from(s: String) -> Self {
        ObjectId(s)
    }
}
