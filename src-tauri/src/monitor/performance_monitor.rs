use crate::common::utils;
use once_cell::sync::Lazy;
/**
 * Performance Monitor - 性能监控模块
 *
 * 监控资源加载时间、缓存命中率、内存使用等关键指标
 * 提供性能分析和优化建议
 */
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// 性能指标类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum MetricType {
    ResourceLoadTime,
    CacheHit,
    CacheMiss,
    ScanDuration,
    MemoryUsage,
    ApiResponseTime,
}

/// 性能指标记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricRecord {
    pub metric_type: MetricType,
    pub value: f64,
    pub timestamp: u64,
    pub context: String,
}

/// 性能统计
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceStats {
    pub total_requests: u64,
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub avg_load_time_ms: f64,
    pub total_scan_time_ms: u64,
    pub peak_memory_mb: f64,
}

impl PerformanceStats {
    pub fn new() -> Self {
        PerformanceStats {
            total_requests: 0,
            cache_hits: 0,
            cache_misses: 0,
            avg_load_time_ms: 0.0,
            total_scan_time_ms: 0,
            peak_memory_mb: 0.0,
        }
    }

    /// 计算缓存命中率
    pub fn cache_hit_rate(&self) -> f64 {
        let total = self.cache_hits + self.cache_misses;
        if total == 0 {
            0.0
        } else {
            (self.cache_hits as f64 / total as f64) * 100.0
        }
    }
}

/// 资源加载计时器
pub struct ResourceTimer {
    start: Instant,
    resource_type: String,
    resource_id: String,
}

impl ResourceTimer {
    pub fn new(resource_type: &str, resource_id: &str) -> Self {
        ResourceTimer {
            start: Instant::now(),
            resource_type: resource_type.to_string(),
            resource_id: resource_id.to_string(),
        }
    }

    /// 结束计时并记录
    pub fn finish(self, from_cache: bool) -> Duration {
        let duration = self.start.elapsed();

        let metric_type = if from_cache {
            MetricType::CacheHit
        } else {
            MetricType::CacheMiss
        };

        PerformanceMonitor::record_metric(
            metric_type,
            duration.as_millis() as f64,
            format!("{}:{}", self.resource_type, self.resource_id),
        );

        duration
    }
}

/// 性能监控器
pub struct PerformanceMonitor {
    metrics: Mutex<Vec<MetricRecord>>,
    stats: Mutex<PerformanceStats>,
    timers: Mutex<HashMap<String, Instant>>,
}

static MONITOR: Lazy<PerformanceMonitor> = Lazy::new(|| PerformanceMonitor::new());

impl PerformanceMonitor {
    pub fn new() -> Self {
        PerformanceMonitor {
            metrics: Mutex::new(Vec::new()),
            stats: Mutex::new(PerformanceStats::new()),
            timers: Mutex::new(HashMap::new()),
        }
    }

    /// 获取全局监控器实例
    pub fn instance() -> &'static PerformanceMonitor {
        &MONITOR
    }

    /// 记录性能指标
    pub fn record_metric(metric_type: MetricType, value: f64, context: String) {
        let monitor = Self::instance();
        let record = MetricRecord {
            metric_type,
            value,
            timestamp: current_timestamp(),
            context,
        };

        if let Ok(mut metrics) = monitor.metrics.lock() {
            metrics.push(record);

            // 限制历史记录数量
            if metrics.len() > 10000 {
                let to_remove = metrics.len() - 10000;
                metrics.drain(0..to_remove);
            }
        }

        // 更新统计
        if let Ok(mut stats) = monitor.stats.lock() {
            match metric_type {
                MetricType::CacheHit => {
                    stats.cache_hits += 1;
                    stats.total_requests += 1;
                }
                MetricType::CacheMiss => {
                    stats.cache_misses += 1;
                    stats.total_requests += 1;
                }
                MetricType::ResourceLoadTime => {
                    // 计算移动平均
                    let n = stats.total_requests as f64;
                    stats.avg_load_time_ms = (stats.avg_load_time_ms * n + value) / (n + 1.0);
                }
                MetricType::ScanDuration => {
                    stats.total_scan_time_ms += value as u64;
                }
                _ => {}
            }
        }
    }

    /// 开始计时
    pub fn start_timer(name: &str) {
        let monitor = Self::instance();
        if let Ok(mut timers) = monitor.timers.lock() {
            timers.insert(name.to_string(), Instant::now());
        }
    }

    /// 结束计时并返回耗时（毫秒）
    pub fn end_timer(name: &str) -> Option<f64> {
        let monitor = Self::instance();
        if let Ok(mut timers) = monitor.timers.lock() {
            if let Some(start) = timers.remove(name) {
                let duration = start.elapsed();
                return Some(duration.as_millis() as f64);
            }
        }
        None
    }

    /// 获取性能统计
    pub fn get_stats() -> PerformanceStats {
        let monitor = Self::instance();
        monitor
            .stats
            .lock()
            .map(|s| s.clone())
            .unwrap_or_else(|_| PerformanceStats::new())
    }

    /// 获取最近的指标记录
    pub fn get_recent_metrics(count: usize) -> Vec<MetricRecord> {
        let monitor = Self::instance();
        monitor
            .metrics
            .lock()
            .map(|m| {
                let start = if m.len() > count { m.len() - count } else { 0 };
                m[start..].to_vec()
            })
            .unwrap_or_default()
    }

    /// 获取特定类型的指标
    pub fn get_metrics_by_type(metric_type: MetricType) -> Vec<MetricRecord> {
        let monitor = Self::instance();
        monitor
            .metrics
            .lock()
            .map(|m| {
                m.iter()
                    .filter(|r| r.metric_type == metric_type)
                    .cloned()
                    .collect()
            })
            .unwrap_or_default()
    }

    /// 重置统计
    pub fn reset_stats() {
        let monitor = Self::instance();
        if let Ok(mut stats) = monitor.stats.lock() {
            *stats = PerformanceStats::new();
        }
        if let Ok(mut metrics) = monitor.metrics.lock() {
            metrics.clear();
        }
    }

    /// 生成性能报告
    pub fn generate_report() -> PerformanceReport {
        let stats = Self::get_stats();
        let recent_metrics = Self::get_recent_metrics(100);

        // 分析资源加载时间
        let load_times: Vec<f64> = recent_metrics
            .iter()
            .filter(|m| m.metric_type == MetricType::ResourceLoadTime)
            .map(|m| m.value)
            .collect();

        let avg_load_time = if !load_times.is_empty() {
            load_times.iter().sum::<f64>() / load_times.len() as f64
        } else {
            0.0
        };

        let max_load_time = load_times.iter().cloned().fold(0.0, f64::max);

        // 分析缓存命中率趋势
        let cache_metrics: Vec<&MetricRecord> = recent_metrics
            .iter()
            .filter(|m| {
                m.metric_type == MetricType::CacheHit || m.metric_type == MetricType::CacheMiss
            })
            .collect();

        let recent_hits = cache_metrics
            .iter()
            .filter(|m| m.metric_type == MetricType::CacheHit)
            .count();
        let recent_total = cache_metrics.len();
        let recent_hit_rate = if recent_total > 0 {
            (recent_hits as f64 / recent_total as f64) * 100.0
        } else {
            0.0
        };

        PerformanceReport {
            overall_stats: stats.clone(),
            avg_load_time_ms: avg_load_time,
            max_load_time_ms: max_load_time,
            recent_cache_hit_rate: recent_hit_rate,
            recommendations: Self::generate_recommendations(&stats, avg_load_time, recent_hit_rate),
        }
    }

    /// 生成优化建议
    fn generate_recommendations(
        stats: &PerformanceStats,
        avg_load_time: f64,
        cache_hit_rate: f64,
    ) -> Vec<String> {
        let mut recommendations = Vec::new();

        if cache_hit_rate < 70.0 {
            recommendations.push("缓存命中率较低，建议增加缓存容量或优化缓存策略".to_string());
        }

        if avg_load_time > 500.0 {
            recommendations.push("资源加载时间较长，建议优化资源压缩或启用预加载".to_string());
        }

        if stats.total_scan_time_ms > 10000 {
            recommendations.push("扫描时间较长，建议使用增量扫描减少启动时间".to_string());
        }

        if recommendations.is_empty() {
            recommendations.push("性能表现良好，暂无优化建议".to_string());
        }

        recommendations
    }
}

/// 性能报告
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceReport {
    pub overall_stats: PerformanceStats,
    pub avg_load_time_ms: f64,
    pub max_load_time_ms: f64,
    pub recent_cache_hit_rate: f64,
    pub recommendations: Vec<String>,
}

fn current_timestamp() -> u64 {
    utils::current_timestamp()
}

/// Tauri命令：获取性能统计
#[tauri::command]
pub fn get_performance_stats() -> PerformanceStats {
    PerformanceMonitor::get_stats()
}

/// Tauri命令：获取性能报告
#[tauri::command]
pub fn get_performance_report() -> PerformanceReport {
    PerformanceMonitor::generate_report()
}

/// Tauri命令：重置性能统计
#[tauri::command]
pub fn reset_performance_stats() {
    PerformanceMonitor::reset_stats();
}

/// Tauri命令：记录资源加载
#[tauri::command]
pub fn record_resource_load(
    resource_type: String,
    resource_id: String,
    duration_ms: f64,
    from_cache: bool,
) {
    let metric_type = if from_cache {
        MetricType::CacheHit
    } else {
        MetricType::CacheMiss
    };

    PerformanceMonitor::record_metric(
        metric_type,
        duration_ms,
        format!("{}:{}", resource_type, resource_id),
    );
}

/// Tauri命令：开始性能计时
#[tauri::command]
pub fn start_performance_timer(timer_name: String) {
    PerformanceMonitor::start_timer(&timer_name);
}

/// Tauri命令：结束性能计时
#[tauri::command]
pub fn end_performance_timer(timer_name: String) -> Option<f64> {
    PerformanceMonitor::end_timer(&timer_name)
}
