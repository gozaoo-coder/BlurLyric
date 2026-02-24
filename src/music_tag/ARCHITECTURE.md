# MusicTag 模块架构文档

本文档详细描述 musicTag 模块的架构设计和组件关系。

## 架构概览

```mermaid
flowchart TB
    subgraph Frontend["前端 (TypeScript)"]
        MusicTag["MusicTag 主类"]
        Parser["Parser 解析器"]
        Validator["Validator 验证器"]
        Formatter["Formatter 格式化器"]
        Serializer["Serializer 序列化器"]
        TauriAdapter["TauriAdapter 适配器"]
    end

    subgraph Backend["后端 (Rust)"]
        MetadataParser["MetadataParser"]
        ID3Parser["ID3 Parser"]
        VorbisParser["Vorbis Comment Parser"]
        FLACParser["FLAC Parser"]
    end

    subgraph Types["类型定义"]
        MusicMetadata["MusicMetadata"]
        Artist["Artist"]
        Album["Album"]
        Picture["Picture"]
    end

    MusicTag --> Parser
    MusicTag --> Validator
    MusicTag --> Formatter
    MusicTag --> Serializer
    MusicTag --> TauriAdapter

    TauriAdapter --> MetadataParser

    Parser --> Types
    Validator --> Types
    Formatter --> Types
    Serializer --> Types

    MetadataParser --> ID3Parser
    MetadataParser --> VorbisParser
    MetadataParser --> FLACParser
```

## 模块结构

```mermaid
classDiagram
    class MusicTag {
        +config: MusicTagConfig
        +parserRegistry: ParserRegistry
        +validator: MetadataValidator
        +formatter: MetadataFormatter
        +read(filePath): Promise~ParseResult~
        +readBatch(filePaths): Promise~ParseResult[]~
        +validate(metadata): ValidationResult
        +format(metadata): MusicMetadata
        +serialize(metadata, format): string
    }

    class IMetadataParser {
        <<interface>>
        +name: string
        +version: string
        +getCapabilities(): ParserCapabilities
        +parse(filePath, options): Promise~ParseResult~
        +parseRaw(filePath): Promise~ParseResult~
    }

    class BaseMetadataParser {
        <<abstract>>
        #capabilities: ParserCapabilities
        +supportsFormat(format): boolean
        +supportsFile(filePath): boolean
        #createSuccessResult(data): ParseResult
        #createErrorResult(error): ParseResult
    }

    class MetadataValidator {
        -rules: ValidationRule[]
        +registerRule(rule): void
        +removeRule(name): void
        +validate(metadata): ValidationResult
        +isValid(metadata): boolean
    }

    class MetadataFormatter {
        -options: FormatterOptions
        +format(metadata): MusicMetadata
    }

    class SerializationManager {
        -serializers: Map~string, ISerializer~
        +register(serializer): void
        +serialize(metadata, format): string
        +deserialize(data, format): ParseResult
    }

    class TauriMusicTagAdapter {
        -invoke: TauriInvoke
        -validator: MetadataValidator
        -formatter: MetadataFormatter
        +readMetadata(filePath): Promise~ParseResult~
        +readMetadataBatch(filePaths): Promise~ParseResult[]~
        +readAudioFileInfo(filePath): Promise~AudioFileInfo~
        +readAlbumCover(filePath): Promise~Picture~
    }

    class MusicMetadata {
        +title: string
        +artists: Artist[]
        +album: Album
        +trackNumber?: number
        +year?: number
        +genre?: string
        +pictures?: Picture[]
        +duration?: number
        +bitrate?: number
    }

    MusicTag --> IMetadataParser
    MusicTag --> MetadataValidator
    MusicTag --> MetadataFormatter
    MusicTag --> SerializationManager
    MusicTag --> TauriMusicTagAdapter
    
    BaseMetadataParser ..|> IMetadataParser
    
    MusicTag --> MusicMetadata
    MetadataValidator --> MusicMetadata
    MetadataFormatter --> MusicMetadata
    TauriMusicTagAdapter --> MusicMetadata
```

## 数据流

```mermaid
sequenceDiagram
    participant User as 用户代码
    participant MusicTag as MusicTag
    participant Parser as MetadataParser
    participant Validator as Validator
    participant Formatter as Formatter
    participant File as 音频文件

    User->>MusicTag: read(filePath)
    MusicTag->>Parser: parse(filePath)
    Parser->>File: 读取二进制数据
    File-->>Parser: 文件内容
    Parser->>Parser: 解析ID3/Vorbis标签
    Parser-->>MusicTag: MusicMetadata
    MusicTag->>Validator: validate(metadata)
    Validator-->>MusicTag: ValidationResult
    MusicTag->>Formatter: format(metadata)
    Formatter-->>MusicTag: 格式化后的Metadata
    MusicTag-->>User: ParseResult
```

## 解析器架构

```mermaid
flowchart LR
    subgraph ParserRegistry["ParserRegistry 注册表"]
        Registry["全局注册表"]
    end

    subgraph Parsers["解析器实现"]
        ID3["ID3 Parser<br/>MP3文件"]
        Vorbis["Vorbis Parser<br/>FLAC/OGG文件"]
        WAV["WAV Parser<br/>WAV文件"]
        Tauri["Tauri Parser<br/>后端解析"]
    end

    subgraph Factory["工厂模式"]
        ParserFactory["ParserFactory"]
    end

    ID3 --> Registry
    Vorbis --> Registry
    WAV --> Registry
    Tauri --> Registry

    Registry --> ParserFactory
    ParserFactory --> Client["客户端代码"]
```

## 组件职责

### 前端组件 (TypeScript)

| 组件 | 职责 | 关键类/接口 |
|------|------|------------|
| **MusicTag** | 主入口类，提供统一API | `MusicTag` |
| **Parser** | 解析器接口和注册表 | `IMetadataParser`, `ParserRegistry` |
| **Validator** | 元数据验证 | `MetadataValidator`, `ValidationRule` |
| **Formatter** | 元数据格式化 | `MetadataFormatter` |
| **Serializer** | 序列化/反序列化 | `ISerializer`, `SerializationManager` |
| **TauriAdapter** | Tauri后端适配 | `TauriMusicTagAdapter` |

### 后端组件 (Rust)

| 组件 | 职责 | 关键结构体/特性 |
|------|------|----------------|
| **MetadataParser** | 主解析器 | `MetadataParser` |
| **ID3 Parser** | ID3v1/ID3v2标签解析 | `parse_id3v1`, `parse_id3v2` |
| **Vorbis Parser** | Vorbis Comment解析 | `parse_vorbis_comment` |
| **FLAC Parser** | FLAC元数据块解析 | `parse_flac` |
| **Error Handling** | 错误处理 | `MusicTagError` |

## 类型系统

```mermaid
classDiagram
    class MusicMetadata {
        <<interface>>
        +title: string
        +artists: Artist[]
        +album: Album
        +trackNumber?: number
        +discNumber?: number
        +year?: number
        +genre?: string
        +lyrics?: Lyrics
        +comment?: string
        +composer?: string
        +lyricist?: string
        +pictures?: Picture[]
        +duration?: number
        +bitrate?: number
        +sampleRate?: number
        +channels?: number
    }

    class Artist {
        <<interface>>
        +id?: number
        +name: string
        +aliases?: string[]
    }

    class Album {
        <<interface>>
        +id?: number
        +name: string
        +picUrl?: string
        +artist?: string
        +year?: number
    }

    class Picture {
        <<interface>>
        +mimeType: string
        +pictureType: PictureType
        +description: string
        +data: Uint8Array
    }

    class Lyrics {
        <<interface>>
        +content: string
        +language?: string
        +description?: string
    }

    class ParseResult~T~ {
        <<interface>>
        +success: boolean
        +data?: T
        +error?: string
        +warnings?: string[]
    }

    class ValidationResult {
        <<interface>>
        +isValid: boolean
        +errors: ValidationError[]
        +warnings: string[]
    }

    MusicMetadata --> Artist
    MusicMetadata --> Album
    MusicMetadata --> Picture
    MusicMetadata --> Lyrics
```

## 扩展点

模块提供了多个扩展点，便于功能扩展：

### 1. 自定义解析器

```mermaid
flowchart LR
    A[IMetadataParser] -->|实现| B[自定义解析器]
    B -->|注册| C[ParserRegistry]
    C -->|使用| D[MusicTag]
```

### 2. 自定义验证规则

```mermaid
flowchart LR
    A[ValidationRule] -->|注册| B[MetadataValidator]
    B -->|使用| C[MusicTag]
```

### 3. 自定义序列化器

```mermaid
flowchart LR
    A[ISerializer] -->|实现| B[自定义序列化器]
    B -->|注册| C[SerializationManager]
    C -->|使用| D[MusicTag]
```

## 与原有系统的兼容性

```mermaid
flowchart TB
    subgraph Old["原有系统 (audiotags)"]
        OldAPI["Tag::new().read_from_path()"]
        OldFields["tag.title()<br/>tag.artists()<br/>tag.album_title()"]
    end

    subgraph New["新系统 (musicTag)"]
        NewAPI["MetadataParser.parse()"]
        NewFields["metadata.title<br/>metadata.artists<br/>metadata.album.name"]
    end

    subgraph Compatibility["兼容层"]
        Adapter["API适配"]
    end

    OldAPI -->|替换为| NewAPI
    OldFields -->|映射到| NewFields
    NewAPI -->|通过| Adapter
    NewFields -->|通过| Adapter
```

## 目录结构

```
src/music_tag/
├── src/
│   ├── types.ts          # 核心类型定义
│   ├── parser.ts         # 解析器接口和基础实现
│   ├── validator.ts      # 验证和格式化
│   ├── serializer.ts     # 序列化和反序列化
│   ├── tauriAdapter.ts   # Tauri 适配器
│   ├── index.ts          # 主入口
│   └── __tests__/        # 单元测试
│       ├── types.test.ts
│       ├── validator.test.ts
│       └── serializer.test.ts
├── README.md             # 使用文档
├── EXAMPLES.md           # 使用示例
└── ARCHITECTURE.md       # 架构文档

src-tauri/src/music_tag/
├── mod.rs                # 模块入口
├── types.rs              # Rust类型定义
├── parser.rs             # Rust解析器实现
└── error.rs              # 错误处理
```

## 设计原则

1. **单一职责原则 (SRP)**: 每个组件只负责一个功能
2. **开闭原则 (OCP)**: 对扩展开放，对修改关闭
3. **依赖倒置原则 (DIP)**: 依赖抽象而非具体实现
4. **接口隔离原则 (ISP)**: 使用细粒度接口
5. **里氏替换原则 (LSP)**: 子类可替换父类

## 性能考虑

- **懒加载**: 图片和歌词按需解析
- **批量处理**: 支持批量读取减少I/O
- **缓存机制**: 可配置的结果缓存
- **异步处理**: 所有I/O操作均为异步

## 安全性

- **输入验证**: 所有输入都经过验证
- **错误处理**: 完善的错误处理机制
- **资源管理**: 自动资源清理
- **类型安全**: 完整的类型检查
