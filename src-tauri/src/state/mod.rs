//! 全局应用状态模块
//!
//! 管理应用程序的全局静态变量、缓存和辅助函数

pub mod app_state;

// 重新导出全局状态，方便其他模块使用
pub use app_state::*;
