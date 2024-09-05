declare global {
  namespace JSX {

    type BaseExtendedShaderMaterial<T = {}> = import('@react-three/fiber').Object3DNode<
      import('three').ShaderMaterial,
      typeof THREE.ShaderMaterial
    > & T;
    
    interface IntrinsicElements {
      instancedMonochromeShader: BaseExtendedShaderMaterial<{
        diffuse?: import('three').Vector3Tuple | import('three').Vector3Like;
        objectPicking?: boolean;
      }>;
      instancedSpriteSheetMaterial: BaseExtendedShaderMaterial<{
        map: import('three').CanvasTexture;
      }>;
      cameraLightMaterial: BaseExtendedShaderMaterial<{
        diffuse?: import('three').Vector3Tuple | import('three').Vector3Like;
      }>;
    }
  }
}

export {}; // Required
