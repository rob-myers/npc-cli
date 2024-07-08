declare global {
  namespace JSX {
    interface IntrinsicElements {
      instancedSpriteSheetMaterial: import('@react-three/fiber').Object3DNode<THREE.ShaderMaterial, typeof THREE.ShaderMaterial> & {
        map: THREE.CanvasTexture;
      };
      meshDiffuseTestMaterial: import('@react-three/fiber').Object3DNode<THREE.ShaderMaterial, typeof THREE.ShaderMaterial> & {
        // ...
      };
    }
  }
}

export {}; // Required
