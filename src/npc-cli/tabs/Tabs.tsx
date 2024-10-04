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
import Spinner from "./Spinner";

export const Tabs = React.forwardRef<State, Props>(function Tabs(props, ref) {
  const state = useStateRef((): State => ({
    enabled: false,
    everEnabled: false,
    hash: "",
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
            x.justCovered && state.enabled && (x.disabled = false);
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
      if (act.type === Actions.SELECT_TAB) {
        state.focusRoot();
      }
      return act;
    },
    // 🔔 saw "Debounced method called with different contexts" for 300ms
    onModelChange: debounce((() => {
      storeModelAsJson(props.id, state.model);
    }), 30),
    reset() {
      state.tabsState = {};
      if (!state.enabled) {
        state.everEnabled = false;
      }
      state.resetCount++; // Remount
      update();
    },
    toggleEnabled(next) {
      const prev = state.enabled;
      // toggle if `next` undefined, else set
      next ??= !prev;

      if (prev === next) {
        return;
      }

      state.everEnabled ||= next;
      state.enabled = next;

      if (next) {
        const prevFocused = state.prevFocused;
        state.prevFocused = null;
        // setTimeout prevents enter propagating to Terminal
        setTimeout(() => (prevFocused || state.rootEl).focus());
      } else {
        state.prevFocused = document.activeElement as HTMLElement | null;
        state.rootEl.focus();
      }

      // Toggle all tabs
      state.toggleTabsDisabled(next);
      update();

      props.onToggled?.(next);
    },
    toggleTabsDisabled(next) {
      const { tabsState } = state;
      for (const key of Object.keys(tabsState)) {
        tabsState[key].disabled = !next 
      }
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
        // console.log('visibility', key, visible);
        state.tabsState[key] ??= {
          key,
          type: tabDef.type,
          disabled: !state.enabled,
          everUncovered: false,
          justCovered: false,
        };

        if (visible) {
          state.tabsState[key].disabled = !state.enabled;
          const maxNode = state.model.getMaximizedTabset()?.getSelectedNode();
          state.tabsState[key].everUncovered ||= maxNode ? node === maxNode : true;
          setTimeout(update); // 🔔 Cannot update a component (`Tabs`) while rendering a different component (`Layout`)
        }
        
        if (!visible && tabDef.type === "component") {
          // - invisible tabs of type "component" get disabled in background
          // - tabs of type "terminal" stay enabled in background
          state.tabsState[key].disabled = true;
          setTimeout(update);
        }
      });
    });

    return output;
  }, [tabsDefChanged, state.resetCount]);

  useBeforeunload(() => storeModelAsJson(props.id, state.model));

  React.useMemo(() => void (ref as React.RefCallback<State>)?.(state), [ref]);

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

      {!state.everEnabled && (
        <button
          className={cx(interactButtonCss, { collapsed: props.collapsed })}
          onPointerDown={() => state.toggleEnabled(true)}
        >
          <div>
            {props.browserLoaded ? "interact" : <Spinner size={24} />}
          </div>
        </button>
      )}

    </>
  );
});

export interface Props extends TabsDef {
  browserLoaded: boolean;
  collapsed: boolean;
  rootOrientationVertical?: boolean;
  /** Invoked onchange state.enabled */
  onToggled?(next: boolean): void;
}

export interface State {
  enabled: boolean;
  everEnabled: boolean;
  hash: string;
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
  toggleTabsDisabled(next: boolean): void;
}

export interface TabState {
  /** Tab identifier */
  key: string;
  type: TabDef["type"];
  disabled: boolean;
  /**
   * `true` iff this tab's contents has ever been visible,
   * in which case we should have mounted the respective component.
   */
  everUncovered: boolean;
  /** `true` iff was just covered by a maximised tab */
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

const interactButtonCss = css`
  position: absolute;
  display: flex;
  justify-content: center;
  align-items: center;

  @media (min-width: ${afterBreakpoint}) {
    left: var(--view-bar-size);
    top: 0;
    width: calc(100% - var(--view-bar-size));
    height: 100%;
  }
  @media (max-width: ${breakpoint}) {
    left: 0;
    top: calc(var(--view-bar-size) + 32px + 4px);
    width: 100%;
    height: calc(100% - 2 * var(--view-bar-size));
  }

  user-select: none;
  &.collapsed {
    display: none;
  }

  > div {
    letter-spacing: 2px;
    pointer-events: all;
    
    cursor: pointer;
    font-size: 1rem;
    color: white;
  }
`;
