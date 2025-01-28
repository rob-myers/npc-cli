import React from 'react';
import { css, cx } from '@emotion/css';
import { Terminal as XTermTerminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
// 🔔 debugging "Cannot read properties of undefined" onRequestRedraw
// import { WebglAddon } from "xterm-addon-webgl";
import { WebglAddon } from "@xterm/addon-webgl";
import { useBeforeunload } from "react-beforeunload";

import { detectTabPrevNextShortcut } from '../service/generic';
import { xtermJsTheme } from '../service/const';
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
  }));

  React.useImperativeHandle(ref, () => state);
  
  React.useEffect(() => {
    state.session = useSession.api.createSession(props.sessionKey, props.env);
  
    const xterm = new XTermTerminal({
      allowProposedApi: true, // Needed for WebLinksAddon
      fontSize: 16,
      cursorBlink: true,
      // rendererType: "canvas",
      // mobile: can select single word via long press
      rightClickSelectsWord: true,
      theme: xtermJsTheme,
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


    return () => {
      useSession.api.persistHistory(props.sessionKey);
      useSession.api.persistHome(props.sessionKey);
      useSession.api.removeSession(props.sessionKey);

      state.xterm.dispose();
      //@ts-ignore
      state.session = state.xterm = null;
    };
  }, []);

  const update = useUpdate();

  useBeforeunload(() => {
    useSession.api.persistHistory(props.sessionKey);
    useSession.api.persistHome(props.sessionKey);
  });

  return (
    <div
      ref={state.ref('container')}
      className={cx(xtermContainerCss, "scrollable")}
      onKeyDown={stopKeysPropagating}
    />
  );
});

interface Props {
  sessionKey: string;
  env: Partial<Session["var"]>;
}

export interface State {
  container: HTMLDivElement;
  fitAddon: FitAddon;
  session: Session;
  webglAddon: WebglAddon;
  xterm: ttyXtermClass;
}

function stopKeysPropagating(e: React.KeyboardEvent) {
  if (detectTabPrevNextShortcut(e)) {
    return;
  }
  e.stopPropagation();
}

const xtermContainerCss = css`
  height: inherit;
  background: black;

  > div {
    width: 100%;
  }

  /** Fix xterm-addon-fit when open keyboard on mobile */
  .xterm-helper-textarea {
    top: 0 !important;
  }

  /** This hack avoids <2 col width, where cursor row breaks */
  min-width: 100px;
  .xterm-screen {
    min-width: 100px;
  }
`;
