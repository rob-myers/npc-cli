import React from "react";
import useUpdate from "./use-update";

/**
 * Trigger render on window resize.
 */
export default function useOnResize() {
  const update = useUpdate();

  React.useEffect(() => {
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
