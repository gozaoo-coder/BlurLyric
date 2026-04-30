/**
 * Animation Pipeline — 独立动画管线
 *
 * 管理 musicInfoPage 的位置切换动画（bottom ↔ top），
 * 解决竞态、泄漏和重复注册问题。
 *
 * ## 解决的问题
 *
 * 1. **死锁/竞态**：旧版用 Date.now() 时间戳判断动画是否仍有效，
 *    快速连续触发时存在问题。改用「撤销令牌(token)」模式，
 *    每个新动画立即撤销上一个未完成的动画。
 * 2. **监听器泄漏**：cancelCoverBindReg 在 $nextTick 中注册，
 *    toBottom 调用时若 nextTick 未触发则解绑无效。
 *    改用 requestAnimationFrame + 令牌解决。
 * 3. **双重 beforeUnmount**：Options API 重复声明覆盖问题，
 *    统一由管线 destroy() 清理。
 * 4. **管线分离**：所有动画逻辑集中在单文件，组件只做编排。
 */

import anime from 'animejs';
import drag from './drag';

/** 位置枚举 */
export const Position = Object.freeze({
  BOTTOM: 'bottom',
  TOP: 'top',
  TO_BOTTOM: 'toBottom',
  TO_TOP: 'toTop',
});

/* ── 内部工具 ── */

function createToken() {
  let revoked = false;
  const onRevokeFns = [];
  return {
    get revoked() { return revoked; },
    revoke() {
      if (revoked) return;
      revoked = true;
      let fn;
      while ((fn = onRevokeFns.shift())) fn();
    },
    onRevoke(fn) { if (!revoked) onRevokeFns.push(fn); },
  };
}

function safeSet(target, params) {
  if (target) anime.set(target, params);
}

function safeAnime(target, params) {
  if (!target) return null;
  return anime({ targets: target, ...params });
}

/**
 * 创建动画管线实例
 *
 * @param {Object} options
 * @param {{ value: string }}  options.position       — 位置状态 ref
 * @param {{ value: any }}     options.dragInfo        — 拖拽信息 ref
 * @param {Object}             options.refs            — DOM refs 对象
 * @param {Object}             options.styleTarget     — 用于 transformX 动画的 plain obj
 * @param {Function}           options.regResizeHandle — 从父级注入
 * @param {Function}           options.onNextTrack     — 切下一首
 * @param {Function}           options.onPrevTrack     — 切上一首
 * @returns {{ toTop, toBottom, destroy }}
 */
export function createAnimationPipeline({
  position,
  dragInfo,
  refs,
  styleTarget,
  regResizeHandle,
  onNextTrack,
  onPrevTrack,
}) {
  /* ══════════ 内部状态 ══════════ */
  let currentToken = createToken();
  const cleanups = [];
  let cancelCoverBind = null;

  /* ══════════ 清理 ══════════ */
  function runCleanups() {
    let fn;
    while ((fn = cleanups.shift())) {
      try { fn(); } catch (_) { /* skip */ }
    }
  }

  function cancelActive() {
    currentToken.revoke();
    currentToken = createToken();
  }

  /* ══════════ 封面绑定（rAF 替代 $nextTick，消除异步竞态） ══════════ */

  function doCoverBind(speed) {
    const placeholder = refs.coverImagePlaceHolder;
    const coverEl = refs.cover;
    const pageRow = refs.musicInfoPageRow;
    if (!placeholder || !coverEl) return;
    safeSet(pageRow, { translateY: -document.body.offsetHeight + 'px' });
    const rect = placeholder.getBoundingClientRect();
    safeAnime(coverEl, {
      easing: 'spring(1, 80, 15,' + speed + ')',
      width: rect.width,
      height: rect.height,
      translateY: (placeholder.offsetTop + 41) + 'px',
      translateX: rect.x + 'px',
    });
  }

  function bindCoverWithResize(token, speed) {
    requestAnimationFrame(() => {
      if (token.revoked) return;
      doCoverBind(speed);

      if (regResizeHandle && !cancelCoverBind) {
        const reg = regResizeHandle('coverMove', () => {
          if (token.revoked) return;
          doCoverBind('0');
        });
        cancelCoverBind = reg ? reg.cancelReg : null;
      }
    });
  }

  /* ══════════ 带撤销的 setTimeout ══════════ */

  function delay(token, ms, fn) {
    const id = setTimeout(() => { if (!token.revoked) fn(); }, ms);
    token.onRevoke(() => clearTimeout(id));
  }

  /* ══════════ Drag 监听器（函数声明提升，可互相引用） ══════════ */

  function registerBottomDrag(token) {
    const bar = refs.musicControlBar;
    if (!bar) return () => {};

    let lastTransformX = 0;
    let springInstance = null;

    const { destroy: destroyDrag } = drag.create(bar,
      // onStart
      (info) => {
        if (token.revoked) return;
        if (springInstance) { springInstance.pause(); springInstance = null; }
        lastTransformX = styleTarget ? styleTarget.transformX : 0;
        safeSet(refs.musicInfoPageRow, { backdropFilter: 'blur(30px)' });
        dragInfo.value = info;
      },
      // onMove
      (info) => {
        if (token.revoked) return;
        if (info.offsetDirectionX !== 'none' && styleTarget) {
          styleTarget.transformX = info.offsetX + lastTransformX;
        }
        dragInfo.value = info;
      },
      // onEnd
      (info) => {
        if (token.revoked) return;
        dragInfo.value = null;

        // 垂直上滑 → toTop
        if (info.offsetY < -100 || info.speedY < -1.5) {
          if (navigator.vibrate) navigator.vibrate(50);
          // toTop 与 registerBottomDrag 在同一作用域，hoisted
          toTop(info);
          return;
        }
        // 水平滑动 → 切歌
        if (info.offsetX < -100 || info.speedX < -1) {
          if (navigator.vibrate) navigator.vibrate(50);
          if (onNextTrack) onNextTrack();
          return;
        }
        if (info.offsetX > 100 || info.speedX > 1) {
          if (navigator.vibrate) navigator.vibrate(50);
          if (onPrevTrack) onPrevTrack();
          return;
        }
        // 水平位移不足 → 回弹
        if (styleTarget) {
          springInstance = safeAnime(styleTarget, {
            transformX: 0,
            easing: 'spring(1, 80, 14, 0)',
          });
        }
      },
    );
    return destroyDrag;
  }

  function registerTopDrag(token) {
    const coverEl = refs.cover;
    if (!coverEl) return () => {};

    const { destroy: destroyDrag } = drag.create(coverEl,
      (info) => { if (!token.revoked) dragInfo.value = info; },
      (info) => { if (!token.revoked) dragInfo.value = info; },
      // onEnd — 下拉 → toBottom
      (info) => {
        if (token.revoked) return;
        if (info.offsetY > 100 || info.speedY > 1.5) {
          if (navigator.vibrate) navigator.vibrate(50);
          toBottom(info);
        }
      },
    );
    return destroyDrag;
  }

  /* ══════════ 主切面方法 ══════════ */

  /**
   * 展开到顶部（全屏播放页）
   */
  function toTop(info) {
    cancelActive();
    const token = currentToken;

    runCleanups();
    if (cancelCoverBind) {
      try { cancelCoverBind(); } catch (_) {}
      cancelCoverBind = null;
    }

    position.value = Position.TO_TOP;

    const pageRow = refs.musicInfoPageRow;
    const ctrlBar = refs.musicControlBar;
    const mainContainer = refs.mainContainer;

    safeAnime(pageRow, {
      easing: 'spring(1, 80, 16,' + Math.abs(info.speedY).toFixed(2) + ')',
      translateY: -document.body.offsetHeight + 'px',
      complete: () => { if (!token.revoked) position.value = Position.TOP; },
    });
    safeAnime(ctrlBar, { opacity: 0, easing: 'linear', duration: 100 });
    if (styleTarget) {
      safeAnime(styleTarget, { transformX: 1, easing: 'linear', duration: 100 });
    }

    delay(token, 300, () => {
      safeSet(pageRow, { background: 'rgb(233,233,233)', backdropFilter: 'blur(0px)' });
    });
    delay(token, 100, () => {
      safeAnime(mainContainer, { opacity: 1, easing: 'linear', duration: 100 });
    });

    bindCoverWithResize(token, Math.abs(info.speedY).toFixed(2));
    cleanups.push(registerTopDrag(token));
  }

  /**
   * 收到底部（迷你播放栏）
   */
  function toBottom(info) {
    cancelActive();
    const token = currentToken;

    if (cancelCoverBind) {
      try { cancelCoverBind(); } catch (_) {}
      cancelCoverBind = null;
    }
    runCleanups();
    position.value = Position.TO_BOTTOM;

    const pageRow = refs.musicInfoPageRow;
    const coverEl = refs.cover;
    const mainContainer = refs.mainContainer;
    const ctrlBar = refs.musicControlBar;

    safeSet(pageRow, {
      background: 'rgba(0, 0, 0, 0.0625)',
      backdropFilter: 'blur(30px)',
    });
    safeAnime(pageRow, {
      easing: 'spring(1, 80, 16,' + Math.abs(info.speedY).toFixed(2) + ')',
      translateY: -88,
      complete: () => { if (!token.revoked) position.value = Position.BOTTOM; },
    });

    delay(token, 300, () => {
      safeAnime(ctrlBar, { opacity: 1, easing: 'linear', duration: 100 });
    });
    safeAnime(mainContainer, { opacity: 0, easing: 'linear', duration: 100 });
    safeAnime(coverEl, {
      width: 54, height: 54,
      easing: 'spring(1, 80, 15,' + Math.abs(info.speedY).toFixed(2) + ')',
      translateY: 17, translateX: 17,
    });

    cleanups.push(registerBottomDrag(token));
  }

  /**
   * 销毁管线，清理所有残留
   */
  function destroy() {
    currentToken.revoke();
    runCleanups();
    if (cancelCoverBind) {
      try { cancelCoverBind(); } catch (_) {}
      cancelCoverBind = null;
    }
  }

  /* ══════════ 初始拖拽注册 ══════════ */
  if (position.value === Position.BOTTOM || position.value === Position.TO_BOTTOM) {
    cleanups.push(registerBottomDrag(currentToken));
  } else {
    cleanups.push(registerTopDrag(currentToken));
  }

  return { toTop, toBottom, destroy };
}

export default createAnimationPipeline;
