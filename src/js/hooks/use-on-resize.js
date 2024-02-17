import React from "react";

/**
 * Trigger render on window resize.
 */
export default function useOnResize() {
  const [, setState] = React.useState(0);

  React.useEffect(() => {
    function onResize() {
      setState((x) => x + 1);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
}
