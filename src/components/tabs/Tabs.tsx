import React from "react";
import { Actions, Layout as FlexLayout, TabNode } from "flexlayout-react";
import debounce from "debounce";
import { useBeforeunload } from "react-beforeunload";
import { css, cx } from "@emotion/css";

import {
  TabMeta,
  TabsDef,
  clearModelFromStorage,
  createOrRestoreJsonModel,
  factory,
  storeModelAsJson,
} from "./tabs.util";
import useStateRef from "src/js/hooks/use-state-ref";
import useUpdate from "src/js/hooks/use-update";
import Controls from "./Controls";

export default function Tabs(props: Props) {
  const state = useStateRef<State>(() => ({
    componentMeta: {},
    enabled: false,
    everEnabled: false,
    overlayColor: "black",
    resetCount: 0,

    hardReset() {
      clearModelFromStorage(props.id);
      state.reset();
    },
    reset() {
      state.componentMeta = {};
      state.enabled = state.everEnabled = false;
      state.overlayColor = "black";
      state.resetCount++; // Remount
      update();
    },
    toggleEnabled() {
      state.everEnabled = true;
      state.enabled = !state.enabled;
      state.overlayColor = state.overlayColor === "clear" ? "faded" : "clear";

      const { componentMeta } = state;
      Object.keys(componentMeta).forEach((key) => (componentMeta[key].disabled = !state.enabled));
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
        const [key, tabMeta] = [node.getId(), (node as TabNode).getConfig() as TabMeta];
        state.componentMeta[key] ??= { key, disabled: false, everVis: false };

        if (!visible) {
          if (tabMeta.type === "component") {
            // we don't disable hidden terminals
            state.componentMeta[key].disabled = true;
            setTimeout(update);
          }
        } else {
          state.componentMeta[key].disabled = false;
          if (tabMeta.type === "terminal") {
            // 🚧 Ensure scrollbar appears if exceeded scroll area when hidden
            // const { default: useSessionStore } = await import("projects/sh/session.store");
            // const session = useSessionStore.api.getSession(getTabIdentifier(tabMeta));
            // session?.ttyShell.xterm.forceResize();
          }

          const maxNode = model.getMaximizedTabset()?.getSelectedNode();
          // According to flexlayout-react, a selected tab is "visible" when obscured by a maximised tab.
          // We prevent rendering in such cases
          state.componentMeta[key].everVis ||= maxNode ? node === maxNode : true;
          // update(); // 🔔 Cannot update a component (`Tabs`) while rendering a different component (`Layout`)
          setTimeout(update);
        }
      });
    });

    return output;
  }, [JSON.stringify(props.tabs), state.resetCount]);

  useBeforeunload(() => storeModelAsJson(props.id, model));

  const update = useUpdate();

  return (
    <figure key={state.resetCount} className={cx("tabs", tabsCss)}>
      {state.everEnabled && (
        <FlexLayout
          model={model}
          factory={(node) => factory(node, state)}
          realtimeResize
          onModelChange={debounce(() => storeModelAsJson(props.id, model), 300)}
          onAction={(act) => {
            if (act.type === Actions.MAXIMIZE_TOGGLE && model.getMaximizedTabset()) {
              // We are minimizing a maximized tab
              Object.values(state.componentMeta).forEach((x) => (x.everVis = true));
              update();
            }
            return act;
          }}
        />
      )}
      <Controls api={state} />
    </figure>
  );
}

export interface Props extends TabsDef {
  rootOrientationVertical?: boolean;
}

export interface State {
  componentMeta: Record<string, { key: string; disabled: boolean; everVis: boolean }>;
  enabled: boolean;
  everEnabled: boolean;
  /** Initially `black` afterwards `faded` or `clear` */
  overlayColor: "black" | "faded" | "clear";
  resetCount: number;
  hardReset(): void;
  reset(): void;
  toggleEnabled(): void;
}

const tabsCss = css`
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
