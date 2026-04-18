/**
 * Trace - 来源追踪模型
 */
export class Trace {
    constructor(data) {
        this.sourceType = data.sourceType;
        this.sourceID = data.sourceID;
        this.objectInfo = data.objectInfo;
    }

    static fromRaw(rawData) {
        return new Trace(rawData);
    }

    /**
     * 检查是否为本地资源
     */
    isLocal() {
        return this.sourceType === 'StorageSource';
    }

    /**
     * 检查是否为 API 资源
     */
    isApi() {
        return this.sourceType === 'APISource';
    }

    /**
     * 生成 Trace 唯一键
     */
    get key() {
        return `${this.sourceType}:${this.sourceID}:${this.objectInfo.type}:${this.objectInfo.id}`;
    }

    /**
     * 获取详细信息
     */
    get details() {
        return this.objectInfo.details || {};
    }

    /**
     * 导航到来源数据
     */
    async navigateToSource() {
        // 具体实现由 SourceManager 处理
        throw new Error('navigateToSource must be implemented by SourceManager');
    }

    /**
     * 序列化
     */
    toJSON() {
        return {
            sourceType: this.sourceType,
            sourceID: this.sourceID,
            objectInfo: this.objectInfo
        };
    }
}