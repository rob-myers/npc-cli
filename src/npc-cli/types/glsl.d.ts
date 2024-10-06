declare global {
  namespace JSX {

    type BaseExtendedShaderMaterial<T = {}> = import('@react-three/fiber').Object3DNode<
      import('three').ShaderMaterial,
      typeof THREE.ShaderMaterial
    > & T;

    type Vector3Input = import('three').Vector3Tuple | import('three').Vector3Like;
    type Vector2Input = import('three').Vector2Tuple | import('three').Vector2;
    
    interface IntrinsicElements {
      instancedMonochromeShader: BaseExtendedShaderMaterial<{
        diffuse?: Vector3Input;
        objectPicking?: boolean;
      }>;
      instancedSpriteSheetMaterial: BaseExtendedShaderMaterial<{
        map: import('three').CanvasTexture;
      }>;
      cameraLightMaterial: BaseExtendedShaderMaterial<{
        diffuse?: Vector3Input;
      }>;
      testCharacterMaterial: BaseExtendedShaderMaterial<{
        diffuse?: Vector3Input;
        showLabel?: boolean;
        labelHeight?: number;
        showSelector?: boolean;
        selectorColor?: Vector3Input;

        uFaceTexId?: number;
        uFaceUv?: Vector2Input[];
        uIconTexId?: number;
        uIconUv?: Vector2Input[];

        uLabelTexId?: number;
        uLabelUv?: Vector2Input[];
        uLabelDim?: Vector2Input;
      }>;
    }
  }
}

export {}; // Required
