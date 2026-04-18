//! Core modules
//!
//! Contains core functionality modules like trace, scanner, and deduplicator.

pub mod incremental_scanner;
pub mod music_deduplicator;
pub mod trace;

pub use incremental_scanner::*;
pub use music_deduplicator::*;
pub use trace::*;
