import React, { forwardRef } from "react";
import { Actions, Layout as FlexLayout, TabNode } from "flexlayout-react";
import debounce from "debounce";
import { useBeforeunload } from "react-beforeunload";
import { css, cx } from "@emotion/css";

import {
  TabDef,
  TabsDef,
  clearModelFromStorage,
  createOrRestoreJsonModel,
  factory,
  storeModelAsJson,
} from "./tabs.util";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

export const Tabs = forwardRef<State, Props>(function Tabs(props, ref) {
  const state = useStateRef<State>(() => ({
    enabled: false,
    everEnabled: false,
    overlayColor: "black",
    resetCount: 0,
    rootEl: {} as HTMLElement,
    tabsState: {},

    focusRoot() {
      state.rootEl.focus();
    },
    hardReset() {
      clearModelFromStorage(props.id);
      state.reset();
    },
    reset() {
      state.tabsState = {};
      state.enabled = state.everEnabled = false;
      state.overlayColor = "black";
      state.resetCount++; // Remount
      update();
    },
    toggleEnabled(next) {
      next ??= !state.enabled;
      state.everEnabled ||= next;
      state.enabled = next;
      state.overlayColor = state.everEnabled ? (next ? "clear" : "faded") : "black";

      const { tabsState } = state;
      Object.keys(tabsState).forEach((key) => (tabsState[key].disabled = !next as boolean));
      update();
    },
  }));

  const model = React.useMemo(() => {
    const output = createOrRestoreJsonModel(props);

    // Enable and disable tabs relative to visibility
    output.visitNodes((node) => {
      if (node.getType() !== "tab") {
        return;
      }
      node.setEventListener("visibility", async ({ visible }) => {
        const [key, tabDef] = [node.getId(), (node as TabNode).getConfig() as TabDef];
        state.tabsState[key] ??= { key, disabled: false, everVis: false };

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
          if (tabDef.type === "terminal") {
            // 🚧 Ensure scrollbar appears if exceeded scroll area when hidden
            // const { default: useSessionStore } = await import("projects/sh/session.store");
            // const session = useSessionStore.api.getSession(getTabIdentifier(tabMeta));
            // session?.ttyShell.xterm.forceResize();
          }

          const maxNode = model.getMaximizedTabset()?.getSelectedNode();
          // According to flexlayout-react, a selected tab is "visible" when obscured by a maximised tab.
          // We prevent rendering in such cases
          state.tabsState[key].everVis ||= maxNode ? node === maxNode : true;
          setTimeout(update); // 🔔 Cannot update a component (`Tabs`) while rendering a different component (`Layout`)
        }
      });
    });

    return output;
  }, [JSON.stringify(props.tabs), state.resetCount]);

  useBeforeunload(() => storeModelAsJson(props.id, model));

  const update = useUpdate();

  React.useMemo(() => void (ref as Function)?.(state), []);

  return (
    <figure
      key={state.resetCount}
      className={cx("tabs", tabsCss)}
      ref={(x) => x && (state.rootEl = x)}
    >
      {state.everEnabled && (
        <FlexLayout
          model={model}
          factory={(node) => factory(node, state)}
          realtimeResize
          onModelChange={debounce(() => storeModelAsJson(props.id, model), 300)}
          onAction={(act) => {
            if (act.type === Actions.MAXIMIZE_TOGGLE && model.getMaximizedTabset()) {
              // We are minimizing a maximized tab
              Object.values(state.tabsState).forEach((x) => (x.everVis = true));
              update();
            }
            return act;
          }}
        />
      )}
    </figure>
  );
});

export interface Props extends TabsDef {
  rootOrientationVertical?: boolean;
}

export interface State {
  enabled: boolean;
  everEnabled: boolean;
  /** Initially `black` afterwards `faded` or `clear` */
  overlayColor: "black" | "faded" | "clear";
  resetCount: number;
  rootEl: HTMLElement;
  /** By tab identifier */
  tabsState: Record<string, TabState>;
  focusRoot(): void;
  hardReset(): void;
  reset(): void;
  toggleEnabled(next?: boolean): void;
}

export interface TabState {
  /** Tab identifier */
  key: string;
  disabled: boolean;
  everVis: boolean;
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
`;
