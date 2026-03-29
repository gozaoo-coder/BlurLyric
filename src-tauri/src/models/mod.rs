//! 数据模型模块
//! 
//! 统一数据模型，支持 Trace 来源追踪机制

mod track;
mod artist;
mod album;

#[allow(unused_imports)]
pub use track::{Track, TrackSummup, TrackSourceInfo};
#[allow(unused_imports)]
pub use artist::{Artist, ArtistSummup};
#[allow(unused_imports)]
pub use album::{Album, AlbumSummup};

// 重新导出 trace 模块中的公共类型
#[allow(unused_imports)]
pub use crate::trace::{Trace, TraceDataType, SourceType, StorageType, FetchMethod, ResourceInfo, BaseModel};
