use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceLink {
    /// 来源标识，如 "local_storage"
    pub source_id: String,
    /// 指向 SourceRecord 的 ObjectId
    pub record_id: String,
}

impl TraceLink {
    pub fn new(source_id: impl Into<String>, record_id: impl Into<String>) -> Self {
        TraceLink {
            source_id: source_id.into(),
            record_id: record_id.into(),
        }
    }
}
