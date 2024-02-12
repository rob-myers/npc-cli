import React from "react";
import loadable from "@loadable/component";
import { IJsonModel, Model, TabNode } from "flexlayout-react";

import { deepClone, tryLocalStorageGet, tryLocalStorageSet } from "src/js/service/generic";
import { Props as TabsProps, State as TabsApi } from "./Tabs";
import { Tab } from "./Tab";

export function factory(node: TabNode, api: TabsApi) {
  if (api.maxTabNode !== null && node.getParent() !== api.maxTabNode.getParent()) {
    // According to flexlayout-react, a selected tab is "visible" when obscured by a maximised tab.
    // To fix this, if some tab is maximised, we only render siblings of the maximised tab.
    return null;
  } else if (!api.componentMeta[node.getId()]) {
    return null;
  } else {
    return React.createElement(Tab, {
      id: node.getId(),
      meta: node.getConfig() as TabMeta,
      api,
    });
  }
}

export type TabMeta = { weight?: number } & (
  | ({
      type: "component";
      filepath: string;
      class: ComponentClassKey;
    } & TabMetaComponentProps)
  | {
      type: "terminal";
      /** Session identifier */
      filepath: string;
      env?: Record<string, any>;
    }
);

export interface TabsDef {
  /** Required e.g. as identifier */
  id: string;
  /** List of rows each with a single tabset */
  tabs: TabMeta[][];
  /** Initially enabled? */
  initEnabled?: boolean;
  persistLayout?: boolean;
}

/** Same as `node.getId()` ? */
function getTabIdentifier(meta: TabMeta) {
  return meta.filepath;
}

//#region components

const classToComponent = {
  // WorldPixi: {
  //   loadable: loadable(() => import('projects/world-pixi/WorldPixi')),
  //   get: (module: typeof import('projects/world-pixi/WorldPixi')) =>
  //     (props: ComponentProps<typeof module['default']>) =>
  //       <module.default disabled {...props} />,
  // },
  // GeomorphEdit: {
  //   loadable: loadable(() => import('projects/geomorph/GeomorphEdit')),
  //   get: (module: typeof import('projects/geomorph/GeomorphEdit')) =>
  //     (props: ComponentProps<typeof module['default']>) =>
  //       <module.default disabled {...props} />,
  // },
  HelloWorld: {
    loadable: loadable(() => import("src/js/components/HelloWorld")),
    get:
      (module: typeof import("src/js/components/HelloWorld")) =>
      (props: React.ComponentProps<(typeof module)["default"]>) =>
        React.createElement(module.default, { disabled: true, ...props }),
  },
  // SvgNavGraph: {
  //   loadable: loadable(() => import('projects/example/SvgNavGraph')),
  //   get: (module: typeof import('projects/example/SvgNavGraph')) =>
  //     (props: ComponentProps<typeof module['default']>) =>
  //       <module.default disabled {...props} />,
  // },
  // SvgStringPull: {
  //   loadable: loadable(() => import('projects/example/SvgStringPull')),
  //   get: (module: typeof import('projects/example/SvgStringPull')) =>
  //     (props: ComponentProps<typeof module['default']>) =>
  //       <module.default disabled {...props} />,
  // },
};

export async function getComponent(meta: Extract<TabMeta, { type: "component" }>) {
  return (
    classToComponent[meta.class]?.get(
      (await classToComponent[meta.class].loadable.load()) as any
    ) ?? FallbackComponentFactory(meta.filepath)
  );
}

/** Components we can instantiate inside a tab */
export type ComponentClassKey = keyof typeof classToComponent;

type TabMetaComponentProps = {
  [K in ComponentClassKey]: {
    class: K;
    props: Parameters<ReturnType<(typeof classToComponent)[K]["get"]>>[0];
  };
}[ComponentClassKey];

export interface BaseComponentProps {
  disabled?: boolean;
}

function FallbackComponentFactory(componentKey: string) {
  return () =>
    React.createElement(
      "div",
      { style: { color: "white", padding: "0 8px", fontSize: 20 } },
      `Component "${componentKey}" not found`
    );
}

//#endregion

//#region persist

export function createOrRestoreJsonModel(props: TabsProps) {
  const jsonModelString = tryLocalStorageGet(`model@${props.id}`);

  if (props.persistLayout && jsonModelString) {
    try {
      const serializable = JSON.parse(jsonModelString) as IJsonModel;
      (serializable.global ?? {}).splitterExtra = 12; // Larger splitter hit test area
      (serializable.global ?? {}).splitterSize = 2;

      const model = Model.fromJson(serializable);

      // Overwrite persisted `TabMeta`s with their value from `props`
      const tabKeyToMeta = props.tabs
        .flatMap((x) => x)
        .reduce(
          (agg, item) => Object.assign(agg, { [getTabIdentifier(item)]: item }),
          {} as Record<string, TabMeta>
        );
      model.visitNodes(
        (x) =>
          x.getType() === "tab" &&
          Object.assign((x as TabNode).getConfig(), tabKeyToMeta[x.getId()])
      );

      // Validate i.e. props.tabs must mention same ids
      const prevTabNodeIds = [] as string[];
      model.visitNodes((x) => x.getType() === "tab" && prevTabNodeIds.push(x.getId()));
      const nextTabNodeIds = props.tabs.flatMap((x) => x.map(getTabIdentifier));
      if (
        prevTabNodeIds.length === nextTabNodeIds.length &&
        prevTabNodeIds.every((id) => nextTabNodeIds.includes(id))
      ) {
        return model;
      } else {
        throw Error(`prev/next ids differ:
  ${JSON.stringify(prevTabNodeIds)}
  versus
  ${JSON.stringify(nextTabNodeIds)}`);
      }
    } catch (e) {
      console.error("createOrRestoreJsonModel", e);
    }
  }

  // Either: (a) no Tabs model found in local storage, or
  // (b) Tabs prop "tabs" has different ids
  return Model.fromJson(computeJsonModel(props.tabs, props.rootOrientationVertical));
}

function computeJsonModel(tabs: TabMeta[][], rootOrientationVertical?: boolean): IJsonModel {
  return {
    global: {
      tabEnableRename: false,
      rootOrientationVertical,
      tabEnableClose: false,
      // Use `visibility: hidden` instead of `display: none`,
      // so we can e.g. getBoundingClientRect() for npc getPosition.
      enableUseVisibility: true,
    },
    layout: {
      type: "row",
      // One row for each list in `tabs`.
      children: tabs.map((metas) => ({
        type: "row",
        weight: metas[0]?.weight,
        // One tabset for each list in `tabs`
        children: [
          {
            type: "tabset",
            // One tab for each meta in `metas`
            children: metas.map((meta) => ({
              type: "tab",
              // Tabs must not be duplicated within same `Tabs`,
              // for otherwise this internal `id` will conflict.
              id: getTabIdentifier(meta),
              name: getTabIdentifier(meta),
              config: deepClone(meta),
            })),
          },
        ],
      })),
    },
  };
}

export function storeModelAsJson(id: string, model: Model) {
  const serializable = model.toJson();
  tryLocalStorageSet(`model@${id}`, JSON.stringify(serializable));
}

//#endregion
