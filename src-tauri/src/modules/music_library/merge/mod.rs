pub mod auto_merge;
pub mod manual_override;

use std::collections::HashMap;

/// 合并覆盖规则表
#[derive(Debug, Clone, Default)]
pub struct MergeOverrideTable {
    /// source_record_id -> target_master_id
    pub force_merges: HashMap<String, String>,
    /// original_master_id -> new_master_ids
    pub splits: HashMap<String, Vec<String>>,
}
