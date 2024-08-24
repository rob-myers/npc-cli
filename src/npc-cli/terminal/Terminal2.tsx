import React from 'react';
import { css } from '@emotion/css';
import useMeasure from 'react-use-measure';
import debounce from 'debounce';

import { isTouchDevice } from '../service/dom';
import type { Session } from "../sh/session.store";
import useStateRef from '../hooks/use-state-ref';
import TouchHelperUi from './TouchHelperUi';
import useUpdate from '../hooks/use-update';
import { TerminalSession, State as TerminalSessionState } from './TerminalSession';

export default function Terminal2(props: Props) {

  const [rootRef, bounds] = useMeasure({ debounce: 0, scroll: false });

  const state = useStateRef(() => ({
    /**
     * Initiated profile and sourced etc files?
     * We prevent HMR from re-running this.
     */
    booted: false,
    bounds,
    container: null as any as HTMLDivElement,
    fitDebounced: debounce(() => { state.ts.fitAddon.fit(); }, 300),
    inputOnFocus: undefined as undefined | { input: string; cursor: number },
    isTouchDevice: isTouchDevice(),
    ts: { ready: false } as TerminalSessionState,

    containerRef(el: null | HTMLDivElement) {
      if (el && !state.container) {
        state.container = el;
        update();
      }
    },
    onFocus() {
      if (state.inputOnFocus) {
        state.ts.xterm.setInput(state.inputOnFocus.input);
        state.ts.xterm.setCursor(state.inputOnFocus.cursor);
        state.inputOnFocus = undefined;
      }
    },
    async resize() {
      if (state.isTouchDevice) {
        state.fitDebounced();
      } else {
        // Hide input to prevent issues when screen gets too small
        const input = state.ts.xterm.getInput();
        const cursor = state.ts.xterm.getCursor();
        if (input && state.ts.xterm.isPromptReady()) {
          state.ts.xterm.clearInput();
          state.inputOnFocus = { input, cursor };
        }
        // setTimeout(() => state.fitAddon.fit());
        state.fitDebounced();
      }
    },
  }));

  // 🚧 pause/resume

  React.useEffect(() => {// Bind external events
    if (state.ts.ready) {
      state.resize();
      const { xterm } = state.ts.xterm;
      const onKeyDispose = xterm.onKey((e) => props.onKey?.(e.domEvent));
      xterm.textarea?.addEventListener("focus", state.onFocus);
      
      return () => {
        onKeyDispose.dispose();
        xterm.textarea?.removeEventListener("focus", state.onFocus);
      };
    }
  }, [state.ts.ready]);

  React.useEffect(() => {// Handle resize
    state.bounds = bounds;
    state.ts.ready && state.resize();
  }, [bounds]);

  React.useEffect(() => {// Boot profile
    if (state.ts.ready && !state.booted) {
      state.booted = true;

      const { xterm, session } = state.ts;
      xterm.initialise();
      session.ttyShell.initialise(xterm).then(async () => {
        await props.onReady?.(session);
        update();
        // 🚧 can ctrl-c while paused
        await session.ttyShell.runProfile();
      });      
    }
  }, [state.ts.ready]);

  const update = useUpdate();

  return <>

    <TerminalSession
      ref={ts => ts && (state.ts = ts)}
      sessionKey={props.sessionKey}
      env={props.env}
      container={state.container}
    />

    <div className={rootCss} ref={rootRef}>
      <div
        ref={state.containerRef}
        className="xterm-container scrollable"
        onKeyDown={stopKeysPropagating}
      />

      {state.ts.ready && (
        <TouchHelperUi session={state.ts.session} disabled={props.disabled} />
      )}
    </div>

  </>;
}

export interface Props {
  sessionKey: string;
  disabled?: boolean;
  /** Can initialize variables */
  env: Partial<Session["var"]>;
  onKey?(e: KeyboardEvent): void;
  onReady?(session: Session): void | Promise<void>;
  onUnmount?(): void;
}

const rootCss = css`
  height: 100%;
  padding: 4px;

  .xterm-container {
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
  }
`;

function stopKeysPropagating(e: React.KeyboardEvent) {
  e.stopPropagation();
}
