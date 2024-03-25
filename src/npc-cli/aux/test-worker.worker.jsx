import { render } from "@react-three/offscreen";
import Scene from "./TestWorkerScene";
import { info } from "../service/generic";

info("🔨 web worker started", import.meta.url);

// /* eslint-disable-next-line no-restricted-globals */
// self.addEventListener('message', (e) => {
//   console.log('worker received message', e.data);
// });

render(Scene);
