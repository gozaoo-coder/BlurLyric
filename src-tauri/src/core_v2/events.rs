use super::models::Trace;
use tokio::sync::broadcast;

#[derive(Debug, Clone)]
pub enum LibraryEvent {
    EntityCleanup { entity_id: String },
    TraceAdded { entity_id: String, trace: Trace },
    TraceRemoved { entity_id: String, trace: Trace },
}

pub fn create_event_channel() -> (broadcast::Sender<LibraryEvent>, broadcast::Receiver<LibraryEvent>) {
    broadcast::channel(100)
}
