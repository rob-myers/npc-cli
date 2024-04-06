import React from "react";
import * as THREE from "three";
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

    {props.showOrigNavPoly && api.gms.map((gm, gmId) => (
      <group
        key={`${gm.key} ${gmId} ${gm.transform}`}
        onUpdate={(group) => group.applyMatrix4(gm.mat4)}
        // ref={(group) => group?.applyMatrix4(gm.mat4)}
      >
        <mesh
          name="origNavPoly"
          args={[api.gmData[gm.key].debugNavPoly, origNavPolyMaterial]}
          position={[0, 0.001, 0]}
          visible={props.showOrigNavPoly}
        />
      </group>
    ))}
  </>;
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 * @property {boolean} [showOrigNavPoly]
 */

/**
 * @typedef State
 * @property {NavMeshHelper} navMesh
 * @property {NavPathHelper} navPath
 */

const origNavPolyMaterial = new THREE.MeshBasicMaterial({
  side: THREE.FrontSide,
  color: "green",
  wireframe: false,
  transparent: true,
  opacity: 0.4,
});
