export function isTauriEnvironment() {
    return typeof window !== 'undefined' && window.__TAURI__ !== undefined;
}

export function isWebEnvironment() {
    return !isTauriEnvironment();
}

export function getEnvironmentType() {
    return isTauriEnvironment() ? 'tauri' : 'web';
}
