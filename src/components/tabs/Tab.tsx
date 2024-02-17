import React from "react";
import { useQuery } from "@tanstack/react-query";

import type { TabState } from "./Tabs";
import { TabDef, getComponent } from "./tabs.util";

export const TabMemo = React.memo(Tab, (prev, next) => prev.disabled === next.disabled);

export function Tab({ def, state }: TabProps) {
  const { data: component } = useQuery({
    queryKey: [def.type === "component" ? def.class : "null-query"],
    async queryFn() {
      return def.type === "component" ? await getComponent(def) : null;
    },
  });

  if (def.type === "component") {
    return (
      (component &&
        React.createElement(component, {
          disabled: state.disabled,
          ...def.props, // propagate props from <Tabs> prop tabs
        })) ||
      null
    );
  }

  if (def.type === "terminal") {
    return `
      __TODO__ <Terminal>
    `;
  }

  return (
    <div style={{ background: "white", color: "red" }}>
      TabMeta "{JSON.stringify(def)}" has unexpected type
    </div>
  );
}

interface TabProps {
  def: TabDef;
  state: TabState;
  disabled: boolean;
}
