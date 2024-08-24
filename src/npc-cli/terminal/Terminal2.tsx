import React from 'react';
import { css } from '@emotion/css';
import useMeasure from 'react-use-measure';
import debounce from 'debounce';

import { isTouchDevice } from '../service/dom';
import type { Session } from "../sh/session.store";
import { ansi } from '../sh/const';
import { formatMessage } from '../sh/util';

import useStateRef from '../hooks/use-state-ref';
import useUpdate from '../hooks/use-update';
import useSession, { ProcessStatus } from '../sh/session.store';
import TouchHelperUi from './TouchHelperUi';
import { TerminalSession, State as TerminalSessionState } from './TerminalSession';

export default function Terminal2(props: Props) {

  const [rootRef, bounds] = useMeasure({ debounce: 0, scroll: false });

  const state = useStateRef(() => ({
    /**
     * Have we initiated the profile?
     * Don't want to re-run on hmr.
     */
    booted: false,
    bounds,
    fitDebounced: debounce(() => { state.ts.fitAddon.fit(); }, 300),
    focusedBeforePause: false,
    inputBeforePause: undefined as string | undefined,
    inputOnFocus: undefined as undefined | { input: string; cursor: number },
    isTouchDevice: isTouchDevice(),
    pausedPids: {} as Record<number, true>,
    ts: {} as TerminalSessionState,
    typedWhilstPaused: { value: false, onDataSub: { dispose() {} } },

    onCreateSession() {
      state.booted = false;
      update();
    },
    onFocus() {
      if (state.inputOnFocus) {
        state.ts.xterm.setInput(state.inputOnFocus.input);
        state.ts.xterm.setCursor(state.inputOnFocus.cursor);
        state.inputOnFocus = undefined;
      }
    },
    pauseRunningProcesses() {
      Object.values(state.ts.session.process ?? {})
        .filter((p) => p.status === ProcessStatus.Running)
        .forEach((p) => {
          p.onSuspends = p.onSuspends.filter((onSuspend) => onSuspend());
          p.status = ProcessStatus.Suspended;
          state.pausedPids[p.key] = true;
        });
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
    restoreInput() {
      if (state.inputBeforePause) {
        state.ts.xterm.clearInput();
        state.ts.xterm.setInput(state.inputBeforePause);
        state.inputBeforePause = undefined;
      } else {
        state.ts.xterm.showPendingInputImmediately();
      }
    },
    resumeRunningProcesses() {
      Object.values(state.ts.session?.process ?? {})
        .filter((p) => state.pausedPids[p.key])
        .forEach((p) => {
          if (p.status === ProcessStatus.Suspended) {
            p.onResumes = p.onResumes.filter((onResume) => onResume());
            p.status = ProcessStatus.Running;
          }
          delete state.pausedPids[p.key];
        });
    },
  }));

  React.useEffect(() => {// Pause/resume
    if (props.disabled && state.ts.session) {
      const { xterm } = state.ts;
      state.focusedBeforePause = document.activeElement === xterm.xterm.textarea;

      if (xterm.isPromptReady()) {
        state.inputBeforePause = xterm.getInput();
        xterm.clearInput();
      }

      useSession.api.writeMsgCleanly(
        props.sessionKey,
        formatMessage(state.booted ? pausedLine : initiallyPausedLine, "info"), { prompt: false },
      );

      state.pauseRunningProcesses();

      // 🚧 tidy
      // Can use terminal whilst "paused" (previously running processes suspended)
      if (state.booted) {
        state.typedWhilstPaused.value = false;
        state.typedWhilstPaused.onDataSub = xterm.xterm.onData(() => {
          state.typedWhilstPaused.value = true;
          state.restoreInput();
        });
      }

      return () => {

        state.focusedBeforePause && xterm.xterm.focus();

        // 🚧 tidy
        // Remove `pausedLine` unless used terminal whilst paused
        state.typedWhilstPaused.onDataSub.dispose();
        if (state.typedWhilstPaused.value === false) {
          xterm.xterm.write(`\x1b[F\x1b[2K`);
        } else {
          useSession.api.writeMsgCleanly(
            props.sessionKey, formatMessage(resumedLine, "info"),
          );
        }
        
        state.restoreInput();

        state.resumeRunningProcesses();

      };
    }
  }, [props.disabled, state.ts.session])

  React.useEffect(() => {// Bind external events
    if (state.ts.session) {
      state.resize();
      const { xterm } = state.ts.xterm;
      const onKeyDispose = xterm.onKey((e) => props.onKey?.(e.domEvent));
      xterm.textarea?.addEventListener("focus", state.onFocus);
      
      return () => {
        onKeyDispose.dispose();
        xterm.textarea?.removeEventListener("focus", state.onFocus);
      };
    }
  }, [state.ts.session]);

  React.useEffect(() => {// Handle resize
    state.bounds = bounds;
    state.ts.session && state.resize();
  }, [bounds]);

  React.useEffect(() => {// Boot profile
    if (state.ts.session && !props.disabled && !state.booted) {
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
  }, [state.ts.session, props.disabled]);

  const update = useUpdate();

  return (
    <div className={rootCss} ref={rootRef}>
      <TerminalSession
        ref={ts => ts && (state.ts = ts)}
        sessionKey={props.sessionKey}
        env={props.env}
        onCreateSession={state.onCreateSession}
      />
      {state.ts.session && (
        <TouchHelperUi session={state.ts.session} disabled={props.disabled} />
      )}
    </div>
  );
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

const initiallyPausedLine = `${ansi.White}initially paused...`;
const pausedLine = `${ansi.White}paused processes`;
/** Only used when we type whilst paused */
const resumedLine = `${ansi.White}resumed processes`;
