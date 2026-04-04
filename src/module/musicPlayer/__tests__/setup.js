import { vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.performance = {
  now: () => Date.now()
};

Object.defineProperty(global.navigator, 'mediaSession', {
  value: {
    setActionHandler: vi.fn(),
    metadata: null
  },
  writable: true,
  configurable: true
});
