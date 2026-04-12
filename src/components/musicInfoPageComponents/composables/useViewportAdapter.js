import { ref, computed, readonly, onMounted, onUnmounted } from 'vue';

/**
 * 设备类型枚举
 */
export const DEVICE_TYPES = Object.freeze({
  DESKTOP: 'desktop',
  MOBILE: 'mobile',
  SQUARE: 'square',
  STRIP: 'strip',
  UNSUPPORTED: 'unsupported'
});

/**
 * 显示模式枚举
 */
export const DISPLAY_MODES = Object.freeze({
  ALBUM_ONLY: 'albumOnly',
  LYRIC_ONLY: 'lyricOnly',
  ALBUM_AND_LYRIC: 'albumAndLyric',
  ALBUM_AND_MUSIC_LIST: 'albumAndMusicList'
});

/**
 * 各设备类型允许的显示模式及默认值
 */
const DEVICE_DISPLAY_CONFIG = Object.freeze({
  [DEVICE_TYPES.DESKTOP]: {
    allowed: [
      DISPLAY_MODES.ALBUM_ONLY,
      DISPLAY_MODES.LYRIC_ONLY,
      DISPLAY_MODES.ALBUM_AND_LYRIC,
      DISPLAY_MODES.ALBUM_AND_MUSIC_LIST
    ],
    default: DISPLAY_MODES.ALBUM_AND_LYRIC
  },
  [DEVICE_TYPES.MOBILE]: {
    allowed: [DISPLAY_MODES.ALBUM_ONLY, DISPLAY_MODES.LYRIC_ONLY],
    default: DISPLAY_MODES.ALBUM_ONLY
  },
  [DEVICE_TYPES.SQUARE]: {
    allowed: [DISPLAY_MODES.ALBUM_ONLY],
    default: DISPLAY_MODES.ALBUM_ONLY
  },
  [DEVICE_TYPES.STRIP]: {
    allowed: [DISPLAY_MODES.ALBUM_ONLY],
    default: DISPLAY_MODES.ALBUM_ONLY
  },
  [DEVICE_TYPES.UNSUPPORTED]: {
    allowed: [DISPLAY_MODES.ALBUM_ONLY],
    default: DISPLAY_MODES.ALBUM_ONLY
  }
});

/** 桌面端宽度阈值 */
const DESKTOP_WIDTH_THRESHOLD = 768;

/** 条形设备高度下限 */
const STRIP_HEIGHT_MIN = 100;

/** 条形设备高度上限 */
const STRIP_HEIGHT_MAX = 150;

/** 方形设备高度下限 */
const SQUARE_HEIGHT_MIN = 150;

/** 方形设备宽高比下限 */
const SQUARE_RATIO_MIN = 0.8;

/** 方形设备宽高比上限 */
const SQUARE_RATIO_MAX = 1.2;

/** 防抖延迟（毫秒） */
const RESIZE_DEBOUNCE_MS = 200;

/**
 * 简易防抖函数
 * @param {Function} fn - 需要防抖的函数
 * @param {number} delay - 延迟毫秒数
 * @returns {Function} 防抖后的函数
 */
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
}

/**
 * 根据窗口尺寸检测设备类型
 * @param {number} width - 窗口宽度
 * @param {number} height - 窗口高度
 * @returns {string} 设备类型（DEVICE_TYPES 中的值）
 */
function detectDeviceType(width, height) {
  if (width > DESKTOP_WIDTH_THRESHOLD) {
    return DEVICE_TYPES.DESKTOP;
  }

  if (height >= STRIP_HEIGHT_MIN && height <= STRIP_HEIGHT_MAX) {
    return DEVICE_TYPES.STRIP;
  }

  if (height > SQUARE_HEIGHT_MIN) {
    const ratio = width / height;
    if (ratio >= SQUARE_RATIO_MIN && ratio <= SQUARE_RATIO_MAX) {
      return DEVICE_TYPES.SQUARE;
    }
    return DEVICE_TYPES.MOBILE;
  }

  return DEVICE_TYPES.UNSUPPORTED;
}

/**
 * 视口适配组合式函数
 * 根据窗口尺寸检测设备类型，并提供响应式布局配置
 * @returns {Object} 视口适配相关响应式状态和方法
 */
export function useViewportAdapter() {
  const deviceType = ref(detectDeviceType(
    typeof window !== 'undefined' ? window.innerWidth : 1024,
    typeof window !== 'undefined' ? window.innerHeight : 768
  ));
  const displayMode = ref(DEVICE_DISPLAY_CONFIG[deviceType.value].default);

  /** 设备类型是否为桌面端 */
  const isDesktop = computed(() => deviceType.value === DEVICE_TYPES.DESKTOP);

  /** 设备类型是否为移动端 */
  const isMobile = computed(() => deviceType.value === DEVICE_TYPES.MOBILE);

  /** 设备类型是否为方形 */
  const isSquare = computed(() => deviceType.value === DEVICE_TYPES.SQUARE);

  /** 设备类型是否为条形 */
  const isStrip = computed(() => deviceType.value === DEVICE_TYPES.STRIP);

  /**
   * 处理窗口尺寸变化
   * 检测新设备类型，若发生变化则自动重置显示模式
   */
  const handleResize = () => {
    if (typeof window === 'undefined') return;
    const newType = detectDeviceType(window.innerWidth, window.innerHeight);
    if (newType !== deviceType.value) {
      deviceType.value = newType;
      displayMode.value = DEVICE_DISPLAY_CONFIG[newType].default;
    }
  };

  const debouncedResize = debounce(handleResize, RESIZE_DEBOUNCE_MS);

  /**
   * 手动设置显示模式
   * 仅在当前设备类型允许的模式范围内生效
   * @param {string} mode - 目标显示模式（DISPLAY_MODES 中的值）
   */
  const setDisplayMode = (mode) => {
    const config = DEVICE_DISPLAY_CONFIG[deviceType.value];
    if (config.allowed.includes(mode)) {
      displayMode.value = mode;
    }
  };

  onMounted(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', debouncedResize);
    }
  });

  onUnmounted(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', debouncedResize);
    }
  });

  return {
    deviceType: readonly(deviceType),
    displayMode: readonly(displayMode),
    isDesktop,
    isMobile,
    isSquare,
    isStrip,
    setDisplayMode
  };
}
