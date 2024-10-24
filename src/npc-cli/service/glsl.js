import * as THREE from "three";
import { extend } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import { wallHeight } from "./const";
import { defaultQuadUvs } from "./three";

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
 * - Assumes specific mesh cuboid-man with 64 vertices.
 * - Supports similar mesh i.e. cuboid-pet.
 * - Based on `cameraLightShader`
 * - Does not support instancing
 * - Assumes USE_LOGDEPTHBUF
 */
export const cuboidManShader = {

  Vert: /*glsl*/`

  uniform bool showLabel;
  uniform bool showSelector;

  uniform float labelHeight;
  uniform vec3 selectorColor;

  uniform int uFaceTexId;
  uniform vec2 uFaceUv[4];
  uniform int uIconTexId;
  uniform vec2 uIconUv[4];
  uniform int uLabelTexId;
  uniform vec2 uLabelUv[4];
  // label width/height changes
  uniform vec2 uLabelDim;

  attribute int vertexId;

  flat varying int vId;
  varying vec2 vUv;
  varying vec3 vColor;
  flat varying float dotProduct;

  #include <common>
  #include <uv_pars_vertex>
  #include <skinning_pars_vertex>
  #include <logdepthbuf_pars_vertex>

  void main() {
    #include <uv_vertex>
    #include <skinbase_vertex>
    #include <beginnormal_vertex>
    #include <skinnormal_vertex>
    vec3 transformed = vec3(position);
    #include <skinning_vertex>

    vId = vertexId;
    vColor = vec3(1.0);
    vUv = uv;

    // ℹ️ unused "uvs from DataTexture"
    // vec2 uvId = vec2( float (vId) / 64.0, 0.0);
    // vUv = texture2D(textures[1], uvId).xy;

    if (vId >= 60) {// ⭐️ label quad

      if (showLabel == false) {
        return;
      }

      vUv = uLabelUv[vId - 60];

      // Point above head
      vec4 mvPosition = modelViewMatrix * vec4(0.0, labelHeight, 0.0, 1.0);
      
      // Quad faces the camera
      // mvPosition.xy += transformed.xy;
      // Overwrite geometry for custom label width/height
      if (vId == 60) {
        mvPosition.xy += vec2(uLabelDim.x, uLabelDim.y) * 0.5;
      } else if (vId == 61) {
        mvPosition.xy += vec2(-uLabelDim.x, uLabelDim.y) * 0.5;
      } else if (vId == 62) {
        mvPosition.xy += vec2(uLabelDim.x, -uLabelDim.y) * 0.5;
      } else {
        mvPosition.xy += vec2(-uLabelDim.x, -uLabelDim.y) * 0.5;
      }
      gl_Position = projectionMatrix * mvPosition;
      #include <logdepthbuf_vertex>
      return;

    } else if (vId >= 56) {// ⭐️ icon quad

      vUv = uIconUv[vId - 56];

    } else if (vId >= 52) {// ⭐️ selector quad
      
      if (showSelector == false) {
        return;
      }

      vColor = selectorColor;

    } else if (vId <= 3 * 5) {// ⭐️ face quad

      // [3 * 0, 3 * 1, 3 * 4, 3 * 5]
      switch (vId) {
        case 0: vUv = uFaceUv[0]; break;
        case 3: vUv = uFaceUv[1]; break;
        case 12: vUv = uFaceUv[2]; break;
        case 15: vUv = uFaceUv[3]; break;
      }

    }

    vec4 mvPosition = vec4(transformed, 1.0);
    mvPosition = modelViewMatrix * mvPosition;
    gl_Position = projectionMatrix * mvPosition;

    #include <logdepthbuf_vertex>

    // dot product for basic lighting in fragment shader
    // vec3 transformedNormal = normalize(normalMatrix * vec3(normal));
    vec3 transformedNormal = normalize(normalMatrix * vec3(objectNormal));
    vec3 lightDir = normalize(mvPosition.xyz);
    dotProduct = -min(dot(transformedNormal, lightDir), 0.0);
  }
  `,

  Frag: /*glsl*/`

  uniform vec3 diffuse;
  uniform float opacity;

  uniform sampler2D uBaseTexture;
  uniform sampler2D uLabelTexture;
  uniform sampler2D uAlt1Texture;

  uniform int uFaceTexId;
  uniform int uIconTexId;
  uniform int uLabelTexId;

  flat varying int vId;
	flat varying float dotProduct;
  varying vec3 vColor;
  varying vec2 vUv;

  #include <common>
  #include <uv_pars_fragment>
  #include <map_pars_fragment>
  #include <logdepthbuf_pars_fragment>

  //#region getTexelColor
  // ℹ️ https://stackoverflow.com/a/74729081/2917822
  vec4 getTexelColor(int texId, vec2 uv) {
    switch (texId) {
      case 0: return texture2D(uBaseTexture, uv);
      case 1: return texture2D(uLabelTexture, uv);
      case 2: return texture2D(uAlt1Texture, uv);
    }
    return vec4(0.0);
  }
  //#endregion

  void main() {
    vec4 diffuseColor = vec4(diffuse, 1);
    #include <logdepthbuf_fragment>
    #include <map_fragment>

    if (vId >= 60) {// ⭐️ label quad

      diffuseColor *= getTexelColor(uLabelTexId, vUv);

    } else if (vId >= 56) {// ⭐️ icon quad

      diffuseColor *= getTexelColor(uIconTexId, vUv);
      
    } else {

      switch (vId) {
        case 0: case 3: case 12: case 15: // ⭐️ face quad
          diffuseColor *= getTexelColor(uFaceTexId, vUv);
        break;
        default:
          diffuseColor *= getTexelColor(0, vUv);
      }

    }

    diffuseColor.a *= opacity;

    if (diffuseColor.a < 0.1) {
      discard;
    }

    if (vId >= 60) {// ⭐️ label quad (no lighting)

      gl_FragColor = vec4(vColor * vec3(diffuseColor) * 1.0, diffuseColor.a);

    } else if (vId >= 52 && vId < 56) { // ⭐️ selector quad (no lighting)

      gl_FragColor = vec4(vColor * vec3(diffuseColor) * 1.0, diffuseColor.a);

    } else {// basic lighting

      gl_FragColor = vec4(vColor * vec3(diffuseColor) * (0.1 + 0.7 * dotProduct), diffuseColor.a);

    }

  }
  `,
};

// 🚧 WIP
export const instancedMultiTextureShader = {
  Vert: ``,
  Frag: /* glsl */`
    //#region getTexelColor
    // ℹ️ https://stackoverflow.com/a/74729081/2917822
    vec4 getTexelColor(int texId, vec2 uv) {
      switch (texId) {
        case 0: return texture2D(textures[0], uv);
        case 1: return texture2D(textures[1], uv);
        case 2: return texture2D(textures[2], uv);
        case 3: return texture2D(textures[3], uv);
        case 4: return texture2D(textures[4], uv);
        case 5: return texture2D(textures[5], uv);
        case 6: return texture2D(textures[6], uv);
        case 7: return texture2D(textures[7], uv);
        case 8: return texture2D(textures[8], uv);
        case 9: return texture2D(textures[9], uv);
        case 10: return texture2D(textures[10], uv);
        case 11: return texture2D(textures[11], uv);
        case 12: return texture2D(textures[12], uv);
        case 13: return texture2D(textures[13], uv);
        case 14: return texture2D(textures[14], uv);
        case 15: return texture2D(textures[15], uv);
        case 16: return texture2D(textures[16], uv);
        case 17: return texture2D(textures[17], uv);
        case 18: return texture2D(textures[18], uv);
        case 19: return texture2D(textures[19], uv);
        case 20: return texture2D(textures[20], uv);
        case 21: return texture2D(textures[21], uv);
        case 22: return texture2D(textures[22], uv);
        case 23: return texture2D(textures[23], uv);
        case 24: return texture2D(textures[24], uv);
        case 25: return texture2D(textures[25], uv);
        case 26: return texture2D(textures[26], uv);
        case 27: return texture2D(textures[27], uv);
        case 28: return texture2D(textures[28], uv);
        case 29: return texture2D(textures[29], uv);
        case 30: return texture2D(textures[30], uv);
        case 31: return texture2D(textures[31], uv);
      }
      return vec4(0.0);
    }
    //#endregion
  `, // 🚧
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

export const CuboidManMaterial = shaderMaterial(
  {
    diffuse: new THREE.Vector3(1, 0.9, 0.6),
    // 🔔 map, mapTransform required else can get weird texture
    map: null,
    mapTransform: new THREE.Matrix3(),
    opacity: 1,

    showLabel: true,
    labelHeight: wallHeight,
    showSelector: true,
    selectorColor: [0, 0, 1],

    uBaseTexture: null,
    uLabelTexture: null,
    uAlt1Texture: null,

    uFaceTexId: 0,
    uIconTexId: 0,
    uLabelTexId: 0,
    uFaceUv: defaultQuadUvs,
    uIconUv: defaultQuadUvs,
    uLabelUv: defaultQuadUvs,
    uLabelDim: defaultQuadUvs[0],
  },
  cuboidManShader.Vert,
  cuboidManShader.Frag,
);

/**
 * @see glsl.d.ts
 */
extend({
  InstancedMonochromeShader,
  InstancedSpriteSheetMaterial,
  CameraLightMaterial,
  CuboidManMaterial,
});
