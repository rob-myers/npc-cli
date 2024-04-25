import { Object3D, ShaderMaterial } from "three";
import { Object3DNode } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import InfiniteGridHelper from "../aux/infinite-grid-helper";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      infiniteGridHelper: Object3DNode<InfiniteGridHelper, typeof InfiniteGridHelper>;
      obstacleShaderMaterial: Object3DNode<ShaderMaterial, typeof ShaderMaterial>;
      /** `object` assumed to extend `THREE.Object3D` */
      primitive: Object3DNode<Object3D, typeof Object3D> & { object: Object3D };
    }
  }
}
