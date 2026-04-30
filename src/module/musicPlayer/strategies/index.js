/**
 * AbstractStrategy - 歌单增长策略基类
 *
 * 策略模式：不同歌单类型（用户手动、FM智能推荐等）可注入不同的增长策略。
 * 当播放到歌单末尾附近时，策略决定是否自动补充新曲目。
 */
class AbstractStrategy {
    /**
     * @param {string} identifier 策略标识符
     * @param {Object} [options] 配置
     */
    constructor(identifier, options = {}) {
        this.identifier = identifier;
        this.options = options;
    }

    /**
     * 获取策略标识符
     */
    get id() { return this.identifier; }

    /**
     * 获取用于补充的新曲目
     * @param {Array} playlist 当前歌单
     * @returns {Promise<Array>} 新曲目数组（可为空）
     */
    async fetchNext(playlist) {
        return [];
    }

    /**
     * 判断是否应触发增长
     * @param {Array} playlist 当前歌单
     * @param {number} currentIndex 当前播放索引
     * @param {string} playMode 当前播放模式
     * @returns {boolean}
     */
    shouldGrow(playlist, currentIndex, playMode) {
        return false;
    }

    /**
     * 重置策略内部状态
     */
    reset() {}
}

export { AbstractStrategy };
