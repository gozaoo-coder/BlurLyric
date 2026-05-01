use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Artist {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<u32>,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub aliases: Option<Vec<String>>,
}

impl Artist {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            id: None,
            name: name.into(),
            aliases: None,
        }
    }

    pub fn with_id(id: u32, name: impl Into<String>) -> Self {
        Self {
            id: Some(id),
            name: name.into(),
            aliases: None,
        }
    }
}
