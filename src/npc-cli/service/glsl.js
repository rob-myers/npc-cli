import * as THREE from "three";
import { extend } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import { wallHeight } from "./const";
import { defaultQuadUvs, emptyDataArrayTexture } from "./three";

const instancedMonochromeShader = {
  Vert: /*glsl*/`

  attribute uint instanceIds;
  flat varying uint vInstanceId;

  #include <common>
  #include <logdepthbuf_pars_vertex>

  void main() {
    vInstanceId = instanceIds;

    vec4 modelViewPosition = vec4(position, 1.0);
    modelViewPosition = instanceMatrix * modelViewPosition;
    modelViewPosition = modelViewMatrix * modelViewPosition;
    
    gl_Position = projectionMatrix * modelViewPosition;
    #include <logdepthbuf_vertex>
  }

  `,

  Frag: /*glsl*/`

  uniform vec3 diffuse;
  uniform bool objectPick;
  uniform float opacity;

  flat varying uint vInstanceId;

  #include <common>
  #include <logdepthbuf_pars_fragment>

  /**
   * - 1 means wall
   * - vInstanceId in 0..65535: (msByte, lsByte)
   */
  vec4 encodeWallObjectPick() {
    return vec4(
      1.0,
      float((int(vInstanceId) >> 8) & 255),
      float(int(vInstanceId) & 255),
      255.0
    ) / 255.0;
  }

  void main() {

    if (objectPick == true) {
      gl_FragColor = encodeWallObjectPick();
      #include <logdepthbuf_fragment>
      return;
    }
    
    gl_FragColor = vec4(diffuse, opacity);
    #include <logdepthbuf_fragment>
  }
  `,
};

/**
 * Use with centered XY quad.
 */
const instancedLabelsShader = {
  Vert: /*glsl*/`

  attribute vec2 uvDimensions;
  attribute vec2 uvOffsets;
  varying vec3 vColor;
  varying vec2 vUv;

  #include <common>
  #include <logdepthbuf_pars_vertex>

  void main() {
    // vUv = uv;
    vUv = (uv * uvDimensions) + uvOffsets;

    // Quad faces the camera
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mvPosition.xy += position.xy * vec2(instanceMatrix[0][0], instanceMatrix[1][1]);
    gl_Position = projectionMatrix * mvPosition;

    vColor = vec3(1.0);
    #ifdef USE_INSTANCING_COLOR
      vColor.xyz *= instanceColor.xyz;
    #endif

    #include <logdepthbuf_vertex>
  }

  `,

  Frag: /*glsl*/`

  varying vec3 vColor;
  varying vec2 vUv;
  uniform sampler2D map;
  uniform vec3 diffuse;
  uniform float opacity;

  #include <common>
  #include <logdepthbuf_pars_fragment>

  void main() {
    gl_FragColor = texture2D(map, vUv) * vec4(vColor * diffuse, opacity);
    if (gl_FragColor.a < 0.1) {
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
  flat varying uint vInstanceId;

  attribute uint instanceIds;

  #include <common>
  #include <uv_pars_vertex>
  #include <logdepthbuf_pars_vertex>

  void main() {
    #include <uv_vertex>
    vInstanceId = instanceIds;

    vec3 objectNormal = vec3(normal);
    vec3 transformed = vec3(position);
    vec4 mvPosition = vec4(transformed, 1.0);

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

  uniform vec3 diffuse;
  uniform bool objectPick;
  uniform int objectPickRed;
  uniform float opacity;

  flat varying uint vInstanceId;
	flat varying float dotProduct;
  varying vec3 vColor;


  #include <common>
  #include <uv_pars_fragment>
  #include <map_pars_fragment>
  #include <logdepthbuf_pars_fragment>

  void main() {
    vec4 diffuseColor = vec4(diffuse, 1);
    #include <logdepthbuf_fragment>
    #include <map_fragment>

    // gl_FragColor = vec4(vColor * diffuse * (0.1 + 0.7 * dotProduct), 1);
    gl_FragColor = vec4(vColor * vec3(diffuseColor) * (0.1 + 0.7 * dotProduct), diffuseColor.a * opacity);

    if (objectPick == true) {
      gl_FragColor = vec4(
        float(objectPickRed) / 255.0,
        float((int(vInstanceId) >> 8) & 255) / 255.0,
        float(int(vInstanceId) & 255) / 255.0,
        gl_FragColor.a
      );
    }
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

  uniform vec2 uFaceUv[4];
  uniform vec2 uIconUv[4];
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

  uniform int uNpcUid;
  uniform vec3 diffuse;
  uniform bool objectPick;
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

  /**
   * - 8 means npc
   * - uNpcUid in 0..65535 (msByte, lsByte),
   *   although probably in 0..255
   */
  vec4 encodeNpcObjectPick() {
    return vec4(
      8.0,
      // 255.0,
      float((uNpcUid >> 8) & 255),
      float(uNpcUid & 255),
      255.0
    ) / 255.0;
  }

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

    if (objectPick == true) {
      if (vId < 60) gl_FragColor = encodeNpcObjectPick();
      return;
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

export const instancedMultiTextureShader = {
  Vert: /* glsl */`

    attribute vec2 uvDimensions;
    attribute vec2 uvOffsets;
    attribute uint uvTextureIds;
    // e.g. can be used to infer gmId
    attribute uint instanceIds;
  
    varying vec3 vColor;
    varying vec2 vUv;
    flat varying uint vTextureId;
    flat varying uint vInstanceId;

    #include <common>
    #include <logdepthbuf_pars_vertex>

    void main() {
      // vUv = uv;
      vUv = (uv * uvDimensions) + uvOffsets;
      vTextureId = uvTextureIds;
      vInstanceId = instanceIds;

      vec4 modelViewPosition = vec4(position, 1.0);
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

  Frag: /* glsl */`

    uniform float alphaTest;
    uniform bool objectPick;
    uniform bool colorSpace;
    uniform int objectPickRed;
    uniform sampler2DArray atlas;
    uniform vec3 diffuse;
    uniform float opacity;

    varying vec3 vColor;
    varying vec2 vUv;
    flat varying uint vTextureId;
    flat varying uint vInstanceId;

    #include <common>
    #include <logdepthbuf_pars_fragment>
  
    void main() {
      gl_FragColor = texture(atlas, vec3(vUv, vTextureId)) * vec4(vColor * diffuse, opacity);

      if (gl_FragColor.a < alphaTest) {
        discard; // stop transparent pixels taking precedence
      }

      if (objectPick == true) {
        gl_FragColor = vec4(
          float(objectPickRed) / 255.0,
          float((int(vInstanceId) >> 8) & 255) / 255.0,
          float(int(vInstanceId) & 255) / 255.0,
          1
        );
      }
      
      if (colorSpace == true) {
        #include <colorspace_fragment>
      }

      #include <logdepthbuf_fragment>
    }
  
  `,
};

export const InstancedMonochromeShader = shaderMaterial(
  {
    diffuse: new THREE.Vector3(1, 0.5, 0.5),
    objectPick: false,
    opacity: 1,
  },
  instancedMonochromeShader.Vert,
  instancedMonochromeShader.Frag,
);

export const InstancedLabelsMaterial = shaderMaterial(
  {
    map: null,
    diffuse: new THREE.Vector3(1, 0.9, 0.6),
    opacity: 0.6,
    alphaTest: 0.5,
  },
  instancedLabelsShader.Vert,
  instancedLabelsShader.Frag,
);

export const InstancedMultiTextureMaterial = shaderMaterial(
  {
    alphaTest: 0.5,
    atlas: emptyDataArrayTexture,
    diffuse: new THREE.Vector3(1, 0.9, 0.6),
    // 🔔 map, mapTransform required else can get weird texture
    map: null,
    mapTransform: new THREE.Matrix3(),
    colorSpace: false,
    objectPick: false,
    objectPickRed: 0,
    opacity: 1,
  },
  instancedMultiTextureShader.Vert,
  instancedMultiTextureShader.Frag,
);

export const CameraLightMaterial = shaderMaterial(
  {
    diffuse: new THREE.Vector3(1, 0.9, 0.6),
    // 🔔 map, mapTransform required else can get weird texture
    map: null,
    mapTransform: new THREE.Matrix3(),
    objectPick: false,
    objectPickRed: 0,
    opacity: 1,
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
    objectPick: false,
    uNpcUid: 0,

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
  // InstancedUvMappingMaterial,
  InstancedLabelsMaterial,
  InstancedMultiTextureMaterial,
  CameraLightMaterial,
  CuboidManMaterial,
});
