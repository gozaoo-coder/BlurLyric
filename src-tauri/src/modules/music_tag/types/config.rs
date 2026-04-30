use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParseOptions {
    #[serde(default)]
    pub include_raw: bool,
    #[serde(default = "default_true")]
    pub include_pictures: bool,
    #[serde(default = "default_true")]
    pub include_lyrics: bool,
    #[serde(default = "default_encoding")]
    pub encoding_preference: String,
}

impl Default for ParseOptions {
    fn default() -> Self {
        Self {
            include_raw: false,
            include_pictures: true,
            include_lyrics: true,
            encoding_preference: "UTF-8".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParseResult<T> {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warnings: Option<Vec<String>>,
}

impl<T> ParseResult<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
            warnings: None,
        }
    }

    pub fn error(error: impl Into<String>) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error.into()),
            warnings: None,
        }
    }

    pub fn with_warning(mut self, warning: impl Into<String>) -> Self {
        let warnings = self.warnings.get_or_insert_with(Vec::new);
        warnings.push(warning.into());
        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MusicTagConfig {
    #[serde(default = "default_encoding")]
    pub default_encoding: String,
    #[serde(default)]
    pub strict_mode: bool,
    #[serde(default = "default_log_level")]
    pub log_level: String,
}

impl Default for MusicTagConfig {
    fn default() -> Self {
        Self {
            default_encoding: "UTF-8".to_string(),
            strict_mode: false,
            log_level: "info".to_string(),
        }
    }
}

fn default_true() -> bool {
    true
}

fn default_encoding() -> String {
    "UTF-8".to_string()
}

fn default_log_level() -> String {
    "info".to_string()
}
