import { info } from "../service/generic";

info("🔨 web worker started", import.meta.url);

addEventListener("message", (e) => {
  info("received message", e.data);
});
