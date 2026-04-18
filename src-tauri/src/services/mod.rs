// 服务模块 - 业务逻辑层
//
// 本模块包含应用的核心业务逻辑，按功能划分为：
// - scanner: 音乐文件扫描与解析
// - deduplication: 歌曲去重与合并
// - persistence: 数据持久化与应用初始化

pub mod deduplication;
pub mod persistence;
pub mod scanner;
