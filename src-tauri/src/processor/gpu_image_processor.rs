/**
 * GPU Image Processor - GPU加速图像处理模块
 *
 * 使用 wgpu 实现跨平台 GPU 图像缩放
 * 支持自动降级到 CPU 处理
 */
use image::{DynamicImage, RgbaImage};
use std::sync::Arc;
use wgpu::util::DeviceExt;

/// GPU 图像处理器
pub struct GpuImageProcessor {
    device: wgpu::Device,
    queue: wgpu::Queue,
    pipeline: wgpu::RenderPipeline,
    sampler: wgpu::Sampler,
    bind_group_layout: wgpu::BindGroupLayout,
}

/// 缩放参数
#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
struct ResizeUniforms {
    src_width: f32,
    src_height: f32,
    dst_width: f32,
    dst_height: f32,
    _padding: [f32; 4],
}

impl GpuImageProcessor {
    /// 初始化 GPU 处理器
    pub async fn new() -> Result<Self, String> {
        // 创建实例
        let instance = wgpu::Instance::new(wgpu::InstanceDescriptor {
            backends: wgpu::Backends::all(),
            ..Default::default()
        });

        // 请求适配器
        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: None,
                force_fallback_adapter: false,
            })
            .await
            .ok_or("Failed to find GPU adapter")?;

        // 创建设备和队列
        let (device, queue) = adapter
            .request_device(
                &wgpu::DeviceDescriptor {
                    required_features: wgpu::Features::empty(),
                    required_limits: wgpu::Limits::default(),
                    label: Some("GPU Image Processor"),
                    memory_hints: wgpu::MemoryHints::default(),
                },
                None,
            )
            .await
            .map_err(|e| format!("Failed to create device: {}", e))?;

        // 创建着色器模块
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Resize Shader"),
            source: wgpu::ShaderSource::Wgsl(include_str!("shaders/resize.wgsl").into()),
        });

        // 创建绑定组布局
        let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("Resize Bind Group Layout"),
            entries: &[
                //  uniforms
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                // 源纹理
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Texture {
                        multisampled: false,
                        view_dimension: wgpu::TextureViewDimension::D2,
                        sample_type: wgpu::TextureSampleType::Float { filterable: true },
                    },
                    count: None,
                },
                // 采样器
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                    count: None,
                },
            ],
        });

        // 创建渲染管线布局
        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Resize Pipeline Layout"),
            bind_group_layouts: &[&bind_group_layout],
            push_constant_ranges: &[],
        });

        // 创建渲染管线
        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Resize Pipeline"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: "vs_main",
                buffers: &[],
                compilation_options: wgpu::PipelineCompilationOptions::default(),
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: "fs_main",
                targets: &[Some(wgpu::ColorTargetState {
                    format: wgpu::TextureFormat::Rgba8Unorm,
                    blend: Some(wgpu::BlendState::REPLACE),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
                compilation_options: wgpu::PipelineCompilationOptions::default(),
            }),
            primitive: wgpu::PrimitiveState {
                topology: wgpu::PrimitiveTopology::TriangleList,
                strip_index_format: None,
                front_face: wgpu::FrontFace::Ccw,
                cull_mode: None,
                polygon_mode: wgpu::PolygonMode::Fill,
                unclipped_depth: false,
                conservative: false,
            },
            depth_stencil: None,
            multisample: wgpu::MultisampleState {
                count: 1,
                mask: !0,
                alpha_to_coverage_enabled: false,
            },
            multiview: None,
            cache: None,
        });

        // 创建采样器
        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            address_mode_u: wgpu::AddressMode::ClampToEdge,
            address_mode_v: wgpu::AddressMode::ClampToEdge,
            address_mode_w: wgpu::AddressMode::ClampToEdge,
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            mipmap_filter: wgpu::FilterMode::Linear,
            ..Default::default()
        });

        Ok(Self {
            device,
            queue,
            pipeline,
            sampler,
            bind_group_layout,
        })
    }

    /// 同步初始化（阻塞）
    pub fn new_blocking() -> Result<Self, String> {
        pollster::block_on(Self::new())
    }

    /// 提交GPU缩放命令（同步部分：纹理创建、渲染、拷贝）
    fn submit_resize_commands(
        &self,
        image: &DynamicImage,
        new_width: u32,
        new_height: u32,
    ) -> Result<(wgpu::Buffer, u32, u32, u32), String> {
        let new_width = new_width.max(1);
        let new_height = new_height.max(1);

        let rgba = image.to_rgba8();
        let (src_width, src_height) = rgba.dimensions();

        // 创建源纹理
        let src_texture = self.device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Source Texture"),
            size: wgpu::Extent3d {
                width: src_width,
                height: src_height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8Unorm,
            usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });

        // 写入图片数据
        // 计算对齐后的 bytes_per_row (必须是 256 的倍数)
        let src_bytes_per_row_unaligned = 4 * src_width;
        let src_bytes_per_row_aligned = ((src_bytes_per_row_unaligned + 255) / 256) * 256;

        // 如果需要对齐，创建填充后的数据
        let src_data: Vec<u8> = if src_bytes_per_row_aligned == src_bytes_per_row_unaligned {
            rgba.to_vec()
        } else {
            let mut padded = Vec::with_capacity((src_bytes_per_row_aligned * src_height) as usize);
            for row in 0..src_height {
                let row_start = (row * src_bytes_per_row_unaligned) as usize;
                let row_end = row_start + src_bytes_per_row_unaligned as usize;
                padded.extend_from_slice(&rgba.as_raw()[row_start..row_end]);
                // 添加填充
                padded.extend(vec![
                    0u8;
                    (src_bytes_per_row_aligned - src_bytes_per_row_unaligned)
                        as usize
                ]);
            }
            padded
        };

        self.queue.write_texture(
            wgpu::ImageCopyTexture {
                texture: &src_texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            &src_data,
            wgpu::ImageDataLayout {
                offset: 0,
                bytes_per_row: Some(src_bytes_per_row_aligned),
                rows_per_image: Some(src_height),
            },
            wgpu::Extent3d {
                width: src_width,
                height: src_height,
                depth_or_array_layers: 1,
            },
        );

        // 创建目标纹理
        let dst_texture = self.device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Destination Texture"),
            size: wgpu::Extent3d {
                width: new_width,
                height: new_height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8Unorm,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::COPY_SRC,
            view_formats: &[],
        });

        // 创建 uniform buffer
        let uniforms = ResizeUniforms {
            src_width: src_width as f32,
            src_height: src_height as f32,
            dst_width: new_width as f32,
            dst_height: new_height as f32,
            _padding: [0.0; 4],
        };

        let uniform_buffer = self
            .device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Uniform Buffer"),
                contents: bytemuck::cast_slice(&[uniforms]),
                usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            });

        // 创建绑定组
        let bind_group = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Resize Bind Group"),
            layout: &self.bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: uniform_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(
                        &src_texture.create_view(&wgpu::TextureViewDescriptor::default()),
                    ),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: wgpu::BindingResource::Sampler(&self.sampler),
                },
            ],
        });

        // 创建命令编码器
        let mut encoder = self
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("Resize Encoder"),
            });

        // 渲染通道
        {
            let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Resize Render Pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &dst_texture.create_view(&wgpu::TextureViewDescriptor::default()),
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                occlusion_query_set: None,
                timestamp_writes: None,
            });

            render_pass.set_pipeline(&self.pipeline);
            render_pass.set_bind_group(0, &bind_group, &[]);
            render_pass.draw(0..6, 0..1);
        }

        // 提交命令
        self.queue.submit(std::iter::once(encoder.finish()));

        // 计算对齐后的 bytes_per_row (必须是 256 的倍数)
        let bytes_per_row_unaligned = 4 * new_width;
        let bytes_per_row_aligned = ((bytes_per_row_unaligned + 255) / 256) * 256;
        let padded_buffer_size = (bytes_per_row_aligned * new_height) as u64;

        // 读取结果
        let output_buffer = self.device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("Output Buffer"),
            size: padded_buffer_size,
            usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ,
            mapped_at_creation: false,
        });

        // 复制纹理到缓冲区
        let mut encoder = self
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("Copy Encoder"),
            });

        encoder.copy_texture_to_buffer(
            wgpu::ImageCopyTexture {
                texture: &dst_texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            wgpu::ImageCopyBuffer {
                buffer: &output_buffer,
                layout: wgpu::ImageDataLayout {
                    offset: 0,
                    bytes_per_row: Some(bytes_per_row_aligned),
                    rows_per_image: Some(new_height),
                },
            },
            wgpu::Extent3d {
                width: new_width,
                height: new_height,
                depth_or_array_layers: 1,
            },
        );

        self.queue.submit(std::iter::once(encoder.finish()));

        Ok((output_buffer, bytes_per_row_aligned, new_width, new_height))
    }

    fn read_mapped_buffer(
        output_buffer: wgpu::Buffer,
        bytes_per_row_aligned: u32,
        new_width: u32,
        new_height: u32,
    ) -> Result<DynamicImage, String> {
        let data = output_buffer.slice(..).get_mapped_range();

        let mut image_data = Vec::with_capacity((new_width * new_height * 4) as usize);
        for row in (0..new_height).rev() {
            let row_start = (row * bytes_per_row_aligned) as usize;
            let row_end = row_start + (new_width * 4) as usize;
            image_data.extend_from_slice(&data[row_start..row_end]);
        }

        let result_image = RgbaImage::from_raw(new_width, new_height, image_data)
            .ok_or("Failed to create image from buffer")?;

        drop(data);
        output_buffer.unmap();

        Ok(DynamicImage::ImageRgba8(result_image))
    }

    /// 调整图片大小（同步版本，使用阻塞poll）
    pub fn resize(
        &self,
        image: &DynamicImage,
        new_width: u32,
        new_height: u32,
    ) -> Result<DynamicImage, String> {
        let (output_buffer, bytes_per_row_aligned, new_width, new_height) =
            self.submit_resize_commands(image, new_width, new_height)?;

        let buffer_slice = output_buffer.slice(..);
        buffer_slice.map_async(wgpu::MapMode::Read, |result| {
            if let Err(e) = result {
                tracing::error!(error = %e, "Failed to map GPU buffer");
            }
        });

        self.device.poll(wgpu::Maintain::Wait);

        Self::read_mapped_buffer(output_buffer, bytes_per_row_aligned, new_width, new_height)
    }

    /// 异步调整图片大小（非阻塞，适用于高并发场景）
    pub async fn resize_async(
        &self,
        image: &DynamicImage,
        new_width: u32,
        new_height: u32,
    ) -> Result<DynamicImage, String> {
        let (output_buffer, bytes_per_row_aligned, new_width, new_height) =
            self.submit_resize_commands(image, new_width, new_height)?;

        let (tx, mut rx) = tokio::sync::oneshot::channel();
        let buffer_slice = output_buffer.slice(..);
        buffer_slice.map_async(wgpu::MapMode::Read, move |result| {
            let _ = tx.send(result);
        });

        loop {
            self.device.poll(wgpu::Maintain::Poll);
            if let Ok(result) = rx.try_recv() {
                if let Err(e) = result {
                    return Err(format!("Failed to map GPU buffer: {}", e));
                }
                break;
            }
            tokio::task::yield_now().await;
        }

        Self::read_mapped_buffer(output_buffer, bytes_per_row_aligned, new_width, new_height)
    }

    /// 检查 GPU 是否可用
    pub async fn is_available() -> bool {
        let instance = wgpu::Instance::new(wgpu::InstanceDescriptor {
            backends: wgpu::Backends::all(),
            ..Default::default()
        });

        instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: None,
                force_fallback_adapter: false,
            })
            .await
            .is_some()
    }
}

/// 全局 GPU 处理器（延迟初始化）
use once_cell::sync::OnceCell;
static GPU_PROCESSOR: OnceCell<Arc<GpuImageProcessor>> = OnceCell::new();

/// 初始化全局 GPU 处理器
pub fn init_gpu_processor() -> Result<(), String> {
    let processor = GpuImageProcessor::new_blocking()?;
    let _ = GPU_PROCESSOR.set(Arc::new(processor));
    Ok(())
}

/// 获取 GPU 处理器
pub fn get_gpu_processor() -> Option<&'static Arc<GpuImageProcessor>> {
    GPU_PROCESSOR.get()
}

/// 使用 GPU 调整图片大小（带自动降级，同步版本）
pub fn resize_with_gpu_fallback(
    image: &DynamicImage,
    new_width: u32,
    new_height: u32,
) -> Result<DynamicImage, String> {
    if let Some(gpu) = get_gpu_processor() {
        match gpu.resize(image, new_width, new_height) {
            Ok(result) => {
                tracing::debug!(
                    from_w = image.width(),
                    from_h = image.height(),
                    to_w = new_width,
                    to_h = new_height,
                    "GPU resize succeeded"
                );
                return Ok(result);
            }
            Err(e) => {
                tracing::warn!(error = %e, "GPU resize failed, falling back to CPU");
            }
        }
    }

    tracing::debug!(
        from_w = image.width(),
        from_h = image.height(),
        to_w = new_width,
        to_h = new_height,
        "Using CPU resize"
    );

    use image::imageops::FilterType;
    Ok(image.resize(new_width, new_height, FilterType::Lanczos3))
}

/// 使用 GPU 异步调整图片大小（带自动降级，异步非阻塞版本）
pub async fn resize_with_gpu_fallback_async(
    image: &DynamicImage,
    new_width: u32,
    new_height: u32,
) -> Result<DynamicImage, String> {
    if let Some(gpu) = get_gpu_processor() {
        match gpu.resize_async(image, new_width, new_height).await {
            Ok(result) => {
                tracing::debug!(
                    from_w = image.width(),
                    from_h = image.height(),
                    to_w = new_width,
                    to_h = new_height,
                    "GPU async resize succeeded"
                );
                return Ok(result);
            }
            Err(e) => {
                tracing::warn!(error = %e, "GPU async resize failed, falling back to CPU");
            }
        }
    }

    tracing::debug!(
        from_w = image.width(),
        from_h = image.height(),
        to_w = new_width,
        to_h = new_height,
        "Using CPU resize (async fallback)"
    );

    use image::imageops::FilterType;
    Ok(image.resize(new_width, new_height, FilterType::Lanczos3))
}
