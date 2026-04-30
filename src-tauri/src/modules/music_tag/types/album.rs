use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Album {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<u32>,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pic_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artist: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub year: Option<u32>,
}

impl Album {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            id: None,
            name: name.into(),
            pic_url: None,
            artist: None,
            year: None,
        }
    }

    pub fn with_id(id: u32, name: impl Into<String>) -> Self {
        Self {
            id: Some(id),
            name: name.into(),
            pic_url: None,
            artist: None,
            year: None,
        }
    }
}
