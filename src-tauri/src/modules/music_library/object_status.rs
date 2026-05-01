use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ObjectStatus {
    Active,
    Deprecated,
}

impl ObjectStatus {
    pub fn is_active(&self) -> bool {
        matches!(self, ObjectStatus::Active)
    }

    pub fn is_deprecated(&self) -> bool {
        matches!(self, ObjectStatus::Deprecated)
    }
}
