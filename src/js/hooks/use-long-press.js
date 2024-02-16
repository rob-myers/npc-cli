import React from "react";

/**
 * Based on https://stackoverflow.com/a/54749871/2917822
 * Invokes `config.onClick` if press isn't long enough.
 * @param {Config} config
 */
export default function useLongPress(config) {
  const ms = config.ms ?? 0;
  const timerId = React.useRef(-1);
  const epochMs = React.useRef(-1);
  return {
    onMouseDown() {
      timerId.current = window.setTimeout(config.onLongPress, config.ms);
      epochMs.current = Date.now();
    },
    onTouchStart() {
      timerId.current = window.setTimeout(config.onLongPress, config.ms);
      epochMs.current = Date.now();
    },
    /** @param {React.MouseEvent} e */
    onMouseUp(e) {
      clearTimeout(timerId.current);
      Date.now() - epochMs.current < ms && config.onClick?.(e);
    },
    /** @param {React.TouchEvent} e */
    onTouchEnd(e) {
      clearTimeout(timerId.current);
      Date.now() - epochMs.current < ms && config.onClick?.(e);
    },
    onMouseLeave() {
      clearTimeout(timerId.current);
    },
  };
}

/**
 * @typedef Config
 * @property {() => void} onLongPress
 * @property {(e: React.MouseEvent | React.TouchEvent) => void} [onClick]
 * @property {number} [ms]
 */
