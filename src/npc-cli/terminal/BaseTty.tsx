import React from 'react';
import { Terminal as XTermTerminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
// 🔔 debugging "Cannot read properties of undefined" onRequestRedraw
// import { WebglAddon } from "xterm-addon-webgl";
import { WebglAddon } from "@xterm/addon-webgl";

import { stripAnsi } from '../sh/util';
import { scrollback } from '../sh/io';
import { ttyXtermClass } from '../sh/tty.xterm';
import { LinkProvider } from './xterm-link-provider';
import useSession, { type Session } from "../sh/session.store";
import useStateRef from '../hooks/use-state-ref';
import useUpdate from '../hooks/use-update';

export const BaseTty = React.forwardRef<State, Props>(function BaseTty(props: Props, ref) {

  const state = useStateRef((): State => ({
    container: null as any as HTMLDivElement,
    fitAddon: new FitAddon(),
    // 🔔 `undefined` for change detection
    session: undefined as any as Session,
    webglAddon: new WebglAddon(),
    xterm: null as any as ttyXtermClass,
    // 🔔 setTimeout fixes "Cannot read properties of undefined (reading 'dimensions')"
    containerRef: (el: null | HTMLDivElement) => el && !state.container &&
      setTimeout(() => (state.container = el, update())
    ),
  }));

  React.useMemo(() => void (ref as React.RefCallback<State>)?.(state), [ref]);
  
  React.useEffect(() => {
    if (state.container === null) {
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

    xterm.open(state.container);

    props.onCreateSession();

    return () => {
      useSession.api.persistHistory(props.sessionKey);
      useSession.api.persistHome(props.sessionKey);
      useSession.api.removeSession(props.sessionKey);

      state.xterm.dispose();
      state.session = state.xterm = null as any;
    };
  }, [state.container]);

  const update = useUpdate();

  return (
    <div
      ref={state.containerRef}
      className="xterm-container scrollable"
      onKeyDown={stopKeysPropagating}
    />
  );
});

interface Props {
  sessionKey: string;
  env: Partial<Session["var"]>;
  onCreateSession(): void;
}

export interface State {
  container: HTMLDivElement;
  fitAddon: FitAddon;
  session: Session;
  webglAddon: WebglAddon;
  xterm: ttyXtermClass;
  containerRef(el: null | HTMLDivElement): void;
}

function stopKeysPropagating(e: React.KeyboardEvent) {
  e.stopPropagation();
}
