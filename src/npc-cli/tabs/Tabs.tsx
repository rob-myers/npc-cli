import React from "react";
import {
  Action,
  Actions,
  Layout as FlexLayout,
  Model,
  TabNode,
  TabSetNode,
} from "flexlayout-react";
import debounce from "debounce";
import { useBeforeunload } from "react-beforeunload";
import { css, cx } from "@emotion/css";

import { afterBreakpoint, breakpoint } from "src/const";
import {
  TabDef,
  TabsDef,
  clearModelFromStorage,
  createOrRestoreJsonModel,
  factory,
  storeModelAsJson,
} from "./tab-factory";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import Spinner from "src/components/Spinner";

export const Tabs = React.forwardRef<State, Props>(function Tabs(props, ref) {
  const state = useStateRef<State>(() => ({
    enabled: false,
    everEnabled: false,
    hash: "",
    overlayColor: "black",
    prevFocused: null,
    resetCount: 0,
    rootEl: null as any,
    tabsState: {},
    model: {} as Model,

    focusRoot() {
      state.rootEl.focus();
    },
    hardReset() {
      clearModelFromStorage(props.id);
      state.reset();
    },
    onAction(act) {
      if (act.type === Actions.MAXIMIZE_TOGGLE) {
        if (state.model.getMaximizedTabset()) {
          // On minimise, enable justCovered tabs
          Object.values(state.tabsState).forEach((x) => {
            x.justCovered && (x.disabled = false);
            x.everUncovered = true;
            x.justCovered = false;
          });
          update();
        } else {
          // On maximise, disable hidden non-terminal tabs
          const maxIds = (state.model.getNodeById(act.data.node) as TabSetNode)
            .getChildren()
            .map((x) => x.getId());
          state.model.visitNodes((node) => {
            const id = node.getId();
            const meta = state.tabsState[id];
            if (node.getType() === "tab" && !maxIds.includes(id) && meta?.type === "component") {
              !meta.disabled && (meta.justCovered = true);
              meta.disabled = true;
            }
            update();
          });
        }
      }
      if (act.type === Actions.ADJUST_SPLIT) {
        state.focusRoot();
      }
      return act;
    },
    onModelChange: debounce(() => {
      storeModelAsJson(props.id, state.model);
    }, 300),
    reset() {
      state.tabsState = {};
      if (!state.enabled) {
        state.everEnabled = false;
      }
      state.resetCount++; // Remount
      update();
    },
    toggleEnabled(next) {
      next ??= !state.enabled;
      state.everEnabled ||= next;
      state.enabled = next;
      if (state.everEnabled) {
        state.overlayColor = next ? "clear" : "faded";
      } else {
        state.overlayColor = "black";
      }

      if (next) {
        const prevFocused = state.prevFocused;
        state.prevFocused = null;
        // setTimeout prevents enter propagating to Terminal
        setTimeout(() => (prevFocused || state.rootEl).focus());
      } else {
        state.prevFocused = document.activeElement as HTMLElement | null;
        state.rootEl.focus();
      }

      const { tabsState } = state;
      Object.keys(tabsState).forEach((key) => (tabsState[key].disabled = !next as boolean));
      update();

      props.onToggled?.(next);
    },
  }));

  // 🚧 move to state.updateHash
  const hash = JSON.stringify(props.tabs);
  const tabsDefChanged = state.hash !== hash;
  state.hash = hash;

  state.model = React.useMemo(() => {
    const output = createOrRestoreJsonModel(props);

    // Enable and disable tabs relative to visibility
    output.visitNodes((node) => {
      if (node.getType() !== "tab") {
        return;
      }

      node.setEventListener("visibility", async ({ visible }) => {
        const [key, tabDef] = [node.getId(), (node as TabNode).getConfig() as TabDef];
        state.tabsState[key] ??= {
          key,
          type: tabDef.type,
          disabled: false,
          everUncovered: false,
          justCovered: false,
        };

        if (!visible) {
          if (tabDef.type === "component") {
            // we don't disable hidden terminals
            state.tabsState[key].disabled = true;
            setTimeout(update);
          }
        } else {
          if (!state.enabled) {
            return; // Fix HMR
          }

          state.tabsState[key].disabled = false;
          const maxNode = state.model.getMaximizedTabset()?.getSelectedNode();
          state.tabsState[key].everUncovered ||= maxNode ? node === maxNode : true;
          setTimeout(update); // 🔔 Cannot update a component (`Tabs`) while rendering a different component (`Layout`)
        }
      });
    });

    return output;
  }, [tabsDefChanged, state.resetCount]);

  useBeforeunload(() => storeModelAsJson(props.id, state.model));

  React.useMemo(() => void (ref as Function)?.(state), [ref]);

  const update = useUpdate();

  return (
    <>
      <figure
        key={state.resetCount}
        className={cx("tabs", tabsCss)}
        ref={(x) => x && (state.rootEl = x)}
        tabIndex={0}
      >
        {state.everEnabled && (
          <FlexLayout
            model={state.model}
            factory={(node) => factory(node, state, tabsDefChanged)}
            realtimeResize
            onModelChange={state.onModelChange}
            onAction={state.onAction}
          />
        )}
      </figure>

      <button
        onClick={() => state.toggleEnabled()}
        className={cx(interactOverlayCss, { enabled: state.enabled, collapsed: props.collapsed })}
      >
        <div>{props.browserLoaded ? "interact" : <Spinner size={24} />}</div>
      </button>

      <div
        className={cx(faderOverlayCss, {
          clear: state.overlayColor === "clear",
          faded: state.overlayColor === "faded",
        })}
      />
    </>
  );
});

export interface Props extends TabsDef {
  rootOrientationVertical?: boolean;
  collapsed: boolean;
  browserLoaded: boolean;
  onToggled?(next: boolean): void;
}

export interface State {
  enabled: boolean;
  everEnabled: boolean;
  hash: string;
  /** Initially `black` afterwards `faded` or `clear` */
  overlayColor: "black" | "faded" | "clear";
  prevFocused: null | HTMLElement;
  resetCount: number;
  rootEl: HTMLElement;
  /** By tab identifier */
  tabsState: Record<string, TabState>;
  model: Model;
  focusRoot(): void;
  hardReset(): void;
  onAction(act: Action): Action | undefined;
  onModelChange(): void;
  reset(): void;
  toggleEnabled(next?: boolean): void;
}

export interface TabState {
  /** Tab identifier */
  key: string;
  type: TabDef["type"];
  disabled: boolean;
  /**
   * `false` iff some other tab has always been maximised.
   *
   * According to flexlayout-react, a selected tab is visible when obscured by a maximised tab.
   * We prevent rendering in such cases
   */
  everUncovered: boolean;
  /** True iff was just covered by a maximised tab */
  justCovered: boolean;
}

const tabsCss = css`
  position: relative;
  width: 100%;
  height: 100%;

  .flexlayout__tab {
    background-color: black;
    border-top: 3px solid #444;
    overflow: hidden;
  }
  .flexlayout__tabset_tabbar_outer {
    background: #222;
    border-bottom: 1px solid #555;
  }
  .flexlayout__tab_button--selected,
  .flexlayout__tab_button:hover {
    background: #444;
  }
  .flexlayout__tab_button_content {
    user-select: none;
    font-size: 0.7rem;
    font-family: sans-serif;
    font-weight: 300;
    color: #aaa;
  }
  .flexlayout__tab_button--selected .flexlayout__tab_button_content {
    color: #fff;
  }
  .flexlayout__tab_button:hover:not(.flexlayout__tab_button--selected)
    .flexlayout__tab_button_content {
    color: #ddd;
  }
  .flexlayout__splitter_vert,
  .flexlayout__splitter_horz {
    background: #827575;
  }
  .flexlayout__tab_toolbar_button {
    cursor: pointer;
  }
  .flexlayout__tab_toolbar_button-max svg {
    border: 1px solid white;
    path:nth-child(2) {
      fill: white;
    }
  }
  .flexlayout__tab_toolbar_button-max:hover {
    path:nth-child(2) {
      fill: black;
    }
  }
  .flexlayout__error_boundary_container {
    background-color: black;
    .flexlayout__error_boundary_content {
      color: red;
      font-size: 1.2rem;
    }
  }
`;

const interactOverlayCss = css`
  position: absolute;
  z-index: 5;

  @media (min-width: ${afterBreakpoint}) {
    left: var(--view-bar-size);
    top: 0;
    width: calc(100% - var(--view-bar-size));
    height: 100%;
  }
  @media (max-width: ${breakpoint}) {
    left: 0;
    top: var(--view-bar-size);
    width: 100%;
    height: calc(100% - var(--view-bar-size));
  }

  display: flex;
  justify-content: center;
  align-items: center;

  background: rgba(0, 0, 0, 0);
  cursor: pointer;
  user-select: none;

  &.enabled {
    pointer-events: none;
    opacity: 0;
  }
  &.collapsed {
    display: none;
  }

  > div {
    font-size: 1.2rem;
    letter-spacing: 2px;
    color: white;
    filter: drop-shadow(0 2px #006);
  }
`;

const faderOverlayCss = css`
  position: absolute;
  z-index: 4;
  background: rgba(1, 1, 1, 1);

  @media (min-width: ${afterBreakpoint}) {
    left: var(--view-bar-size);
    top: 0;
    width: calc(100% + (-1 * var(--view-bar-size)));
    height: 100%;
  }
  @media (max-width: ${breakpoint}) {
    left: 0;
    top: var(--view-bar-size);
    width: 100%;
    height: calc(100% + (-1 * var(--view-bar-size)));
  }

  opacity: 1;
  transition: opacity 1s ease-in;
  &.clear {
    opacity: 0;
    transition: opacity 0.5s ease-in;
  }
  &.faded {
    opacity: 0.6;
    transition: opacity 0.5s ease-in;
  }

  &:not(.faded) {
    pointer-events: none;
  }
`;
