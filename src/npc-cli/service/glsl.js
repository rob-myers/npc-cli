import * as THREE from "three";
import { extend } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";

const instancedMonochromeShader = {
  Vert: /*glsl*/`

  attribute int gmId;
  attribute int wallSegId;
  flat varying int vGmId;
  flat varying int vWallSegId;

  #include <common>
  #include <logdepthbuf_pars_vertex>

  void main() {
    vGmId = gmId;
    vWallSegId = wallSegId;

    vec4 modelViewPosition = vec4(position, 1.0);
    modelViewPosition = instanceMatrix * modelViewPosition;
    modelViewPosition = modelViewMatrix * modelViewPosition;
    
    gl_Position = projectionMatrix * modelViewPosition;
    #include <logdepthbuf_vertex>
  }

  `,

  Frag: /*glsl*/`

  uniform vec3 diffuse;
  uniform bool objectPicking;
  flat varying int vGmId;
  flat varying int vWallSegId;

  #include <common>
  #include <logdepthbuf_pars_fragment>

  void main() {

    if (objectPicking == true) {
      gl_FragColor = vec4(
        1.0 / 255.0, // 1 means wall
        float(vGmId) / 255.0,
        float((vWallSegId >> 8) & 255) / 255.0,
        float(vWallSegId & 255) / 255.0
        // 1
      );
      #include <logdepthbuf_fragment>
      return;
    }
    
    gl_FragColor = vec4(diffuse, 1);
    #include <logdepthbuf_fragment>
  }
  `,
};

const instancedUvMappingShader = {
  Vert: /*glsl*/`

  // <color_pars_vertex>
  varying vec3 vColor;
  
  varying vec2 vUv;
  attribute vec2 uvDimensions;
  attribute vec2 uvOffsets;

  #include <common>
  #include <logdepthbuf_pars_vertex>

  void main() {
    // vUv = uv;
    vUv = (uv * uvDimensions) + uvOffsets;
    vec4 modelViewPosition = vec4(position, 1.0);

    // USE_INSTANCING
    modelViewPosition = instanceMatrix * modelViewPosition;
    
    modelViewPosition = modelViewMatrix * modelViewPosition;
    gl_Position = projectionMatrix * modelViewPosition;

    vColor = vec3(1.0);
    #ifdef USE_INSTANCING_COLOR
      vColor.xyz *= instanceColor.xyz;
    #endif

    #include <logdepthbuf_vertex>
  }

  `,

  Frag: /*glsl*/`

  // <color_pars_fragment>
  varying vec3 vColor;
  uniform sampler2D map;

  varying vec2 vUv;
  uniform vec3 diffuse;

  #include <common>
  #include <logdepthbuf_pars_fragment>

  void main() {
    gl_FragColor = texture2D(map, vUv) * vec4(vColor * diffuse, 1);

    // 🔔 fix depth-buffer issue i.e. stop transparent pixels taking precedence
    if(gl_FragColor.a < 0.5) {
      discard;
    }

    #include <logdepthbuf_fragment>
  }
  `,

};

/**
 * - Shade color `diffuse` by light whose direction is always the camera's direction.
 * - Supports instancing.
 * - Supports a single texture.
 * - We're using this as a guide:
 *   - https://github.com/mrdoob/three.js/blob/master/src/renderers/shaders/ShaderLib/meshphong.glsl.js
 *   - https://ycw.github.io/three-shaderlib-skim/dist/#/latest/basic/vertex
 */
export const cameraLightShader = {
  Vert: /*glsl*/`

  flat varying float dotProduct;
  varying vec3 vColor;

  #include <common>
  #include <uv_pars_vertex>
  #include <logdepthbuf_pars_vertex>

  void main() {
    #include <uv_vertex>

    vec3 objectNormal = vec3( normal );
    vec3 transformed = vec3( position );
    vec4 mvPosition = vec4( transformed, 1.0 );

    #ifdef USE_INSTANCING
      mvPosition = instanceMatrix * mvPosition;
    #endif

    mvPosition = modelViewMatrix * mvPosition;
    gl_Position = projectionMatrix * mvPosition;

    #ifdef USE_LOGDEPTHBUF
      vFragDepth = 1.0 + gl_Position.w;
      vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
    #endif

    vec3 transformedNormal = objectNormal;
    #ifdef USE_INSTANCING
      mat3 im = mat3( instanceMatrix );
      transformedNormal = im * transformedNormal;
    #endif
    transformedNormal = normalMatrix * transformedNormal;

    vColor = vec3(1.0);
    #ifdef USE_INSTANCING_COLOR
      vColor.xyz *= instanceColor.xyz;
    #endif

    vec3 lightDir = normalize(mvPosition.xyz);
    dotProduct = -min(dot(normalize(transformedNormal), lightDir), 0.0);
  }
  `,

  Frag: /*glsl*/`

	flat varying float dotProduct;
  varying vec3 vColor;
  uniform vec3 diffuse;

  #include <common>
  #include <uv_pars_fragment>
  #include <map_pars_fragment>
  #include <logdepthbuf_pars_fragment>

  void main() {
    vec4 diffuseColor = vec4( diffuse, 1);
    #include <logdepthbuf_fragment>
    #include <map_fragment>

    // gl_FragColor = vec4(vColor * diffuse * (0.1 + 0.7 * dotProduct), 1);
    gl_FragColor = vec4(vColor * vec3(diffuseColor) * (0.1 + 0.7 * dotProduct), diffuseColor.a);
  }
  `,
};

/**
 * - Based on `cameraLightShader`
 * - Does not support instancing
 * - Intend to render some triangles as sprites.
 */
export const testCharacterShader = {
  Vert: /*glsl*/`

  flat varying float dotProduct;
  varying vec3 vColor;

  #include <common>
  #include <uv_pars_vertex>
  #include <logdepthbuf_pars_vertex>

  void main() {
    #include <uv_vertex>

    vec4 mvPosition = vec4(position, 1.0);
    mvPosition = modelViewMatrix * mvPosition;
    gl_Position = projectionMatrix * mvPosition;

    #ifdef USE_LOGDEPTHBUF
      vFragDepth = 1.0 + gl_Position.w;
      vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
    #endif

    vColor = vec3(1.0);

    vec3 transformedNormal = normalize(normalMatrix * vec3(normal));
    vec3 lightDir = normalize(mvPosition.xyz);
    dotProduct = -min(dot(transformedNormal, lightDir), 0.0);
  }
  `,

  Frag: /*glsl*/`

	flat varying float dotProduct;
  varying vec3 vColor;
  uniform vec3 diffuse;

  #include <common>
  #include <uv_pars_fragment>
  #include <map_pars_fragment>
  #include <logdepthbuf_pars_fragment>

  void main() {
    vec4 diffuseColor = vec4( diffuse, 1);
    #include <logdepthbuf_fragment>
    #include <map_fragment>
    gl_FragColor = vec4(vColor * vec3(diffuseColor) * (0.1 + 0.7 * dotProduct), diffuseColor.a);
  }
  `,
};

export const InstancedMonochromeShader = shaderMaterial(
  {
    diffuse: new THREE.Vector3(1, 0.5, 0.5),
    objectPicking: false,
  },
  instancedMonochromeShader.Vert,
  instancedMonochromeShader.Frag,
);

export const InstancedSpriteSheetMaterial = shaderMaterial(
  {
    map: null,
    diffuse: new THREE.Vector3(1, 0.9, 0.6),
    opacity: 0.6,
    alphaTest: 0.5,
    // mapTransform: new THREE.Matrix3(),
  },
  instancedUvMappingShader.Vert,
  instancedUvMappingShader.Frag,
);

export const CameraLightMaterial = shaderMaterial(
  {
    diffuse: new THREE.Vector3(1, 0.9, 0.6),
    // 🔔 map, mapTransform required else can get weird texture
    map: null,
    mapTransform: new THREE.Matrix3(),
  },
  cameraLightShader.Vert,
  cameraLightShader.Frag,
);

export const TestCharacterMaterial = shaderMaterial(
  {
    diffuse: new THREE.Vector3(1, 0.9, 0.6),
    // 🔔 map, mapTransform required else can get weird texture
    map: null,
    mapTransform: new THREE.Matrix3(),
  },
  testCharacterShader.Vert,
  testCharacterShader.Frag,
);

/**
 * @see glsl.d.ts
 */
extend({
  InstancedMonochromeShader,
  InstancedSpriteSheetMaterial,
  CameraLightMaterial,
  TestCharacterMaterial,
});
