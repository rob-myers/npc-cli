import React from "react";
import { css, cx } from "@emotion/css";
import { shallow } from "zustand/shallow";
import debounce from "debounce";

import { view } from "../const";
import { profileLookup } from "../npc-cli/sh/scripts";
import { afterBreakpoint, breakpoint } from "../const";
import useIntersection from "../npc-cli/hooks/use-intersection";
import useStateRef from "../npc-cli/hooks/use-state-ref";
import useSite from "./site.store";
import useUpdate from "../npc-cli/hooks/use-update";

import { Tabs, State as TabsState } from "../npc-cli/tabs/Tabs";
import ViewerControls from "./ViewerControls";

export default function Viewer() {
  const site = useSite(({ browserLoaded, viewOpen }) => ({ browserLoaded, viewOpen }), shallow);

  const state = useStateRef(
    (): State => ({
      onChangeIntersect: debounce((intersects: boolean) => {
        !intersects && state.tabs.enabled && state.tabs.toggleEnabled();
        update();
      }, 1000),
      onKeyDown(e) {
        if (e.key === "Escape" && state.tabs.enabled) {
          state.tabs.toggleEnabled();
        }
        if (e.key === "Enter" && !state.tabs.enabled) {
          state.tabs.toggleEnabled();
        }
      },
      rootEl: null as any,
      tabs: {} as TabsState,
    })
  );

  useIntersection({
    elRef: () => state.rootEl,
    cb: state.onChangeIntersect,
    trackVisible: true,
  });

  const update = useUpdate();

  return (
    <aside
      className={cx(viewerCss, { collapsed: !site.viewOpen })}
      data-testid="viewer"
      ref={(el) => el && (state.rootEl = el)}
      tabIndex={0}
      onKeyDown={state.onKeyDown}
    >
      <ViewerControls api={state} />
      <Tabs
        ref={(x) => x && (state.tabs = x)}
        id="viewer-tabs"
        browserLoaded={site.browserLoaded}
        initEnabled={false}
        collapsed={!site.viewOpen}
        tabs={[
          [
            {
              type: "component",
              class: "TestWorld",
              filepath: "test-world-1",
              props: { mapKey: "demo-map-1" },
            },
            {
              type: "terminal",
              filepath: "tty-1",
              env: { WORLD_KEY: "world-1", PROFILE: profileLookup.util_0() },
            },
            {
              type: "component",
              class: "TestCharacter",
              filepath: "test-character",
              props: {},
            },
            { type: "component", class: "TestWorker", filepath: "r3-worker-demo", props: {} },
          ],
          [{ type: "component", class: "HelloWorld", filepath: "hello-world-1", props: {} }],
        ]}
        persistLayout
        onToggled={update}
      />
    </aside>
  );
}

export interface State {
  onChangeIntersect(intersects: boolean): void;
  onKeyDown(e: React.KeyboardEvent): void;
  rootEl: HTMLElement;
  /** Tabs API */
  tabs: TabsState;
}

const viewerCss = css`
  // For ViewerControls
  --view-bar-size: ${view.barSize};
  --view-icon-size: ${view.iconSize};

  position: relative;
  color: white;
  background: black;
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;

  &:not(.collapsed) > figure.tabs {
    cursor: auto;
    opacity: 1;
    transition: opacity 200ms 100ms; // delay 100ms
  }
  &.collapsed > figure.tabs {
    pointer-events: none;
    opacity: 0;
    transition: opacity 200ms;
  }

  display: flex;
  justify-content: flex-end;

  // if never drag or maximise, toggle acts like this
  --viewer-min: 50%;
  &.collapsed {
    --viewer-min: 0%;
  }

  @media (min-width: ${afterBreakpoint}) {
    flex-direction: row;
    transition: min-width 500ms;
    min-width: var(--viewer-min);
    &.collapsed {
      min-width: 0%;
    }
  }

  @media (max-width: ${breakpoint}) {
    flex-direction: column;
    transition: min-height 500ms;
    min-height: var(--viewer-min);
    &.collapsed {
      min-height: 0%;
    }
  }
`;
