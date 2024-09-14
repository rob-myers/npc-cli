import React from "react";
import { css, cx } from "@emotion/css";

import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";

import { LinkProvider } from "./xterm-link-provider";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

/**
 * Like `BaseTty` but without a session.
 * @type {React.ForwardRefExoticComponent<Props & React.RefAttributes<State>>}
 */
export const Logger = React.forwardRef(function WorldLogger(props, ref) {

  const state = useStateRef(/** @returns {State} */ () => ({
    contents: '',
    fitAddon: new FitAddon(),
    loggerEl: /** @type {*} */ (null),
    webglAddon: new WebglAddon(),
    xterm: /** @type {*} */ (null),

    loggerElRef: (el) => el && !state.loggerEl &&
      setTimeout(() => (state.loggerEl = el, update())
    ),
  }));

  const update = useUpdate();

  React.useMemo(() => void /** @type {React.RefCallback<State>} */ (ref)?.(state), [ref]);

  React.useEffect(() => {
    if (state.loggerEl === null) {
      return;
    }

    const xterm = state.xterm = new Terminal({
      allowProposedApi: true, // Needed for WebLinksAddon
      allowTransparency: true,
      fontSize: 16,
      cursorBlink: false,
      disableStdin: true,
      cursorInactiveStyle: 'none',
      // rendererType: "canvas",
      // mobile: can select single word via long press
      rightClickSelectsWord: true,
      theme: {
        background: 'rgba(0, 0, 0, 0.5)'
      },
      convertEol: false,
      // scrollback: scrollback,
      rows: 50,
    });
  
    xterm.registerLinkProvider(
      new LinkProvider(xterm, /(\[ [^\]]+ \])/gi, async function callback(
        _event,
        linkText,
        { lineText, linkStartIndex, lineNumber }
      ) {
        console.log('BaseTerminal: clicked link', {
          linkText,
          lineText,
          linkStartIndex,
          lineNumber,
        });
        // useSession.api.onTtyLink({
        //   sessionKey: props.sessionKey,
        //   lineText: stripAnsi(lineText),
        //   // Omit square brackets and spacing:
        //   linkText: stripAnsi(linkText).slice(2, -2),
        //   linkStartIndex,
        //   lineNumber,
        // });
      })
    );
  
    xterm.loadAddon(state.fitAddon = new FitAddon());
    xterm.loadAddon(state.webglAddon = new WebglAddon());
    state.webglAddon.onContextLoss(() => {
      state.webglAddon.dispose(); // 🚧 WIP
    });

    xterm.write(state.contents);
    xterm.open(state.loggerEl);
    state.fitAddon.fit();
    
    return () => {
      const { active } = state.xterm.buffer;
      const numLines = active.baseY + active.cursorY;
      state.contents = [...Array(numLines)].reduce((agg, _, index) => {
        const line = active.getLine(index);
        return line !== undefined ? `${agg}${line.translateToString(true)}\r\n` : agg;
      }, '');

      state.xterm.dispose();
    };
  }, [state.loggerEl]);

  return (
    <div
      className={cx(props.className, "scrollable")}
      ref={state.loggerElRef}
    />
  );
});

/**
 * @typedef Props
 * @property {string} [className]
 */

/**
 * @typedef State
 * @property {string} contents
 * @property {HTMLDivElement} loggerEl
 * @property {Terminal} xterm
 * @property {FitAddon} fitAddon
 * @property {WebglAddon} webglAddon
 * @property {(el: null | HTMLDivElement) => void} loggerElRef
 */
