/// 收藏下载模块
/// 当用户收藏的歌曲仅存在于 Temp/API 来源时，
/// 下载到 FavorStorageSource 以保证持久可用

use crate::modules::music_library::object_id::ObjectId;

/// 确保收藏的歌曲有 Favor 来源
/// 如果仅 Temp/API 来源，触发下载
pub fn ensure_favor_source(
    _song_id: &ObjectId,
    _library_manager: &crate::modules::music_library::manager::MusicStorageSourceLibraryManager,
    _source_manager: &crate::modules::music_library::source::manager::SourceManager,
    _favor_source_id: &str,
) -> Result<(), String> {
    // 1. 获取 MasterSong 的所有 SourceRecord
    // 2. 检查是否已存在 Favor/Local 来源
    // 3. 若仅 Temp/API → 选择最佳来源下载
    // 4. 创建 Favor SourceRecord
    // 5. 添加到 FavorStorageSource
    // 6. 更新 TraceLink

    // 临时实现
    Ok(())
}
