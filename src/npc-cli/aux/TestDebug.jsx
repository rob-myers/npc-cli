import React from "react";
import { NavMeshHelper } from "@recast-navigation/three";

import { wireFrameMaterial } from "../service/three";
import { TestWorldContext } from "./test-world-context";
import useStateRef from "../hooks/use-state-ref";
import NavPathHelper from "./NavPathHelper";

/**
 * @param {Props} props 
 */
export default function TestDebug(props) {
  const api = React.useContext(TestWorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    navMesh: /** @type {*} */ (null),
    navPath: new NavPathHelper(), // 🚧 needs dispose?
  }));

  api.debug = state;

  React.useMemo(() => {
    state.navMesh = new NavMeshHelper({
      navMesh: api.nav.navMesh,
      navMeshMaterial: wireFrameMaterial,
    });
  }, [api.nav.navMesh]);

  return <>
    <primitive
      name="NavMeshHelper"
      position={[0, 0.01, 0]}
      object={state.navMesh}
      // visible={false}
    />

    <primitive
      name="NavPathHelper"
      object={state.navPath}
    />
  </>;
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 */

/**
 * @typedef State
 * @property {NavMeshHelper} navMesh
 * @property {NavPathHelper} navPath
 */