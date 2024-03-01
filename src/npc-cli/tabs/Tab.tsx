import React from "react";
import { useQuery } from "@tanstack/react-query";

import type { TabState, State as TabsApi } from "./Tabs";
import { TabDef, getComponent, Terminal } from "./tabs.util";

export const TabMemo = React.memo(Tab, (prev, next) => prev.disabled === next.disabled);

export function Tab({ def, api, state }: TabProps) {
  const { data: component } = useQuery({
    queryKey: def.type === "component" ? ["Tab", def.class] : ["null-query"],
    async queryFn() {
      return def.type === "component" ? await getComponent(def) : null;
    },
  });

  if (def.type === "component") {
    return (
      (component &&
        React.createElement(component as React.FunctionComponent<any>, {
          disabled: state.disabled,
          ...def.props,
        })) ||
      null
    );
  }

  if (def.type === "terminal") {
    return (
      <Terminal
        disabled={state.disabled}
        sessionKey={def.filepath}
        env={{
          ...def.env,
          CACHE_SHORTCUTS: { w: "WORLD_KEY" },
        }}
        onKey={(e) => {
          if (e.key === "Escape" && api.enabled) {
            api.toggleEnabled();
            // Prevent subsequent Enter from propagating to TTY
            api.focusRoot();
          }
          if (e.key === "Enter" && !api.enabled) {
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
}
