import React from "react";
import { css } from "@emotion/css";

import useStateRef from "../hooks/use-state-ref";
import { TestWorldContext } from "./test-world-context";

export default function TestContextMenu() {

  const state = useStateRef(/** @returns {State} */ () => ({
    menuEl: /** @type {*} */ (null),
  }));

  const api = React.useContext(TestWorldContext);

  React.useEffect(() => {
    const sub = api.events.subscribe((e) => {
      // console.log("event", e);

      switch (e.key) {
        case "pointerdown":
          state.menuEl.style.display = "none";
          break;
        case "pointerup":
        case "pointerup-outside":
          // show/hide ContextMenu
          // 🚧 double-tap instead of long-press
          if ((e.rmb || e.longPress) && e.distance <= 5) {
            state.menuEl.style.transform = `translate(${e.screenPoint.x}px, ${e.screenPoint.y}px)`;
            state.menuEl.style.display = "block";
          } else {
            state.menuEl.style.display = "none";
          }
          break;
      }
    });
    return () => sub.unsubscribe();
  }, []);

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
 * @property {HTMLDivElement} menuEl
 */