import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Subject } from "rxjs";

import { isDevelopment } from "../service/generic";
import TestWorldCanvas from "./TestWorldCanvas";
import useStateRef from "../hooks/use-state-ref";
import TestWorldScene from "./TestWorldScene";
import { TestWorldContext } from "./test-world-context";

/**
 * @param {Props} props
 */
export default function TestWorld(props) {
  const state = useStateRef(
    /** @returns {State} */ () => ({
      events: new Subject(),
      map: null,
      scene: /** @type {*} */ (null),
      view: /** @type {*} */ (null),
    })
  );

  const { data: assetsJson } = useQuery({
    queryKey: ["assets-meta.json"],
    /** @returns {Promise<Geomorph.AssetsJson>} */
    queryFn: () => fetch("/assets/assets-meta.json").then((x) => x.json()),
    refetchOnWindowFocus: isDevelopment() ? "always" : undefined,
  });

  state.map = assetsJson?.maps[props.mapKey ?? ""] ?? null;

  return (
    <TestWorldContext.Provider value={state}>
      <TestWorldCanvas disabled={props.disabled} stats>
        {state.map && <TestWorldScene disabled={props.disabled} map={state.map} />}
      </TestWorldCanvas>
    </TestWorldContext.Provider>
  );
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 * @property {string} [mapKey]
 */

/**
 * @typedef State
 * @property {Subject<NPC.Event>} events
 * @property {Geomorph.MapDef | null} map
 * @property {import('./TestWorldScene').State} scene
 * @property {import('./TestWorldCanvas').State} view
 */
