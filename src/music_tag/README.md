# MusicTag 模块

一个高度模块化、去耦化的音乐元数据处理模块，用于替代现有的 audioTags 依赖。

## 特性

- **高度模块化**：采用插件化架构，各组件之间低耦合高内聚
- **类型安全**：完整的 TypeScript 类型定义
- **可扩展性**：支持自定义解析器和序列化器
- **多格式支持**：支持 JSON、XML 等序列化格式
- **验证和格式化**：内置元数据验证和格式化功能
- **Tauri 集成**：提供与 Tauri 后端的适配器

## 架构设计

```
music_tag/
├── src/
│   ├── types.ts          # 核心类型定义
│   ├── parser.ts         # 解析器接口和基础实现
│   ├── validator.ts      # 验证和格式化
│   ├── serializer.ts     # 序列化和反序列化
│   ├── tauriAdapter.ts   # Tauri 适配器
│   ├── index.ts          # 主入口
│   └── __tests__/        # 单元测试
└── README.md
```

## 快速开始

### 基本使用

```typescript
import { MusicTag, readMetadata } from './music_tag';

// 使用默认实例
const result = await readMetadata('/path/to/song.mp3');

if (result.success) {
    console.log(result.data.title);
    console.log(result.data.artists);
}

// 创建自定义实例
const musicTag = new MusicTag({
    defaultEncoding: 'UTF-8',
    strictMode: false,
    logLevel: 'info'
});

const metadata = await musicTag.read('/path/to/song.mp3');
```

### Tauri 集成

```typescript
import { invoke } from '@tauri-apps/api/core';
import { createTauriAdapter, registerTauriParser } from './music_tag/tauriAdapter';

// 注册 Tauri 解析器
registerTauriParser(invoke);

// 或使用适配器
const adapter = createTauriAdapter(invoke);
const result = await adapter.readMetadata('/path/to/song.mp3');
```

## API 文档

### MusicTag 类

主类，提供统一的元数据操作接口。

#### 构造函数

```typescript
constructor(config?: Partial<MusicTagConfig>)
```

#### 方法

- `read(filePath: string, options?: ParseOptions): Promise<ParseResult<MusicMetadata>>`
  - 读取音乐文件元数据

- `readBatch(filePaths: string[], options?: ParseOptions): Promise<ParseResult<MusicMetadata>[]>`
  - 批量读取音乐文件元数据

- `validate(metadata: MusicMetadata): ValidationResult`
  - 验证元数据

- `format(metadata: MusicMetadata): MusicMetadata`
  - 格式化元数据

- `serialize(metadata: MusicMetadata, format: string, options?: SerializeOptions): string`
  - 序列化元数据

- `deserialize(data: string, format: string): ParseResult<MusicMetadata>`
  - 反序列化元数据

### 类型定义

#### MusicMetadata

```typescript
interface MusicMetadata {
    title: string;
    artists: Artist[];
    album: Album;
    trackNumber?: number;
    totalTracks?: number;
    discNumber?: number;
    totalDiscs?: number;
    year?: number;
    genre?: string;
    lyrics?: Lyrics;
    comment?: string;
    composer?: string;
    lyricist?: string;
    pictures?: Picture[];
    duration?: number;
    bitrate?: number;
    sampleRate?: number;
    channels?: number;
}
```

#### Artist

```typescript
interface Artist {
    id?: number;
    name: string;
    aliases?: string[];
}
```

#### Album

```typescript
interface Album {
    id?: number;
    name: string;
    picUrl?: string;
    artist?: string;
    year?: number;
}
```

### 验证器

```typescript
import { MetadataValidator, MetadataCleaner } from './music_tag';

const validator = new MetadataValidator();
const result = validator.validate(metadata);

if (!result.isValid) {
    console.log('验证错误:', result.errors);
}

// 清理元数据
const cleaned = MetadataCleaner.clean(metadata);
```

### 格式化器

```typescript
import { MetadataFormatter } from './music_tag';

const formatter = new MetadataFormatter({
    trimWhitespace: true,
    normalizeUnicode: true,
    removeExtraSpaces: true,
    maxTitleLength: 200
});

const formatted = formatter.format(metadata);
```

### 序列化器

```typescript
import { toJson, fromJson, toXml, SerializationManager } from './music_tag';

// JSON 序列化
const json = toJson(metadata);
const result = fromJson(json);

// XML 序列化
const xml = toXml(metadata);

// 使用管理器
const manager = new SerializationManager();
const yaml = manager.serialize(metadata, 'yaml');
```

## 扩展开发

### 自定义解析器

```typescript
import { BaseMetadataParser, AudioFormat, MetadataStandard } from './music_tag';

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
        // 实现解析逻辑
    }
    
    async parseRaw(filePath: string): Promise<ParseResult<RawMetadataEntry[]>> {
        // 实现原始元数据解析
    }
}

// 注册解析器
import { globalParserRegistry } from './music_tag';
globalParserRegistry.register(new MyCustomParser());
```

### 自定义序列化器

```typescript
import { ISerializer, MusicMetadata, ParseResult } from './music_tag';

class YamlSerializer implements ISerializer {
    readonly name = 'YAML Serializer';
    readonly format = 'yaml';
    
    serialize(metadata: MusicMetadata): string {
        // 实现 YAML 序列化
    }
    
    deserialize(data: string): ParseResult<MusicMetadata> {
        // 实现 YAML 反序列化
    }
    
    supportsFormat(format: string): boolean {
        return format.toLowerCase() === 'yaml';
    }
}
```

## 测试

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test types.test.ts
npm test validator.test.ts
npm test serializer.test.ts
```

## 兼容性

本模块设计为替代原有的 `audiotags` Rust crate，提供兼容的 API 接口。

### 与原 API 的映射

| 原 API (audiotags) | 新 API (musicTag) |
|-------------------|------------------|
| `Tag::new().read_from_path()` | `musicTag.read()` |
| `tag.title()` | `metadata.title` |
| `tag.artists()` | `metadata.artists` |
| `tag.album_title()` | `metadata.album.name` |
| `tag.track_number()` | `metadata.trackNumber` |
| `tag.album_cover()` | `metadata.pictures` |

## 许可证

MIT
