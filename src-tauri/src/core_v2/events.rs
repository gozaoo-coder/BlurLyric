use super::models::{Trace};

pub enum LibraryEvent {
    EntityCleanup { entity_id: String },
    TraceAdded { entity_id: String, trace: Trace },
    TraceRemoved { entity_id: String, trace: Trace },
}
