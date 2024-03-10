import "src/components/globals.css";
import "flexlayout-react/style/light.css";
import "xterm/css/xterm.css";

export { wrapPageElement } from "./src/components/Root";

import { focusManager } from "@tanstack/react-query";
import { DEV_WEBSOCKET_PORT } from "./src/const";
import { info } from "./src/npc-cli/service/generic";

/**
 * In development refetch on refocus can automate changes.
 * In production, see https://github.com/TanStack/query/pull/4805.
 */
if (process.env.NODE_ENV !== "production") {
  focusManager.setEventListener((handleFocus) => {
    if (typeof window === "undefined" || !window.addEventListener || !window.EventSource) {
      return;
    }

    window.addEventListener("focus", handleFocus, false);

    const wsClient = new WebSocket(`ws://localhost:${DEV_WEBSOCKET_PORT}/dev-events`);
    wsClient.onmessage = (e) => {
      info("/dev-events message:", e);
    };

    return () => {
      window.removeEventListener("focus", handleFocus);
      wsClient.close();
    };
  });
}
