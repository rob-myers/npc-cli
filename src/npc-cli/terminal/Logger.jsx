import React from "react";
import { cx } from "@emotion/css";

import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { SerializeAddon } from "@xterm/addon-serialize";
import { WebLinksAddon } from "@xterm/addon-web-links";

import { LinkProvider } from "./xterm-link-provider";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

/**
 * Like `BaseTty` but without a session.
 * @type {React.ForwardRefExoticComponent<Props & React.RefAttributes<State>>}
 */
export const Logger = React.forwardRef(function WorldLogger(props, ref) {

  const state = useStateRef(/** @returns {State} */ () => ({
    container: /** @type {*} */ (null),
    contents: '',
    fitAddon: new FitAddon(),
    linksAddon: new WebLinksAddon(),
    webglAddon: new WebglAddon(),
    serializeAddon: new SerializeAddon(),
    xterm: /** @type {*} */ (null),

    containerRef: (el) => el && !state.container &&
      setTimeout(() => (state.container = el, update())
    ),
  }));

  const update = useUpdate();

  React.useImperativeHandle(ref, () => state, []);

  React.useEffect(() => {
    if (state.container === null) {
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
  
    // xterm.registerLinkProvider(
    //   new LinkProvider(xterm, /(\[ [^\]]+ \])/gi, async function callback(
    //     _event,
    //     linkText,
    //     { lineText, linkStartIndex, lineNumber }
    //   ) {
    //     console.log('Logger: clicked link', {
    //       linkText,
    //       lineText,
    //       linkStartIndex,
    //       lineNumber,
    //     });
    //     // useSession.api.onTtyLink({
    //     //   sessionKey: props.sessionKey,
    //     //   lineText: stripAnsi(lineText),
    //     //   // Omit square brackets and spacing:
    //     //   linkText: stripAnsi(linkText).slice(2, -2),
    //     //   linkStartIndex,
    //     //   lineNumber,
    //     // });
    //   })
    // );
    xterm.loadAddon(state.linksAddon = new WebLinksAddon((e, uri) => {
      console.log('🔔 Logger link', e, uri);
      // 🚧
    }, {
      urlRegex: /(\[ [^\]]+ \])/,
    }));
  
    xterm.loadAddon(state.fitAddon = new FitAddon());
    xterm.loadAddon(state.webglAddon = new WebglAddon());
    state.webglAddon.onContextLoss(() => {
      state.webglAddon.dispose(); // 🚧 WIP
    });
    xterm.loadAddon(state.serializeAddon = new SerializeAddon());

    xterm.write(state.contents);
    xterm.open(state.container);
    state.fitAddon.fit();
    
    return () => {
      state.contents = state.serializeAddon.serialize();
      state.xterm.dispose();
    };
  }, [state.container]);

  return (
    <div
      className={cx(props.className, "scrollable")}
      ref={state.containerRef}
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
 * @property {HTMLDivElement} container
 * @property {Terminal} xterm
 * @property {FitAddon} fitAddon
 * @property {WebLinksAddon} linksAddon
 * @property {WebglAddon} webglAddon
 * @property {SerializeAddon} serializeAddon
 * @property {(el: null | HTMLDivElement) => void} containerRef
 */
