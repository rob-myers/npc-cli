import React from "react";
import { css, cx } from "@emotion/css";
import { tryLocalStorageGet, tryLocalStorageSet } from "../service/generic";
import { zIndex, localStorageKey, xtermJsTheme, xtermJsDebugTheme } from "../service/const";
import type { Session } from "../sh/session.store";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { faderOverlayCss, pausedControlsCss } from "../world/overlay-menu-css";

export default function TtyMenu(props: Props) {
  const update = useUpdate();

  const state = useStateRef(() => ({
    debugWhilePaused: false,
    xterm: props.session.ttyShell.xterm,
    touchMenuOpen: true,

    clickEnableAll() {
      props.setTabsEnabled(true);
      state.xterm.xterm.focus();
    },
    async onClickMenu(e: React.MouseEvent) {
      const target = e.target as HTMLElement;
      state.xterm.xterm.scrollToBottom();
      if (target.classList.contains("paste")) {
        try {
          const textToPaste = await navigator.clipboard.readText();
          state.xterm.spliceInput(textToPaste);
        } catch {}
      } else if (target.classList.contains("can-type")) {
        const next = !state.xterm.canType();
        state.xterm.setCanType(next);
        tryLocalStorageSet(localStorageKey.touchTtyCanType, `${next}`);
        next && state.xterm.warnIfNotReady();
        update();
      } else if (target.classList.contains("ctrl-c")) {
        state.xterm.sendSigKill();
      } else if (target.classList.contains("enter")) {
        if (!state.xterm.warnIfNotReady()) {
          // avoid sending 'newline' whilst 'await-prompt'
          state.xterm.queueCommands([{ key: "newline" }]);
        }
      } else if (target.classList.contains("delete")) {
        state.xterm.deletePreviousWord();
      } else if (target.classList.contains("clear")) {
        state.xterm.clearScreen();
      } else if (target.classList.contains("up")) {
        state.xterm.reqHistoryLine(+1);
      } else if (target.classList.contains("down")) {
        state.xterm.reqHistoryLine(-1);
      }
      // xterm.xterm.focus();
    },
    toggleDebug() {// hiding overlay permits user to use terminal whilst paused
      state.debugWhilePaused = !state.debugWhilePaused;
      update();
    },
    toggleTouchMenu() {
      const next = !state.touchMenuOpen;
      state.touchMenuOpen = next;
      tryLocalStorageSet(localStorageKey.touchTtyOpen, `${next}`);
      update();
    },
  }));

  state.xterm = props.session.ttyShell.xterm;

  React.useMemo(() => {
    if (!tryLocalStorageGet(localStorageKey.touchTtyCanType)) {
      // tty enabled by default (including touch devices)
      tryLocalStorageSet(localStorageKey.touchTtyCanType, "true");
    }
    if (!tryLocalStorageGet(localStorageKey.touchTtyOpen)) {
      // touch menu closed by default
      tryLocalStorageSet(localStorageKey.touchTtyOpen, "false");
    }
    state.xterm.setCanType(tryLocalStorageGet(localStorageKey.touchTtyCanType) === "true");
    state.touchMenuOpen = tryLocalStorageGet(localStorageKey.touchTtyOpen) === "true";
    return () => void state.xterm.setCanType(true);
  }, []);

  return <>
    <div // Fade Overlay
      className={cx(faderOverlayCss, { faded: props.disabled && !state.debugWhilePaused })}
      onPointerUp={() => props.setTabsEnabled(true)}
    />

    <div // Overlay Menu
      className={cx(menuCss, { disabled: props.disabled, open: state.touchMenuOpen })}
      onClick={state.onClickMenu}
    >
      <div className="left-menu-overlay">
        <div className="menu-toggler" onClick={state.toggleTouchMenu}>
          {state.touchMenuOpen ? ">" : "<"}
        </div>
        {props.disabled && (// Overlay Buttons
          <div className={pausedControlsCss}>
            <button className="text-white" onClick={state.clickEnableAll}>
              enable
            </button>
            <button
              onClick={state.toggleDebug}
              className={state.debugWhilePaused ? 'text-green' : undefined}
            >
              debug
            </button>
          </div>
        )}
      </div>
      <div
        className={cx("icon can-type", { enabled: state.xterm.canType() })}
        title={`text input ${state.xterm.canType() ? "enabled" : "disabled"}`}
      >
        $
      </div>
      <div className="icon paste" title="or press e.g. Cmd+V">
        paste
      </div>
      <div className="icon enter" title="or press Enter">
        enter
      </div>
      <div className="icon delete" title="or press Backspace">
        del
      </div>
      <div className="icon ctrl-c" title="or press Ctrl+C">
        kill
      </div>
      <div className="icon clear" title="or press Ctrl+L">
        clear
      </div>
      <div className="icon up" title="or press Up">
        prev
      </div>
      <div className="icon down" title="or press Down">
        next
      </div>
    </div>
  </>;
}

interface Props {
  session: Session;
  disabled?: boolean;
  setTabsEnabled(next: boolean): void;
}

const menuCss = css`
  --menu-width: 54px;

  position: absolute;
  z-index: ${zIndex.ttyTouchHelper};
  top: 0;
  right: 0;
  width: var(--menu-width);

  display: flex;
  flex-direction: column;

  line-height: 1; /** Needed for mobile viewing 'Desktop site' */
  background-color: rgba(0, 0, 0, 0.7);
  font-size: 8px;
  border: 1px solid #555;
  border-width: 1px 1px 1px 1px;
  color: white;

  /* &.disabled {
    filter: brightness(0.5);
    pointer-events: none;
  } */

  transition: transform 500ms;
  &.open {
    transform: translate(0px, 0px);
    .menu-toggler {
      background: rgba(0, 0, 0, 0.5);
    }
  }
  &:not(.open) {
    transform: translate(var(--menu-width), 0px);
  }

  .left-menu-overlay {
    position: absolute;
    /* z-index: ${zIndex.ttyTouchHelper}; */
    top: 0px;
    right: calc(var(--menu-width) - 1px);

    .menu-toggler {
      width: 32px;
      height: 32px;
  
      display: flex;
      justify-content: center;
      align-items: center;
  
      cursor: pointer;
      font-size: 12px;
      background: rgba(0, 0, 0, 0.5);
      color: #ddd;
      border: 2px solid #444;
    }
  }

  .icon {
    cursor: pointer;
    width: 100%;
    text-align: center;
    padding: 12px;
    transform: scale(1.2);
    color: #cfc;
  }

  .can-type {
    color: #0f0;
    &:not(.enabled) {
      color: #999;
    }
  }
`;
