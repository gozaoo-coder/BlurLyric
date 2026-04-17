// GPU Image Resize Shader
// 使用双线性插值进行高质量图像缩放

struct Uniforms {
    src_width: f32,
    src_height: f32,
    dst_width: f32,
    dst_height: f32,
    _padding: vec4<f32>,
};

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

@group(0) @binding(1)
var src_texture: texture_2d<f32>;

@group(0) @binding(2)
var src_sampler: sampler;

// 顶点着色器 - 全屏三角形
@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> @builtin(position) vec4<f32> {
    // 使用三角形覆盖整个屏幕
    // vertex_index: 0 -> (-1, -1), 1 -> (3, -1), 2 -> (-1, 3)
    var pos = vec2<f32>(0.0, 0.0);
    
    if vertex_index == 0u {
        pos = vec2<f32>(-1.0, -1.0);
    } else if vertex_index == 1u {
        pos = vec2<f32>(3.0, -1.0);
    } else {
        pos = vec2<f32>(-1.0, 3.0);
    }
    
    return vec4<f32>(pos, 0.0, 1.0);
}

// 片段着色器 - 双线性插值采样
@fragment
fn fs_main(@builtin(position) frag_coord: vec4<f32>) -> @location(0) vec4<f32> {
    // 计算归一化纹理坐标
    let dst_coord = frag_coord.xy;
    let u = dst_coord.x / uniforms.dst_width;
    let v = 1.0 - (dst_coord.y / uniforms.dst_height); // 翻转Y轴
    
    // 采样源纹理
    let color = textureSample(src_texture, src_sampler, vec2<f32>(u, v));
    
    return color;
}
