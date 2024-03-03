import React from "react";
import { render } from '@react-three/offscreen';
import Scene from "./TestWorkerScene";

// /* eslint-disable-next-line no-restricted-globals */
// self.addEventListener('message', (e) => {
//   console.log('worker received message', e.data);
// });

render(<Scene />);
