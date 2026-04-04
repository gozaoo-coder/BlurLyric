import { MusicPlayer } from './core/MusicPlayer';
export { MusicPlayer } from './core/MusicPlayer';
export { AudioEngine } from './core/AudioEngine';
export { PlayMode, PlayModeLabels, PlayModeManager } from './core/PlayMode';
export { createPlayerState, formatTime } from './core/PlayerState';

export { PlaylistOperations, PlaylistManager } from './playlist/PlaylistOperations';
export { SmartPlaylist } from './playlist/SmartPlaylist';

export { TransitionStrategy } from './transition/TransitionStrategy';
export { TransitionNextMusic, InstantSwitch, VolumeFader } from './transition/TransitionNextMusic';

export { PlayerEventBus } from './events/PlayerEventBus';
export { PlayerEvents } from './events/PlayerEvents';

export async function createPlayer(options = {}) {
    return MusicPlayer.create(options);
}
