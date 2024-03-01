import React from "react";
import { css, cx } from "@emotion/css";
import { shallow } from "zustand/shallow";

import { afterBreakpoint, breakpoint } from "./const";
import useStateRef from "../npc-cli/hooks/use-state-ref";
import useSite from "./site.store";
import { view } from "./const";
import { profileLookup } from "../npc-cli/sh/scripts";

import { Tabs, State as TabsState } from "../npc-cli/tabs/Tabs";
import ViewerControls from "./ViewerControls";

export default function Viewer() {
  const site = useSite(({ browserLoaded, viewOpen }) => ({ browserLoaded, viewOpen }), shallow);

  const state = useStateRef(
    (): State => ({
      rootEl: {} as HTMLElement,
      tabs: {} as TabsState,
    })
  );

  return (
    <aside
      className={cx(viewerCss, { collapsed: !site.viewOpen })}
      data-testid="viewer"
      ref={(el) => el && (state.rootEl = el)}
      style={
        site.browserLoaded && !site.viewOpen
          ? useSite.api.isSmall()
            ? { minHeight: "0%" }
            : { minWidth: "0%" }
          : undefined
      }
    >
      <ViewerControls api={state} />
      <Tabs
        ref={(x) => x && (state.tabs = x)}
        id="viewer-tabs"
        initEnabled={false}
        tabs={[
          [
            {
              type: "component",
              class: "R3FDemo",
              filepath: "r3f-demo",
              props: {
                gmDefs: [
                  { gmKey: "g-301--bridge" },
                  // { gmKey: 'g-103--cargo-bay', transform: [1, 0, 0, 1, 1200, 0] },
                  { gmKey: "g-101--multipurpose", transform: [1, 0, 0, 1, 0, 600] },
                  {
                    gmKey: "g-302--xboat-repair-bay",
                    transform: [1, 0, 0, -1, -1200 * 2, 600 + 1200],
                  },
                  { gmKey: "g-303--passenger-deck", transform: [1, 0, 0, -1, -1200, 1200 + 600] },
                  { gmKey: "g-302--xboat-repair-bay", transform: [-1, 0, 0, 1, 1200 + 1200, 600] },
                  { gmKey: "g-301--bridge", transform: [1, 0, 0, -1, 0, 600 + 1200 + 600] },
                  { gmKey: "g-102--research-deck", transform: [1, 0, 0, 1, -1200, 0] },
                ],
              },
            },
          ],
          [
            {
              type: "terminal",
              filepath: "tty-1",
              env: { WORLD_KEY: "world-1", PROFILE: profileLookup.util_0() },
            },
            { type: "component", class: "HelloWorld", filepath: "hello-world-2", props: {} },
          ],
        ]}
        persistLayout
      />
    </aside>
  );
}

export interface State {
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
  }

  @media (max-width: ${breakpoint}) {
    flex-direction: column;
    transition: min-height 500ms;
    min-height: var(--viewer-min);
  }
`;
