import React from 'react';
import { css } from '@emotion/css';
import useMeasure from 'react-use-measure';
import debounce from 'debounce';

import { error, keys } from '../service/generic';
import { isTouchDevice } from '../service/dom';
import type { Session } from "../sh/session.store";
import { ansi } from '../sh/const';
import { formatMessage } from '../sh/util';

import useStateRef from '../hooks/use-state-ref';
import useUpdate from '../hooks/use-update';
import useSession, { ProcessStatus } from '../sh/session.store';
import TouchHelperUi from './TouchHelperUi';
import { BaseTty, State as BaseTtyState } from './BaseTty';

/**
 * Pausable and Bootable `BaseTty`.
 */
export default function Tty(props: Props) {

  const [rootRef, bounds] = useMeasure({ debounce: 0, scroll: false });

  const state = useStateRef(() => ({
    base: {} as BaseTtyState,
    /**
     * Have we initiated the profile?
     * Don't want to re-run on hmr.
     */
    booted: false,
    bounds,
    fitDebounced: debounce(() => { state.base.fitAddon.fit(); }, 300),
    focusedBeforePause: false,
    functionFiles: {} as Props['functionFiles'],
    inputBeforePause: undefined as string | undefined,
    inputOnFocus: undefined as undefined | { input: string; cursor: number },
    isTouchDevice: isTouchDevice(),
    pausedPids: {} as Record<number, true>,
    typedWhilstPaused: { value: false, onDataSub: { dispose() {} } },

    onCreateSession() {
      state.booted = false;
      update();
    },
    onFocus() {
      if (state.inputOnFocus) {
        state.base.xterm.setInput(state.inputOnFocus.input);
        state.base.xterm.setCursor(state.inputOnFocus.cursor);
        state.inputOnFocus = undefined;
      }
    },
    pauseRunningProcesses() {
      Object.values(state.base.session.process ?? {})
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
        const input = state.base.xterm.getInput();
        const cursor = state.base.xterm.getCursor();
        if (input && state.base.xterm.isPromptReady()) {
          state.base.xterm.clearInput();
          state.inputOnFocus = { input, cursor };
        }
        // setTimeout(() => state.fitAddon.fit());
        state.fitDebounced();
      }
    },
    restoreInput() {
      if (state.inputBeforePause) {
        state.base.xterm.clearInput();
        state.base.xterm.setInput(state.inputBeforePause);
        state.inputBeforePause = undefined;
      } else {
        state.base.xterm.showPendingInputImmediately();
      }
    },
    resumeRunningProcesses() {
      Object.values(state.base.session?.process ?? {})
        .filter((p) => state.pausedPids[p.key])
        .forEach((p) => {
          if (p.status === ProcessStatus.Suspended) {
            p.onResumes = p.onResumes.filter((onResume) => onResume());
            p.status = ProcessStatus.Running;
          }
          delete state.pausedPids[p.key];
        });
    },
    async sourceFuncs() {
      const session = state.base.session;
      Object.assign(session.etc, state.functionFiles);

      await Promise.all(keys(props.functionFiles).map(filename =>
        session.ttyShell.sourceEtcFile(filename).catch(e => {
          if (typeof e?.$type === 'string') {// mvdan.cc/sh/v3/syntax.ParseError
            const fileContents = props.functionFiles[filename];
            const [line, column] = [e.Pos.Line(), e.Pos.Col()];
            const errorMsg = `${e.Error()}:\n${fileContents.split('\n')[line - 1]}` ;
            state.writeError(session.key, `/etc/${filename}: ${e.$type}`, errorMsg);
          } else {
            state.writeError(session.key, `/etc/${filename}: failed to run`, e)
          }
        })
      ));
    },
    writeError(sessionKey: string, message: string, origError: any) {
      useSession.api.writeMsgCleanly(sessionKey,
        `${message} (see console)`, { level: 'error' },
      ).catch(() => { /** session may no longer exist */ });
      error(message);
      console.error(origError);
    },
  }));

  state.functionFiles = props.functionFiles;

  React.useEffect(() => {// Pause/resume
    if (props.disabled && state.base.session) {
      const { xterm } = state.base;
      state.focusedBeforePause = document.activeElement === xterm.xterm.textarea;

      if (xterm.isPromptReady()) {
        state.inputBeforePause = xterm.getInput();
        xterm.clearInput();
      }

      if (state.booted) {
        useSession.api.writeMsgCleanly(
          props.sessionKey, formatMessage(line.paused, "info"), { prompt: false },
        );
      } else {
        xterm.clearScreen();
        useSession.api.writeMsgCleanly(
          props.sessionKey, formatMessage(line.neverUnpaused, "info"), { prompt: false },
        );
      }

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

        if (state.base.session) {
          // 🚧 tidy
          // Remove `pausedLine` unless used terminal whilst paused
          state.typedWhilstPaused.onDataSub.dispose();
          if (state.typedWhilstPaused.value === false) {
            xterm.xterm.write(`\x1b[F\x1b[2K`);
          } else {
            useSession.api.writeMsgCleanly(
              props.sessionKey, formatMessage(line.resumed, "info"),
            );
          }
          
          state.restoreInput();
        }

        state.resumeRunningProcesses();

      };
    }
  }, [props.disabled, state.base.session])

  React.useEffect(() => {// Bind external events
    if (state.base.session) {
      state.resize();
      const { xterm } = state.base.xterm;
      const onKeyDispose = xterm.onKey((e) => props.onKey?.(e.domEvent));
      xterm.textarea?.addEventListener("focus", state.onFocus);
      
      return () => {
        onKeyDispose.dispose();
        xterm.textarea?.removeEventListener("focus", state.onFocus);
      };
    }
  }, [state.base.session, props.onKey]);

  React.useEffect(() => {// Handle resize
    state.bounds = bounds;
    state.base.session && state.resize();
  }, [bounds]);

  React.useEffect(() => {// sync shell functions
    if (state.base.session && state.booted) {
      state.sourceFuncs();
    }
  }, [state.base.session, ...Object.values(props.functionFiles)]);

  React.useEffect(() => {// sync ~/PROFILE
    if (state.base.session) {
      state.base.session.var.PROFILE = props.env.PROFILE;
    }
  }, [state.base.session, props.env.PROFILE]);

  React.useEffect(() => {// Boot profile
    if (state.base.session && !props.disabled && !state.booted) {
      const { xterm, session } = state.base;

      state.booted = true;
      xterm.initialise();
      session.ttyShell.initialise(xterm).then(async () => {
        await state.sourceFuncs();
        update();
        await session.ttyShell.runProfile();
      });      
    }
  }, [state.base.session, props.disabled]);

  const update = useUpdate();

  return (
    <div className={rootCss} ref={rootRef}>
      <BaseTty
        ref={ts => ts && (state.base = ts)}
        sessionKey={props.sessionKey}
        env={props.env}
        onCreateSession={state.onCreateSession}
      />
      {state.base.session && (
        <TouchHelperUi session={state.base.session} disabled={props.disabled} />
      )}
    </div>
  );
}

export interface Props {
  sessionKey: string;
  disabled?: boolean;
  /** Can initialize variables */
  env: Partial<Session["var"]>;
  functionFiles: Record<string, string>;
  onKey?(e: KeyboardEvent): void;
  // onUnmount?(): void;
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

const line = {
  /** Only used when starts paused */
  neverUnpaused: `enable tabs to start`,
  paused: `${ansi.White}paused processes`,
  /** Only used when we type whilst paused */
  resumed: `${ansi.White}resumed processes`,
};
