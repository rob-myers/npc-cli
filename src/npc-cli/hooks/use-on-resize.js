import React from "react";
import useUpdate from "./use-update";

/**
 * Trigger render on window resize.
 * @param {() => void} [callback]
 */
export default function useOnResize(callback) {
  const update = useUpdate();

  React.useEffect(() => {
    const cb = callback ?? update;
    window.addEventListener("resize", cb);
    return () => window.removeEventListener("resize", cb);
  }, [callback]);
}
