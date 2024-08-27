import React from "react";

import type { TabState, State as TabsApi } from "./Tabs";
import { TabDef, getComponent, Terminal, BaseTabProps } from "./tab-factory";
import useUpdate from "../hooks/use-update";
import useStateRef from "../hooks/use-state-ref";

export function Tab({ def, api, state: tabState }: TabProps) {

  const state = useStateRef(() => ({
    component: null as Awaited<ReturnType<typeof getComponent>> | null,
    onTerminalKey(e: KeyboardEvent) {
      if (api.enabled === true) {
        e.key === 'Escape' && api.toggleEnabled(false);
      }
      // 🔔 cannot enable Tabs on 'Enter' because we permit
      // using the terminal whilst !api.enabled (debug mode)
    },
    setTabsEnabled(next: boolean) {
      api.toggleEnabled(next);
    },
  }));

  const update = useUpdate();

  React.useEffect(() => {
    def.type === "component" &&
      getComponent(def.class, def.filepath).then((component) => {
        state.component ??= component;
        update();
      });
  }, []);

  if (def.type === "component") {
    return (
      (state.component &&
        React.createElement(state.component as React.FunctionComponent<BaseTabProps>, {
          disabled: tabState.disabled,
          setTabsEnabled: state.setTabsEnabled,
          ...def.props,
        })) ||
      null
    );
  }

  if (def.type === "terminal") {
    return (
      <Terminal
        disabled={tabState.disabled}
        setTabsEnabled={state.setTabsEnabled}

        sessionKey={def.filepath}
        env={{
          ...def.env,
          CACHE_SHORTCUTS: { w: "WORLD_KEY" },
        }}
        onKey={state.onTerminalKey}
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
