import React from "react";
import useMeasure from 'react-use-measure';
import { css } from "@emotion/css";

import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { SerializeAddon } from "@xterm/addon-serialize";
import { WebLinksAddon } from "@xterm/addon-web-links";

import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { zIndexWorld } from "../service/const";

/**
 * Like `BaseTty` but without a session.
 * @type {React.ForwardRefExoticComponent<Props & React.RefAttributes<State>>}
 */
export const Logger = React.forwardRef(function Logger(props, ref) {

  const state = useStateRef(/** @returns {State} */ () => ({
    container: /** @type {*} */ (null),
    contents: '',
    fitAddon: new FitAddon(),
    linksAddon: new WebLinksAddon(),
    linkViewportRange: null,
    serializeAddon: new SerializeAddon(),
    webglAddon: new WebglAddon(),
    xterm: /** @type {*} */ (null),

    clear() {
      state.xterm.clear();
    },
    containerRef(el) {
      measureLoggerRef(el);
      el !== null && !state.container && setTimeout(
        () => (state.container = el, update())
      );
    },
    getFullLine(rowNumber) {
      const buffer = state.xterm.buffer.active;
      
      let line = buffer.getLine(rowNumber);
      if (line === undefined) {
        return { fullLine: '', startRow: rowNumber, endRow: rowNumber + 1 };
      }
      
      const lines = [line.translateToString(true)];
      let startRow = rowNumber, endRow = rowNumber;

      while (line?.isWrapped && (line = buffer.getLine(--startRow)))
        lines.unshift(line.translateToString(true));
      while ((line = buffer.getLine(++endRow))?.isWrapped)
        lines.push(line.translateToString(true));

      return {
        fullLine: lines.join(''),
        startRow,
        endRow, // 1 row after final row
      };
    },
  }));

  const update = useUpdate();

  React.useImperativeHandle(ref, () => state, []);

  React.useLayoutEffect(() => {
    if (state.container === null) {
      return;
    }

    const xterm = state.xterm = new Terminal({
      allowProposedApi: true, // Needed for WebLinksAddon
      allowTransparency: true,
      fontSize: 15,
      lineHeight: 1.2,
      fontFamily: 'Courier new, monospace',
      cursorBlink: false,
      cursorInactiveStyle: 'none',
      disableStdin: true,
      rightClickSelectsWord: true, // mobile: can select single word via long press
      theme: {
        background: 'rgba(0, 0, 0, 0)',
        // selectionBackground: 'rgb(0, 0, 0)', // 🚧 invisible to fix dragging?
      },
      convertEol: false,
      rows: 50,
    });
  
    xterm.loadAddon(state.fitAddon = new FitAddon());
    xterm.loadAddon(state.webglAddon = new WebglAddon());
    state.webglAddon.onContextLoss(() => {
      state.webglAddon.dispose(); // 🚧 WIP
    });
    xterm.loadAddon(state.serializeAddon = new SerializeAddon());

    xterm.write(state.contents);
    xterm.open(state.container);
    state.fitAddon.fit();
    
    state.container.style.width = `${props.initDim[0]}px`;
    state.container.style.height = `${props.initDim[1]}px`;

    return () => {
      state.contents = state.serializeAddon.serialize();
      state.xterm.dispose();
    };
  }, [state.container]);

  React.useLayoutEffect(() => {
    if (state.container === null) {
      return;
    }

    state.xterm.loadAddon(state.linksAddon = new WebLinksAddon((e, uri) => {
      const viewportRange = state.linkViewportRange;
      if (viewportRange === null) {
        return; // should be unreachable
      }

      const linkText = uri.slice(1, -1);
      const { fullLine, startRow, endRow } = state.getFullLine(viewportRange.start.y - 1);

      // console.log('🔔 click', { linkText, fullLine, startRow, endRow });
      props.onClickLink({
        linkText,
        fullLine,
        startRow,
        endRow,
        viewportRange,
      });
    }, {
      hover(event, text, location) {
        // console.log('🔔 hover', text, location);
        state.linkViewportRange = location;
      },
      leave(event, text) {
        // console.log('🔔 leave', text);
        state.linkViewportRange = null;
      },
      urlRegex: loggerLinksRegex,
    }));

    return () => {
      state.linksAddon.dispose();
    };
  }, [state.container, props.onClickLink]);

  const [measureLoggerRef, bounds] = useMeasure(({ debounce: 0 }));
  React.useEffect(() => void state.fitAddon.fit(), [bounds]);

  return (
    <div
      ref={state.containerRef}
      className={loggerCss}
    />
  );
});

/**
 * @typedef Props
 * @property {(e: NPC.LoggerLinkEvent) => void} onClickLink
 * @property {[width: number, height: number]} initDim
 */

/**
 * @typedef State
 * @property {HTMLDivElement} container
 * @property {string} contents
 * @property {FitAddon} fitAddon
 * @property {WebLinksAddon} linksAddon
 * @property {null | import('@xterm/xterm').IViewportRange} linkViewportRange
 * @property {SerializeAddon} serializeAddon
 * @property {Terminal} xterm
 * @property {WebglAddon} webglAddon
 *
 * @property {() => void} clear
 * @property {(el: null | HTMLDivElement) => void} containerRef
 * @property {(rowNumber: number) => { fullLine: string; startRow: number; endRow: number; }} getFullLine
 * Given 0-based rowNumber in active buffer, compute the whole (possibly-wrapped) line.
 */

const loggerCss = css`
  overflow: auto;
  width: 100%;
  pointer-events: all;
  
  background: rgba(0, 0, 0, 0.6);
  border: 1px dashed rgba(255, 255, 255, 0.2);
  
  // 🔔 override textual selection cursor
  canvas { cursor: auto !important; }
  // 🔔 Hide xterm cursor
  textarea { visibility: hidden; }

  .xterm .xterm-helpers {
    z-index: ${zIndexWorld.logger} !important;
  }
`;

const loggerLinksRegex = /(\[[^\]]+\])/;
export const globalLoggerLinksRegex = /\[([^\]]+)\]/g;
