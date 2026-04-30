import { AbstractStrategy } from './index.js';

/**
 * FixedStrategy - 固定歌单策略
 * 永不自动增长，适用于用户主动管理的普通歌单
 */
class FixedStrategy extends AbstractStrategy {
    constructor(options = {}) {
        super('fixed', options);
    }

    shouldGrow() {
        return false;
    }

    async fetchNext() {
        return [];
    }
}

export { FixedStrategy };
