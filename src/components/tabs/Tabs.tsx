import React from "react";
import { Actions, Layout as FlexLayout, TabNode } from "flexlayout-react";
import debounce from "debounce";
import { useBeforeunload } from "react-beforeunload";
import { css, cx } from "@emotion/css";

import { TabMeta, TabsDef, createOrRestoreJsonModel, factory, storeModelAsJson } from "./tabs.util";
import useStateRef from "src/js/hooks/use-state-ref";
import useUpdate from "src/js/hooks/use-update";

// 🚧 ensure components are lazy-loaded

export default function Tabs(props: Props) {
  const update = useUpdate();

  const state = useStateRef<State>(() => ({
    componentMeta: {},
    maxTabNode: null,
  }));

  const model = React.useMemo(() => {
    const output = createOrRestoreJsonModel(props);

    // Enable and disable tabs relative to visibility
    output.visitNodes((node) => {
      if (node.getType() !== "tab") {
        return;
      }

      node.setEventListener("visibility", async ({ visible }) => {
        if (model.getMaximizedTabset()) {
          return; // If some tab maximised don't enable "visible" tabs covered by it
        }
        const [key, tabMeta] = [node.getId(), (node as TabNode).getConfig() as TabMeta];

        if (!visible) {
          // tab now hidden
          if (tabMeta.type === "component") {
            state.componentMeta[key].disabled = true;
            update();
          } // we don't disable hidden terminals
        } else {
          // tab now visible
          if (tabMeta.type === "terminal") {
            // 🚧 Ensure scrollbar appears if exceeded scroll area when hidden
            // const { default: useSessionStore } = await import("projects/sh/session.store");
            // const session = useSessionStore.api.getSession(getTabIdentifier(tabMeta));
            // session?.ttyShell.xterm.forceResize();
          }
          if (!state.componentMeta[key]) {
            state.componentMeta[key] = { key, disabled: false };
          } else {
            state.componentMeta[key].disabled = false;
          }
          update();
        }
      });
    });

    return output;
  }, [JSON.stringify(props.tabs)]);

  state.maxTabNode = (model.getMaximizedTabset()?.getSelectedNode() ?? null) as TabNode | null;

  useBeforeunload(() => storeModelAsJson(props.id, model));

  return (
    <figure className={cx("tabs", tabsCss)}>
      <FlexLayout
        model={model}
        factory={(node) => factory(node, state)}
        realtimeResize
        onModelChange={debounce(() => storeModelAsJson(props.id, model), 300)}
        onAction={(act) => {
          if (act.type === Actions.MAXIMIZE_TOGGLE && state.maxTabNode) {
            update(); // We are minimizing a maximized tab
          }
          return act;
        }}
      />
    </figure>
  );
}

export interface Props extends TabsDef {
  rootOrientationVertical?: boolean;
}

export interface State {
  componentMeta: Record<string, { key: string; disabled: boolean }>;
  maxTabNode: TabNode | null;
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
