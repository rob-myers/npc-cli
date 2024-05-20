import React from "react";
import { css } from "@emotion/css";
import { clamp } from "three/src/math/MathUtils";

import useStateRef from "../hooks/use-state-ref";
import { TestWorldContext } from "./test-world-context";

export default function TestContextMenu() {

  const api = React.useContext(TestWorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    menuEl: /** @type {*} */ (null),
    isOpen: false,
    justOpen: false,
    hide() {
      state.menuEl.style.visibility = "hidden";
      state.isOpen = false;
    },
    show(at) {
      const menuDim = state.menuEl.getBoundingClientRect();
      const canvasDim = api.view.canvasEl.getBoundingClientRect();
      const x = clamp(at.x, 0, canvasDim.width - menuDim.width);
      const y = clamp(at.y, 0, canvasDim.height - menuDim.height);
      state.menuEl.style.transform = `translate(${x}px, ${y}px)`;
      state.menuEl.style.visibility = "visible";
      state.isOpen = true;
    },
  }));

  api.menu = state;

  return (
    <div
      ref={(x) => x && (state.menuEl = x)}
      className={contextMenuCss}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div>ContextMenu</div>
      <select defaultValue={undefined} style={{ width: "100%" }}>
        <option>demo select</option>
        <option value="foo">foo</option>
        <option value="bar">bar</option>
        <option value="baz">baz</option>
      </select>
    </div>
  );
}

const contextMenuCss = css`
  position: absolute;
  left: 0;
  top: 0;
  z-index: 0;
  height: 100px;
  user-select: none;

  visibility: hidden;
  opacity: 0.8;

  font-size: 0.9rem;
  color: white;
  background-color: #222;
  border-radius: 5px;
  border: 2px solid #aaa;

  padding: 8px;

  select {
    color: black;
    max-width: 100px;
    margin: 8px 0;
  }
`;

/**
 * @typedef State
 * @property {boolean} isOpen
 * @property {boolean} justOpen
 * @property {HTMLDivElement} menuEl
 * @property {() => void} hide
 * @property {(at: Geom.VectJson) => void} show
 */
