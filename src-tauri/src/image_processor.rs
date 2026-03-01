/**
 * Image Processor Module
 * 提供图片处理功能，支持多线程和GPU加速
 */

use image::{imageops::FilterType, DynamicImage, GenericImageView, ImageFormat};
use std::io::Cursor;
use std::sync::Arc;
use tokio::sync::Semaphore;
use std::time::Instant;

// 引入GPU图像处理器
use crate::gpu_image_processor::{init_gpu_processor, resize_with_gpu_fallback};

// 图片处理配置
pub struct ImageProcessorConfig {
    pub max_concurrent_tasks: usize,
    pub use_gpu: bool,
    pub default_filter: FilterType,
}

impl Default for ImageProcessorConfig {
    fn default() -> Self {
        Self {
            max_concurrent_tasks: num_cpus::get(),
            use_gpu: true, // 默认启用GPU加速
            default_filter: FilterType::Lanczos3,
        }
    }
}

// 图片处理器
pub struct ImageProcessor {
    config: ImageProcessorConfig,
    semaphore: Arc<Semaphore>,
    gpu_initialized: bool,
}

impl ImageProcessor {
    pub fn new() -> Self {
        Self::with_config(ImageProcessorConfig::default())
    }

    pub fn with_config(config: ImageProcessorConfig) -> Self {
        let semaphore = Arc::new(Semaphore::new(config.max_concurrent_tasks));
        
        // 尝试初始化GPU
        let gpu_initialized = if config.use_gpu {
            match init_gpu_processor() {
                Ok(_) => {
                    println!("GPU image processor initialized successfully");
                    true
                }
                Err(e) => {
                    println!("Failed to initialize GPU processor: {}, falling back to CPU", e);
                    false
                }
            }
        } else {
            false
        };
        
        Self {
            config,
            semaphore,
            gpu_initialized,
        }
    }

    /// 调整图片大小（优先使用GPU）
    pub fn resize(&self, image: DynamicImage, max_resolution: u32) -> DynamicImage {
        let (width, height) = image.dimensions();
        let scale = f32::max(width as f32, height as f32) / max_resolution as f32;
        
        if scale <= 1.0 {
            return image;
        }
        
        let new_width = (width as f32 / scale) as u32;
        let new_height = (height as f32 / scale) as u32;
        
        // 如果GPU可用，使用GPU加速
        if self.gpu_initialized {
            match resize_with_gpu_fallback(&image, new_width, new_height) {
                Ok(result) => return result,
                Err(e) => {
                    println!("GPU resize failed, using CPU: {}", e);
                }
            }
        }
        
        // CPU降级处理
        image.resize(new_width, new_height, self.config.default_filter)
    }

    /// 异步调整图片大小（使用线程池）
    pub async fn resize_async(
        &self,
        image: DynamicImage,
        max_resolution: u32,
    ) -> Result<DynamicImage, String> {
        let permit = self
            .semaphore
            .clone()
            .acquire_owned()
            .await
            .map_err(|e| format!("Failed to acquire semaphore: {}", e))?;

        let filter = self.config.default_filter;
        let use_gpu = self.gpu_initialized;

        let result = tokio::task::spawn_blocking(move || {
            let _permit = permit; // 保持permit直到任务完成
            let (width, height) = image.dimensions();
            let scale = f32::max(width as f32, height as f32) / max_resolution as f32;

            if scale <= 1.0 {
                return Ok(image);
            }
            
            let new_width = (width as f32 / scale) as u32;
            let new_height = (height as f32 / scale) as u32;
            
            // 尝试使用GPU
            if use_gpu {
                match resize_with_gpu_fallback(&image, new_width, new_height) {
                    Ok(result) => return Ok(result),
                    Err(e) => {
                        println!("GPU resize failed in async: {}", e);
                    }
                }
            }
            
            // CPU降级
            Ok(image.resize(new_width, new_height, filter))
        })
        .await
        .map_err(|e| format!("JoinError: {:?}", e))?;

        result
    }

    /// 批量处理图片
    pub async fn resize_batch(
        &self,
        images: Vec<(DynamicImage, u32)>,
    ) -> Vec<Result<DynamicImage, String>> {
        let futures: Vec<_> = images
            .into_iter()
            .map(|(img, res)| self.resize_async(img, res))
            .collect();

        futures::future::join_all(futures).await
    }

    /// 将图片编码为WebP格式
    pub fn encode_webp(&self, image: &DynamicImage) -> Result<Vec<u8>, String> {
        let mut buffer = Vec::new();
        image
            .write_to(&mut Cursor::new(&mut buffer), ImageFormat::WebP)
            .map_err(|e| format!("Failed to encode WebP: {}", e))?;
        Ok(buffer)
    }

    /// 异步编码图片
    pub async fn encode_webp_async(&self, image: DynamicImage) -> Result<Vec<u8>, String> {
        let permit = self
            .semaphore
            .clone()
            .acquire_owned()
            .await
            .map_err(|e| format!("Failed to acquire semaphore: {}", e))?;

        tokio::task::spawn_blocking(move || {
            let _permit = permit;
            let mut buffer = Vec::new();
            image
                .write_to(&mut Cursor::new(&mut buffer), ImageFormat::WebP)
                .map_err(|e| format!("Failed to encode WebP: {}", e))?;
            Ok(buffer)
        })
        .await
        .map_err(|e| format!("JoinError: {:?}", e))?
    }

    /// 从字节加载图片
    pub fn load_from_memory(&self, data: &[u8]) -> Result<DynamicImage, String> {
        image::load_from_memory(data).map_err(|e| format!("Failed to load image: {}", e))
    }

    /// 处理专辑封面（调整大小并编码）
    pub async fn process_album_cover(
        &self,
        cover_data: Vec<u8>,
        max_resolution: u32,
    ) -> Result<Vec<u8>, String> {
        let start = Instant::now();

        // 加载图片
        let image = self.load_from_memory(&cover_data)?;
        let load_duration = start.elapsed();
        println!("图片加载耗时: {:?}", load_duration);

        // 调整大小（使用GPU加速）
        let start = Instant::now();
        let resized = self.resize_async(image, max_resolution).await?;
        let resize_duration = start.elapsed();
        println!("图片缩放耗时: {:?} (GPU: {})", resize_duration, self.gpu_initialized);

        // 编码
        let start = Instant::now();
        let encoded = self.encode_webp_async(resized).await?;
        let encode_duration = start.elapsed();
        println!("图片编码耗时: {:?}", encode_duration);

        Ok(encoded)
    }
    
    /// 检查GPU是否可用
    pub fn is_gpu_available(&self) -> bool {
        self.gpu_initialized
    }
}

impl Default for ImageProcessor {
    fn default() -> Self {
        Self::new()
    }
}

// 全局图片处理器实例
use once_cell::sync::Lazy;

pub static IMAGE_PROCESSOR: Lazy<ImageProcessor> = Lazy::new(ImageProcessor::new);

/// 便捷函数：处理专辑封面
pub async fn process_album_cover(cover_data: Vec<u8>, max_resolution: u32) -> Result<Vec<u8>, String> {
    IMAGE_PROCESSOR.process_album_cover(cover_data, max_resolution).await
}

/// 便捷函数：调整图片大小
pub async fn resize_image_async(image: DynamicImage, max_resolution: u32) -> Result<DynamicImage, String> {
    IMAGE_PROCESSOR.resize_async(image, max_resolution).await
}

/// 检查GPU是否可用
pub fn is_gpu_available() -> bool {
    IMAGE_PROCESSOR.is_gpu_available()
}
