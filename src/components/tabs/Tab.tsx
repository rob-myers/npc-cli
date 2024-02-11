import React from "react";
import { useQuery } from "@tanstack/react-query";

import type { State as TabsApi } from "./Tabs";
import { TabMeta, getComponent } from "./tabs.util";

export function Tab({ id: componentKey, meta, api }: TabProps) {
  const { disabled } = api.componentMeta[componentKey];

  const { data: component } = useQuery({
    queryKey: [meta.type === "component" ? componentKey : "empty"],
    async queryFn() {
      return meta.type === "component" ? await getComponent(meta) : null;
    },
  });

  if (meta.type === "component") {
    return (
      (component &&
        React.createElement(component, {
          disabled,
          ...meta.props, // propagate props from <Tabs> prop tabs
        })) ||
      null
    );
  }

  if (meta.type === "terminal") {
    return `
      __TODO__ <Terminal>
    `;
  }

  return (
    <div style={{ background: "white", color: "red" }}>
      TabMeta "{JSON.stringify(meta)}" has unexpected type
    </div>
  );
}

interface TabProps {
  /** Component key */
  id: string;
  meta: TabMeta;
  api: TabsApi;
}
