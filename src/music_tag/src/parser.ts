/**
 * MusicTag模块 - 元数据解析器接口和基础实现
 * 
 * 提供可扩展的元数据解析器架构，支持插件化扩展
 */

import {
    AudioFormat,
    MetadataStandard,
    MusicMetadata,
    ParseResult,
    ParseOptions,
    ParserCapabilities,
    RawMetadataEntry,
    AudioFileInfo,
    AUDIO_FORMAT_EXTENSIONS
} from './types';

/**
 * 元数据解析器接口
 * 所有具体解析器必须实现此接口
 */
export interface IMetadataParser {
    /** 解析器名称 */
    readonly name: string;
    /** 解析器版本 */
    readonly version: string;
    
    /**
     * 获取解析器能力
     */
    getCapabilities(): ParserCapabilities;
    
    /**
     * 检查是否支持指定格式
     * @param format 音频格式
     */
    supportsFormat(format: AudioFormat): boolean;
    
    /**
     * 检查是否支持指定文件
     * @param filePath 文件路径
     */
    supportsFile(filePath: string): boolean;
    
    /**
     * 解析元数据
     * @param filePath 文件路径
     * @param options 解析选项
     */
    parse(filePath: string, options?: ParseOptions): Promise<ParseResult<MusicMetadata>>;
    
    /**
     * 解析原始元数据
     * @param filePath 文件路径
     */
    parseRaw(filePath: string): Promise<ParseResult<RawMetadataEntry[]>>;
}

/**
 * 抽象基础解析器类
 * 提供通用功能的基类实现
 */
export abstract class BaseMetadataParser implements IMetadataParser {
    abstract readonly name: string;
    abstract readonly version: string;
    
    protected capabilities: ParserCapabilities;
    
    constructor(capabilities: ParserCapabilities) {
        this.capabilities = capabilities;
    }
    
    getCapabilities(): ParserCapabilities {
        return { ...this.capabilities };
    }
    
    supportsFormat(format: AudioFormat): boolean {
        return this.capabilities.supportedFormats.includes(format);
    }
    
    supportsFile(filePath: string): boolean {
        const ext = this.getFileExtension(filePath).toLowerCase();
        const format = AUDIO_FORMAT_EXTENSIONS[ext];
        return format !== undefined && this.supportsFormat(format);
    }
    
    abstract parse(filePath: string, options?: ParseOptions): Promise<ParseResult<MusicMetadata>>;
    
    abstract parseRaw(filePath: string): Promise<ParseResult<RawMetadataEntry[]>>;
    
    /**
     * 获取文件扩展名
     */
    protected getFileExtension(filePath: string): string {
        const lastDotIndex = filePath.lastIndexOf('.');
        return lastDotIndex !== -1 ? filePath.slice(lastDotIndex) : '';
    }
    
    /**
     * 获取文件名（不含扩展名）
     */
    protected getFileNameWithoutExt(filePath: string): string {
        const lastSlashIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
        const fileName = lastSlashIndex !== -1 ? filePath.slice(lastSlashIndex + 1) : filePath;
        const lastDotIndex = fileName.lastIndexOf('.');
        return lastDotIndex !== -1 ? fileName.slice(0, lastDotIndex) : fileName;
    }
    
    /**
     * 创建成功结果
     */
    protected createSuccessResult<T>(data: T, warnings?: string[]): ParseResult<T> {
        return {
            success: true,
            data,
            warnings: warnings || []
        };
    }
    
    /**
     * 创建失败结果
     */
    protected createErrorResult<T>(error: string): ParseResult<T> {
        return {
            success: false,
            error
        };
    }
}

/**
 * 解析器注册表
 * 管理所有可用的解析器
 */
export class ParserRegistry {
    private parsers: Map<string, IMetadataParser> = new Map();
    private formatParsers: Map<AudioFormat, IMetadataParser[]> = new Map();
    
    /**
     * 注册解析器
     * @param parser 解析器实例
     */
    register(parser: IMetadataParser): void {
        this.parsers.set(parser.name, parser);
        
        // 按格式索引
        for (const format of parser.getCapabilities().supportedFormats) {
            if (!this.formatParsers.has(format)) {
                this.formatParsers.set(format, []);
            }
            this.formatParsers.get(format)!.push(parser);
        }
    }
    
    /**
     * 注销解析器
     * @param name 解析器名称
     */
    unregister(name: string): void {
        const parser = this.parsers.get(name);
        if (!parser) return;
        
        this.parsers.delete(name);
        
        // 从格式索引中移除
        for (const format of parser.getCapabilities().supportedFormats) {
            const parsers = this.formatParsers.get(format);
            if (parsers) {
                const index = parsers.indexOf(parser);
                if (index !== -1) {
                    parsers.splice(index, 1);
                }
            }
        }
    }
    
    /**
     * 获取解析器
     * @param name 解析器名称
     */
    getParser(name: string): IMetadataParser | undefined {
        return this.parsers.get(name);
    }
    
    /**
     * 获取支持指定格式的所有解析器
     * @param format 音频格式
     */
    getParsersForFormat(format: AudioFormat): IMetadataParser[] {
        return this.formatParsers.get(format) || [];
    }
    
    /**
     * 获取支持指定文件的所有解析器
     * @param filePath 文件路径
     */
    getParsersForFile(filePath: string): IMetadataParser[] {
        const ext = this.getFileExtension(filePath).toLowerCase();
        const format = AUDIO_FORMAT_EXTENSIONS[ext];
        if (!format) return [];
        return this.getParsersForFormat(format);
    }
    
    /**
     * 获取所有已注册解析器
     */
    getAllParsers(): IMetadataParser[] {
        return Array.from(this.parsers.values());
    }
    
    /**
     * 检查是否有解析器支持指定格式
     * @param format 音频格式
     */
    hasParserForFormat(format: AudioFormat): boolean {
        const parsers = this.formatParsers.get(format);
        return parsers !== undefined && parsers.length > 0;
    }
    
    /**
     * 检查是否有解析器支持指定文件
     * @param filePath 文件路径
     */
    hasParserForFile(filePath: string): boolean {
        return this.getParsersForFile(filePath).length > 0;
    }
    
    /**
     * 清空所有解析器
     */
    clear(): void {
        this.parsers.clear();
        this.formatParsers.clear();
    }
    
    private getFileExtension(filePath: string): string {
        const lastDotIndex = filePath.lastIndexOf('.');
        return lastDotIndex !== -1 ? filePath.slice(lastDotIndex) : '';
    }
}

/**
 * 全局解析器注册表实例
 */
export const globalParserRegistry = new ParserRegistry();

/**
 * 解析器工厂
 * 用于创建和管理解析器实例
 */
export class ParserFactory {
    private registry: ParserRegistry;
    
    constructor(registry: ParserRegistry = globalParserRegistry) {
        this.registry = registry;
    }
    
    /**
     * 创建适合指定文件的解析器
     * @param filePath 文件路径
     */
    createParserForFile(filePath: string): IMetadataParser | null {
        const parsers = this.registry.getParsersForFile(filePath);
        // 返回优先级最高的解析器（第一个）
        return parsers.length > 0 ? parsers[0] : null;
    }
    
    /**
     * 创建适合指定格式的解析器
     * @param format 音频格式
     */
    createParserForFormat(format: AudioFormat): IMetadataParser | null {
        const parsers = this.registry.getParsersForFormat(format);
        return parsers.length > 0 ? parsers[0] : null;
    }
}

/**
 * 文件格式检测器
 */
export class FormatDetector {
    /**
     * 从文件路径检测音频格式
     * @param filePath 文件路径
     */
    static detectFromPath(filePath: string): AudioFormat {
        const ext = this.getFileExtension(filePath).toLowerCase();
        return AUDIO_FORMAT_EXTENSIONS[ext] || AudioFormat.UNKNOWN;
    }
    
    /**
     * 检查是否为支持的音频格式
     * @param filePath 文件路径
     */
    static isSupportedFormat(filePath: string): boolean {
        const format = this.detectFromPath(filePath);
        return format !== AudioFormat.UNKNOWN;
    }
    
    private static getFileExtension(filePath: string): string {
        const lastDotIndex = filePath.lastIndexOf('.');
        return lastDotIndex !== -1 ? filePath.slice(lastDotIndex) : '';
    }
}

/**
 * 音频文件信息读取器
 */
export class AudioFileInfoReader {
    /**
     * 读取音频文件基本信息
     * @param filePath 文件路径
     */
    static async readInfo(filePath: string): Promise<AudioFileInfo> {
        // 在浏览器环境中，这需要通过Tauri API或其他方式获取
        // 这里提供接口定义，具体实现需要根据环境调整
        const format = FormatDetector.detectFromPath(filePath);
        
        return {
            path: filePath,
            format,
            size: 0 // 需要通过文件系统API获取
        };
    }
}
