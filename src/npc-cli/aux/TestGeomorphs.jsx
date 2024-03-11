import React from "react";
import { TestCanvasContext } from "./test-canvas-context";

/**
 * @param {Props} props
 */
export default function TestGeomorphs(props) {
  const api = /** @type {import("./TestScene").Api} */ (React.useContext(TestCanvasContext));

  return null;
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 */
