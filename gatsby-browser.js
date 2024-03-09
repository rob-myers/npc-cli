import "src/components/globals.css";
import "flexlayout-react/style/light.css";
import "xterm/css/xterm.css";

export { wrapPageElement } from "./src/components/Root";

import { focusManager } from "@tanstack/react-query";

/**
 * In development refetch on refocus can automate changes.
 * In production, see https://github.com/TanStack/query/pull/4805.
 */
if (process.env.NODE_ENV !== "production") {
  focusManager.setEventListener((handleFocus) => {
    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("focus", handleFocus, false);
    }
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  });
}
