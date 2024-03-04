import React from "react";

import type { TabState, State as TabsApi } from "./Tabs";
import { TabDef, getComponent, Terminal } from "./tab-factory";
import useUpdate from "../hooks/use-update";
import useStateRef from "../hooks/use-state-ref";

export function Tab({ def, api, state: tabState }: TabProps) {
  const state = useStateRef(() => ({
    /** e.g. react-three-fiber Canvas */
    component: null as Awaited<ReturnType<typeof getComponent>> | null,
    /** e.g. always null, or react-three-fiber Scene*/
    childComponent: null as Awaited<ReturnType<typeof getComponent>> | null,
  }));

  const update = useUpdate();

  React.useEffect(() => {
    def.type === "component" &&
      getComponent(def.class, def.filepath).then((component) => {
        state.component ??= component;
        update();
      });
  }, []);

  React.useMemo(() => {
    if (!("props" in def)) {
      return;
    }
    state.childComponent = null;
    update();
    def.props.childComponent &&
      getComponent(def.props.childComponent, def.filepath).then((childComponent) => {
        state.childComponent = childComponent;
        update();
      });
  }, ["props" in def && def.props.childComponent]);

  if (def.type === "component") {
    return (
      (state.component &&
        (!def.props.childComponent || state.childComponent) &&
        React.createElement(state.component as React.FunctionComponent<any>, {
          disabled: tabState.disabled,
          ...def.props,
          childComponent: state.childComponent ?? undefined,
        })) ||
      null
    );
  }

  if (def.type === "terminal") {
    return (
      <Terminal
        disabled={tabState.disabled}
        sessionKey={def.filepath}
        env={{
          ...def.env,
          CACHE_SHORTCUTS: { w: "WORLD_KEY" },
        }}
        onKey={(e) => {
          if (e.key === "Escape" && api.enabled) {
            api.toggleEnabled();
          }
        }}
      />
    );
  }

  return (
    <div style={{ background: "white", color: "red" }}>
      TabMeta "{JSON.stringify(def)}" has unexpected type
    </div>
  );
}

interface TabProps {
  def: TabDef;
  api: TabsApi;
  state: TabState;
  disabled: boolean;
  forceUpdate: boolean;
}

export const TabMemo = React.memo(
  Tab,
  (prev, next) => prev.disabled === next.disabled && !next.forceUpdate
);
