import { Object3DNode } from "@react-three/fiber";
import InfiniteGridHelper from "../aux/infinite-grid-helper";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      infiniteGridHelper: Object3DNode<InfiniteGridHelper, typeof InfiniteGridHelper>;
    }
  }
}
