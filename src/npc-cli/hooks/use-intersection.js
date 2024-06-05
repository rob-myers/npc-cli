import React from "react";

/**
 * Based on:
 * > https://usehooks-ts.com/react-hook/use-intersection-observer#:~:text=This%20React%20Hook%20detects%20visibility,element%20(from%20useRef()%20).
 * @param {Opts} opts
 */
export default function useIntersection({
  elRef,
  cb,
  trackVisible,
  threshold = 0, root = null, rootMargin = '0%',
}) {
  const el = elRef();

  React.useEffect(() => {
    const onVisibilityChange = () => trackVisible && document.visibilityState === 'hidden' && cb(false);
    document.addEventListener('visibilitychange', onVisibilityChange);

    // const onWindowBlur = () => trackVisible && cb(false);
    // window.addEventListener('blur', onWindowBlur);

    if (!window.IntersectionObserver || !el) {
      return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        /**
         * Remounting can trigger an observation with
         * `isIntersecting` false before we can unobserve.
         * Thankfully we can catch it here.
         */
        const currEl = elRef();
        if (entry.target !== currEl) {
          observer.unobserve(entry.target);
          currEl && observer.observe(currEl);
        } else {
          cb(entry.isIntersecting, entry);
        }
      },
      { threshold, root, rootMargin },
    );
    observer.observe(el);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      // window.removeEventListener('blur', onWindowBlur);
      observer.disconnect();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el, JSON.stringify(threshold), root, rootMargin])

}

/**
 * @typedef ExtraOpts
 * @property {() => HTMLElement | null} elRef
 * @property {(intersects: boolean, entry?: IntersectionObserverEntry) => void} cb
 * @property {boolean} [trackVisible]
 * Invokes `cb(false)` when document.visibleState is `hidden` e.g. switch tab
 * 
 * @typedef {IntersectionObserverInit & ExtraOpts} Opts
 */
