export const PlayerEvents = {
    STATE_CHANGE: 'player:stateChange',
    TRACK_CHANGE: 'player:trackChange',
    PLAY_MODE_CHANGE: 'player:playModeChange',

    PLAY: 'player:play',
    PAUSE: 'player:pause',
    PLAY_PAUSE_TOGGLE: 'player:playPauseToggle',

    NEXT: 'player:next',
    PREV: 'player:prev',
    TRACK_SWITCH_START: 'player:trackSwitchStart',
    TRACK_SWITCH_END: 'player:trackSwitchEnd',

    TIME_UPDATE: 'player:timeUpdate',
    DURATION_CHANGE: 'player:durationChange',

    PLAYLIST_REPLACE: 'player:playlistReplace',
    PLAYLIST_PUSH: 'player:playlistPush',
    PLAYLIST_REMOVE: 'player:playlistRemove',
    PLAYLIST_CLEAR: 'player:playlistClear',

    ERROR: 'player:error',

    RESOURCE_LOADING: 'player:resourceLoading',
    RESOURCE_LOADED: 'player:resourceLoaded',
    RESOURCE_ERROR: 'player:resourceError'
};
