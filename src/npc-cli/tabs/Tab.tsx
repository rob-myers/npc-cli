import React from "react";

import type { TabState, State as TabsApi } from "./Tabs";
import { TabDef, getComponent, Terminal } from "./tab-factory";

export const TabMemo = React.memo(Tab, (prev, next) => prev.disabled === next.disabled);

export function Tab({ def, api, state }: TabProps) {

  const [component, setComponent] = React.useState<
    Awaited<ReturnType<typeof getComponent>> | null
  >(null);

  React.useEffect(() => {
    if (def.type === "component") {
      getComponent(def).then(x => setComponent(() => x));
    }
  }, []);

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
