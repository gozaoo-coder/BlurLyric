use serde::{Deserialize, Serialize};
use std::path::Path;
use crate::modules::music_library::error::{Result, MusicLibraryError};

/// 手动合并操作类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OverrideAction {
    /// 强制将多个 SourceRecord 合并到指定 Master
    ForceMerge,
    /// 拆分 Master，将指定 SourceRecord 移到新 Master
    Split,
}

/// 单条手动合并操作
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManualMergeAction {
    pub action: OverrideAction,
    pub source_record_ids: Vec<String>,
    pub target_master_id: Option<String>,
    pub new_master_ids: Option<Vec<String>>,
}

/// 持久化格式
#[derive(Debug, Clone, Serialize, Deserialize)]
struct MergeOverridesData {
    actions: Vec<ManualMergeAction>,
    version: u32,
}

/// 保存合并覆盖到文件
pub fn save_merge_overrides(path: &Path, actions: &[ManualMergeAction]) -> Result<()> {
    let data = MergeOverridesData {
        actions: actions.to_vec(),
        version: 1,
    };
    let temp_path = path.with_extension("json.tmp");
    let json_str = serde_json::to_string_pretty(&data)?;
    std::fs::write(&temp_path, json_str)?;
    std::fs::rename(&temp_path, path)?;
    Ok(())
}

/// 从文件加载合并覆盖
pub fn load_merge_overrides(path: &Path) -> Result<Vec<ManualMergeAction>> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let json_str = std::fs::read_to_string(path)?;
    let data: MergeOverridesData = serde_json::from_str(&json_str)
        .map_err(|e| MusicLibraryError::ParseError(e.to_string()))?;
    Ok(data.actions)
}
