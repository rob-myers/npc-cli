import React, { ComponentProps } from "react";
import { css, cx } from "@emotion/css";
import { shallow } from "zustand/shallow";
import debounce from "debounce";

import { view } from "../const";
import { afterBreakpoint, breakpoint } from "../const";
import useSite from "./site.store";

import { profile } from "src/npc-cli/sh/src";
import { isTouchDevice } from "src/npc-cli/service/dom";

import useIntersection from "../npc-cli/hooks/use-intersection";
import useStateRef from "../npc-cli/hooks/use-state-ref";
import useUpdate from "../npc-cli/hooks/use-update";
import { Tabs, State as TabsState } from "../npc-cli/tabs/Tabs";
import ViewerControls from "./ViewerControls";

export default function Viewer() {
  const site = useSite(({ browserLoaded, viewOpen }) => ({ browserLoaded, viewOpen }), shallow);

  const state = useStateRef<State>(() => ({
    rootEl: null as any,
    tabs: {} as TabsState,
    onChangeIntersect: debounce((intersects: boolean) => {
      !intersects && state.tabs.enabled && state.tabs.toggleEnabled();
      update();
    }, 1000),
    onKeyDown(e) {
      if (e.key === "Escape" && state.tabs.enabled) {
        state.tabs.toggleEnabled(false);
      }
      if (e.key === "Enter" && !state.tabs.enabled) {
        state.tabs.toggleEnabled(true);
      }
    },
  }));

  useIntersection({
    elRef: () => state.rootEl,
    cb: state.onChangeIntersect,
    trackVisible: true,
  });

  // React.useEffect(() => state.tabs.focusRoot(), []);

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
        ref={x => state.tabs = x ?? state.tabs}
        id="viewer-tabs"
        browserLoaded={site.browserLoaded}
        collapsed={!site.viewOpen}
        initEnabled={false}
        onToggled={update}
        persistLayout
        rootOrientationVertical
        tabs={((tabsetDefs: ComponentProps<typeof Tabs>['tabs']) =>
          // Only one tabset on mobile
          isTouchDevice() ? [tabsetDefs.flatMap(x => x)] : tabsetDefs
        )([
          [
            {
              type: "component",
              class: "World",
              filepath: "test-world-1",
              // props: { worldKey: "test-world-1", mapKey: "small-map-1" },
              props: { worldKey: "test-world-1", mapKey: "demo-map-1" },
            },
            // {
            //   type: "component",
            //   class: "TestCharacterDemo",
            //   filepath: "test-character-demo",
            //   props: {},
            // },
            // { type: "component", class: "TestWorker", filepath: "r3-worker-demo", props: {} },
          ],
          [
            {
              type: "terminal",
              filepath: "tty-1",
              env: { WORLD_KEY: "test-world-1", PROFILE: profile.profile1Sh },
            },
            {
              type: "terminal",
              filepath: "tty-2",
              env: { WORLD_KEY: "test-world-1", PROFILE: profile.profileAwaitWorldSh },
            },
            { type: "component", class: "HelloWorld", filepath: "hello-world-1", props: {} },
          ],
        ])}
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
