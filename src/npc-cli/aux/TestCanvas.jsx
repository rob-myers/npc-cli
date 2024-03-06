import React from "react";
import { Canvas } from "@react-three/fiber";
import { Stats } from "@react-three/drei";
import { css } from "@emotion/css";

import useStateRef from "../hooks/use-state-ref";

/**
 * React Three Fiber Canvas wrapper
 * @template {{ disabled?: boolean; }} [ChildProps={}]
 * @param {Props<ChildProps>} props
 */
export default function TestCanvas(props) {
  const state = useStateRef(
    /** @returns {State} */ () => ({
      rootEl: /** @type {*} */ (null),
      disabled: !!props.disabled,
    })
  );

  state.disabled = !!props.disabled;

  return (
    <>
      <Canvas
        className={canvasCss}
        // "never" broke TestCharacter sporadically
        frameloop={props.disabled ? "demand" : "always"}
        resize={{ debounce: 300 }}
        gl={{ toneMapping: 4, toneMappingExposure: 1 }}
        // onPointerUp={}
        onPointerMissed={(e) => {
          console.log("onPointerMissed");
        }}
      >
        {props.childComponent
          ? React.createElement(
              props.childComponent,
              /** @type {ChildProps} */ ({
                ...props.childProps,
                disabled: props.disabled,
              })
            )
          : null}

        {props.stats && <Stats showPanel={0} />}
      </Canvas>

      <div className={contextMenuCss}>
        {/* 🚧 */}
        ContextMenu
        <select defaultValue={undefined} style={{ width: "100%" }}>
          <option>choose geomorph</option>
          <option value="foo">foo</option>
          <option value="bar">bar</option>
          <option value="baz">baz</option>
        </select>
      </div>
    </>
  );
}

/**
 * @template {{ disabled?: boolean; }} [ChildProps={}]
 * @typedef Props
 * @property {boolean} [disabled]
 * @property {boolean} [stats]
 * @property {React.ComponentType<ChildProps>} [childComponent]
 * @property {ChildProps} [childProps]
 */

/**
 * @typedef State
 * @property {boolean} disabled
 * @property {HTMLCanvasElement} rootEl
 */

/**
 * @typedef GeomorphData
 * @property {Geomorph.GeomorphKey} gmKey
 * @property {[number, number, number, number, number, number]} transform
 * @property {Geom.RectJson} pngRect
 * @property {string} debugPngPath
 */

const canvasCss = css`
  > div {
    background-color: black;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  canvas {
    background-color: rgba(255, 255, 255, 1);
    width: 100%;
    height: 100%;
  }
`;

const contextMenuCss = css`
  position: absolute;
  bottom: 0;
  right: 0;
  z-index: 100;
  background-color: black;
  color: white;
  height: 100px;
  width: 150px;
`;
