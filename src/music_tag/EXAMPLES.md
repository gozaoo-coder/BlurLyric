# MusicTag 使用示例

本文档提供 musicTag 模块的使用示例，展示如何在项目中使用该模块替代原有的 audiotags 依赖。

## 目录

1. [基本使用](#基本使用)
2. [Tauri 集成](#tauri-集成)
3. [批量处理](#批量处理)
4. [自定义解析器](#自定义解析器)

## 基本使用

### 读取单个音乐文件

```typescript
import { MusicTag, readMetadata } from './music_tag';

// 方法1: 使用便捷函数
const result = await readMetadata('/path/to/song.mp3');

if (result.success) {
    console.log('标题:', result.data.title);
    console.log('艺术家:', result.data.artists.map(a => a.name).join(', '));
    console.log('专辑:', result.data.album.name);
    console.log('音轨号:', result.data.trackNumber);
} else {
    console.error('读取失败:', result.error);
}

// 方法2: 使用 MusicTag 类
const musicTag = new MusicTag({
    defaultEncoding: 'UTF-8',
    strictMode: false
});

const metadata = await musicTag.read('/path/to/song.mp3');
```

### 验证和格式化元数据

```typescript
import { MusicTag, MetadataCleaner, MetadataFormatter } from './music_tag';

const musicTag = new MusicTag();

// 读取元数据
const result = await musicTag.read('/path/to/song.mp3');

if (result.success) {
    // 验证元数据
    const validation = musicTag.validate(result.data);
    if (!validation.isValid) {
        console.log('验证错误:', validation.errors);
    }
    
    // 格式化元数据
    const formatted = musicTag.format(result.data);
    console.log('格式化后的标题:', formatted.title);
}
```

### 序列化和反序列化

```typescript
import { toJson, fromJson, toXml } from './music_tag';

// 读取元数据
const result = await readMetadata('/path/to/song.mp3');

if (result.success) {
    // 序列化为 JSON
    const json = toJson(result.data);
    console.log('JSON:', json);
    
    // 序列化为 XML
    const xml = toXml(result.data);
    console.log('XML:', xml);
    
    // 从 JSON 反序列化
    const parsed = fromJson(json);
    if (parsed.success) {
        console.log('解析后的标题:', parsed.data.title);
    }
}
```

## Tauri 集成

### 在前端使用 Tauri 适配器

```typescript
import { invoke } from '@tauri-apps/api/core';
import { createTauriAdapter, registerTauriParser } from './music_tag/tauriAdapter';

// 注册 Tauri 解析器（全局）
registerTauriParser(invoke);

// 创建适配器实例
const adapter = createTauriAdapter(invoke, {
    useBackendParser: true  // 使用后端解析器
});

// 读取元数据
const result = await adapter.readMetadata('/path/to/song.mp3');

if (result.success) {
    console.log('标题:', result.data.title);
}
```

### 批量读取

```typescript
import { createTauriAdapter } from './music_tag/tauriAdapter';

const adapter = createTauriAdapter(invoke);

// 批量读取
const filePaths = [
    '/path/to/song1.mp3',
    '/path/to/song2.flac',
    '/path/to/song3.ogg'
];

const results = await adapter.readMetadataBatch(filePaths);

results.forEach((result, index) => {
    if (result.success) {
        console.log(`文件 ${index + 1}:`, result.data.title);
    } else {
        console.error(`文件 ${index + 1} 读取失败:`, result.error);
    }
});
```

## 批量处理

### 批量读取并处理

```typescript
import { MusicTag } from './music_tag';

const musicTag = new MusicTag();

const filePaths = [
    '/music/song1.mp3',
    '/music/song2.flac',
    '/music/song3.ogg'
];

// 批量读取
const results = await musicTag.readBatch(filePaths);

// 处理结果
const successfulResults = results
    .filter(r => r.success)
    .map(r => r.data);

const failedResults = results
    .filter(r => !r.success);

console.log(`成功: ${successfulResults.length}, 失败: ${failedResults.length}`);

// 按专辑分组
const byAlbum = successfulResults.reduce((acc, metadata) => {
    const albumName = metadata.album.name;
    if (!acc[albumName]) {
        acc[albumName] = [];
    }
    acc[albumName].push(metadata);
    return acc;
}, {});

console.log('按专辑分组:', byAlbum);
```

### 生成播放列表

```typescript
import { MusicTag, toJson } from './music_tag';

async function generatePlaylist(directory: string): Promise<string> {
    const musicTag = new MusicTag();
    
    // 获取目录中的所有音乐文件
    const files = await getMusicFiles(directory); // 你需要实现这个函数
    
    // 批量读取元数据
    const results = await musicTag.readBatch(files);
    
    // 提取成功的结果
    const tracks = results
        .filter(r => r.success)
        .map(r => ({
            title: r.data.title,
            artist: r.data.artists.map(a => a.name).join(', '),
            album: r.data.album.name,
            trackNumber: r.data.trackNumber,
            duration: r.data.duration
        }))
        .sort((a, b) => {
            // 按专辑和音轨号排序
            if (a.album !== b.album) {
                return a.album.localeCompare(b.album);
            }
            return (a.trackNumber || 0) - (b.trackNumber || 0);
        });
    
    return JSON.stringify(tracks, null, 2);
}
```

## 自定义解析器

### 创建自定义解析器

```typescript
import {
    BaseMetadataParser,
    AudioFormat,
    MetadataStandard,
    MusicMetadata,
    ParseResult,
    ParseOptions,
    globalParserRegistry
} from './music_tag';

class MyCustomParser extends BaseMetadataParser {
    readonly name = 'My Custom Parser';
    readonly version = '1.0.0';
    
    constructor() {
        super({
            supportedFormats: [AudioFormat.MP3],
            supportedStandards: [MetadataStandard.ID3V2],
            supportsWriting: false,
            supportsPictures: true,
            supportsLyrics: true
        });
    }
    
    async parse(filePath: string, options?: ParseOptions): Promise<ParseResult<MusicMetadata>> {
        try {
            // 实现你的解析逻辑
            const metadata = await this.parseMyFormat(filePath);
            
            return this.createSuccessResult(metadata);
        } catch (error) {
            return this.createErrorResult(`解析失败: ${error.message}`);
        }
    }
    
    async parseRaw(filePath: string): Promise<ParseResult<RawMetadataEntry[]>> {
        // 实现原始元数据解析
        const rawEntries = await this.extractRawMetadata(filePath);
        return this.createSuccessResult(rawEntries);
    }
    
    private async parseMyFormat(filePath: string): Promise<MusicMetadata> {
        // 你的解析逻辑
        return {
            title: 'Example',
            artists: [{ name: 'Example Artist' }],
            album: { name: 'Example Album' }
        };
    }
    
    private async extractRawMetadata(filePath: string): Promise<RawMetadataEntry[]> {
        // 提取原始元数据
        return [];
    }
}

// 注册解析器
globalParserRegistry.register(new MyCustomParser());
```

### 使用解析器工厂

```typescript
import { ParserFactory, globalParserRegistry } from './music_tag';

const factory = new ParserFactory(globalParserRegistry);

// 为特定文件创建解析器
const parser = factory.createParserForFile('/path/to/song.mp3');

if (parser) {
    const result = await parser.parse('/path/to/song.mp3');
    console.log('解析结果:', result);
}
```

## 与原有 API 的对比

### 原 audiotags API

```rust
// 原有的 Rust 代码
use audiotags::Tag;

let tag = Tag::new().read_from_path("song.mp3")?;
let title = tag.title();
let artists = tag.artists();
let album = tag.album_title();
```

### 新 musicTag API

```rust
// 新的 Rust 代码
use crate::music_tag::MetadataParser;

let parser = MetadataParser::new();
let metadata = parser.parse("song.mp3")?;
let title = &metadata.title;
let artists = &metadata.artists;
let album = &metadata.album.name;
```

### TypeScript API

```typescript
// TypeScript 前端代码
import { readMetadata } from './music_tag';

const result = await readMetadata('song.mp3');
if (result.success) {
    const { title, artists, album } = result.data;
    console.log(title, artists, album.name);
}
```

## 高级用法

### 自定义验证规则

```typescript
import { MetadataValidator, ValidationRule } from './music_tag';

const validator = new MetadataValidator();

// 添加自定义验证规则
const customRule: ValidationRule = {
    name: 'customTitleRule',
    validate: (metadata) => {
        if (metadata.title.length < 3) {
            return {
                field: 'title',
                message: '标题至少需要3个字符',
                code: 'ERR_SHORT_TITLE'
            };
        }
        return null;
    }
};

validator.registerRule(customRule);

// 验证元数据
const result = validator.validate(metadata);
```

### 自定义格式化选项

```typescript
import { MetadataFormatter } from './music_tag';

const formatter = new MetadataFormatter({
    trimWhitespace: true,
    normalizeUnicode: true,
    capitalizeWords: true,
    removeExtraSpaces: true,
    maxTitleLength: 100,
    maxArtistNameLength: 50,
    maxAlbumNameLength: 100
});

const formatted = formatter.format(metadata);
```

## 错误处理

```typescript
import { readMetadata } from './music_tag';

async function safeReadMetadata(filePath: string) {
    try {
        const result = await readMetadata(filePath);
        
        if (!result.success) {
            console.error('读取失败:', result.error);
            return null;
        }
        
        if (result.warnings && result.warnings.length > 0) {
            console.warn('警告:', result.warnings);
        }
        
        return result.data;
    } catch (error) {
        console.error('意外错误:', error);
        return null;
    }
}
```

## 性能优化

### 批量处理大量文件

```typescript
import { MusicTag } from './music_tag';

async function processLargeCollection(filePaths: string[]) {
    const musicTag = new MusicTag();
    const batchSize = 100;
    const results = [];
    
    // 分批处理
    for (let i = 0; i < filePaths.length; i += batchSize) {
        const batch = filePaths.slice(i, i + batchSize);
        const batchResults = await musicTag.readBatch(batch);
        results.push(...batchResults);
        
        // 显示进度
        console.log(`处理进度: ${Math.min(i + batchSize, filePaths.length)}/${filePaths.length}`);
    }
    
    return results;
}
```

---

更多示例和详细文档请参考 [README.md](./README.md)。
