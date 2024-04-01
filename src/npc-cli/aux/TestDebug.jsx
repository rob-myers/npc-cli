import React from "react";
import { NavMeshHelper } from "@recast-navigation/three";

import { wireFrameMaterial } from "../service/three";
import { TestWorldContext } from "./test-world-context";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props 
 */
export default function TestDebug(props) {
  const api = React.useContext(TestWorldContext);

  const state = useStateRef(/** @type {State} */ () => ({
    navMeshHelper: /** @type {*} */ (null),
  }));

  React.useMemo(() => {
    state.navMeshHelper = new NavMeshHelper({
      navMesh: api.nav.navMesh,
      navMeshMaterial: wireFrameMaterial,
    });
  }, [api.nav.navMesh]);

  return <>
    <group
      position={[0, 0.01, 0]}
      visible={false}
    >
      <primitive object={state.navMeshHelper} />
    </group>
  </>;
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 */

/**
 * @typedef State
 * @property {NavMeshHelper} navMeshHelper
 */