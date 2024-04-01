import { Object3D } from "three";
import { Object3DNode } from "@react-three/fiber";
import InfiniteGridHelper from "../aux/infinite-grid-helper";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      infiniteGridHelper: Object3DNode<InfiniteGridHelper, typeof InfiniteGridHelper>;
      /** `object` assumed to extend `THREE.Object3D` */
      primitive: Object3DNode<Object3D, typeof Object3D> & { object: Object3D };
    }
  }
}
