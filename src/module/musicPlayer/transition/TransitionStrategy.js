export class TransitionStrategy {
    async execute(player, targetIndex, options = {}) {
        throw new Error('TransitionStrategy.execute() must be implemented by subclass');
    }
}
