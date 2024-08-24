import React from 'react';
import { Terminal as XTermTerminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
// 🔔 debugging "Cannot read properties of undefined" onRequestRedraw
// import { WebglAddon } from "xterm-addon-webgl";
import { WebglAddon } from "@xterm/addon-webgl";

import { stripAnsi } from '../sh/util';
import { scrollback } from '../sh/io';
import { ttyXtermClass } from '../sh/tty.xterm';
import useSession, { type Session } from "../sh/session.store";
import useStateRef from '../hooks/use-state-ref';
import { LinkProvider } from './xterm-link-provider';

/**
 * We use a null-rendering-component to isolate HMR,
 * i.e. we'd prefer not to have to destroy session.
 */
export const TerminalSession = React.forwardRef<State, Props>(function TerminalSession(props: Props, ref) {

  const state = useStateRef((): State => ({
    fitAddon: new FitAddon(),
    // 🔔 `undefined` for change detection
    session: undefined as any as Session,
    webglAddon: new WebglAddon(),
    xterm: null as any as ttyXtermClass,
  }));

  React.useMemo(() => void (ref as React.RefCallback<State>)?.(state), [ref]);
  
  React.useEffect(() => {
    if (props.container === null) {
      return;
    }

    state.session = useSession.api.createSession(props.sessionKey, props.env);
  
    const xterm = new XTermTerminal({
      allowProposedApi: true, // Needed for WebLinksAddon
      fontSize: 16,
      cursorBlink: true,
      // rendererType: "canvas",
      // mobile: can select single word via long press
      rightClickSelectsWord: true,
      theme: {
        background: "black",
        foreground: "#41FF00",
      },
      convertEol: false,
      scrollback: scrollback,
      rows: 50,
    });
  
    xterm.registerLinkProvider(
      new LinkProvider(xterm, /(\[ [^\]]+ \])/gi, async function callback(
        _event,
        linkText,
        { lineText, linkStartIndex, lineNumber }
      ) {
        // console.log('clicked link', {
        //   sessionKey: props.sessionKey,
        //   linkText,
        //   lineText,
        //   linkStartIndex,
        //   lineNumber,
        // });
        useSession.api.onTtyLink({
          sessionKey: props.sessionKey,
          lineText: stripAnsi(lineText),
          // Omit square brackets and spacing:
          linkText: stripAnsi(linkText).slice(2, -2),
          linkStartIndex,
          lineNumber,
        });
      })
    );
  
    state.xterm = new ttyXtermClass(xterm, {
      key: state.session.key,
      io: state.session.ttyIo,
      rememberLastValue(msg) {
        state.session.var._ = msg;
      },
    });
  
    xterm.loadAddon(state.fitAddon = new FitAddon());
    xterm.loadAddon(state.webglAddon = new WebglAddon());
    state.webglAddon.onContextLoss(() => {
      state.webglAddon.dispose(); // 🚧 WIP
    });

    state.session.ttyShell.xterm = state.xterm;

    xterm.open(props.container);

    props.onCreateSession();

    return () => {
      useSession.api.persistHistory(props.sessionKey);
      useSession.api.persistHome(props.sessionKey);
      useSession.api.removeSession(props.sessionKey);

      // props.onUnmount?.();
      state.xterm.dispose();
      state.session = state.xterm = null as any;
      // state.ready = false;
    };
  }, [props.container]);

  return null;
});

interface Props {
  sessionKey: string;
  env: Partial<Session["var"]>;
  container: HTMLElement | null;
  onCreateSession(): void;
}

export interface State {
  fitAddon: FitAddon;
  session: Session;
  webglAddon: WebglAddon;
  xterm: ttyXtermClass;
}
