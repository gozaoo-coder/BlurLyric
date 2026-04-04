import { TransitionStrategy } from './TransitionStrategy';
import { AudioEngine } from '../core/AudioEngine';

class VolumeFader {
    static fade(audioEngine, fromVolume, toVolume, durationMs, onUpdate, onComplete) {
        if (durationMs <= 0) {
            audioEngine.volume = toVolume;
            onComplete?.();
            return () => {};
        }

        const startTime = performance.now();
        let animFrameId = null;
        let cancelled = false;

        const step = (now) => {
            if (cancelled) return;

            const elapsed = now - startTime;
            const progress = Math.min(elapsed / durationMs, 1);

            const currentVol = fromVolume + (toVolume - fromVolume) * progress;
            audioEngine.volume = Math.max(0, Math.min(1, currentVol));

            onUpdate?.(progress);

            if (progress < 1) {
                animFrameId = requestAnimationFrame(step);
            } else {
                audioEngine.volume = toVolume;
                onComplete?.();
            }
        };

        animFrameId = requestAnimationFrame(step);

        return () => {
            cancelled = true;
            if (animFrameId !== null) {
                cancelAnimationFrame(animFrameId);
                animFrameId = null;
            }
        };
    }
}

class TransitionNextMusic extends TransitionStrategy {
    execute(player, targetIndex, options = {}) {
        return new Promise((resolve) => {
            const oldEngine = player.audioEngine;
            if (!oldEngine || !oldEngine.isActive) {
                this._instantSwitch(player, targetIndex);
                resolve();
                return;
            }

            const oldDuration = oldEngine.duration;
            const oldCurrentTime = oldEngine.currentTime;

            let transitionDuration;
            if (options.transitionDuration !== undefined) {
                transitionDuration = options.transitionDuration;
            } else if (options.leastTime !== undefined) {
                transitionDuration = options.leastTime;
            } else if (isFinite(oldDuration) && oldDuration > 0) {
                transitionDuration = Math.max(100, (oldDuration - oldCurrentTime) * 1000);
            } else {
                transitionDuration = 1000;
            }

            transitionDuration = Math.max(50, Math.min(transitionDuration, 15000));

            player.switchToIndex(targetIndex);
            
            const targetVolume = player.state.volume;
            
            player._replaceAudioEngine(new AudioEngine());
            const transitionEngine = player.audioEngine;
            
            transitionEngine.volume = 0;
            player.loadCurrentTrack().then(() => {
                player.play();

                const cancelNewFade = VolumeFader.fade(
                    transitionEngine,
                    0,
                    targetVolume,
                    transitionDuration,
                    null,
                    null
                );

                const cancelOldFade = VolumeFader.fade(
                    oldEngine,
                    targetVolume,
                    0,
                    transitionDuration,
                    null,
                    () => {
                        try { oldEngine.destroy(); } catch {}
                        resolve();
                    }
                );

                player._activeTransitions = player._activeTransitions || [];
                player._activeTransitions.push(cancelNewFade, cancelOldFade);
            }).catch(() => {
                try { oldEngine.destroy(); } catch {}
                this._instantSwitch(player, targetIndex);
                resolve();
            });
        });
    }

    _instantSwitch(player, targetIndex) {
        if (player.audioEngine) {
            try { player.audioEngine.destroy(); } catch {}
        }
        player.switchToIndex(targetIndex);
        player.loadCurrentTrack().then(() => player.play()).catch(() => {});
    }
}

class InstantSwitch extends TransitionStrategy {
    async execute(player, targetIndex) {
        if (player.audioEngine) {
            try { player.audioEngine.destroy(); } catch {}
        }
        player._cancelActiveTransitions?.();
        player.switchToIndex(targetIndex);
        await player.loadCurrentTrack();
        player.play();
    }
}

export { TransitionNextMusic, InstantSwitch, VolumeFader };
