import * as THREE from "three";
import { extend } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";


export const minimalInstanceUvsVert = /*glsl*/`

  varying vec2 vUv;

  attribute vec2 uvDimensions;
  attribute vec2 uvOffsets;

  #include <common>
  #include <logdepthbuf_pars_vertex>

  void main() {
    // vUv = uv;
    vUv = (uv * uvDimensions) + uvOffsets;
    vec4 modelViewPosition = vec4(position, 1.0);

    #ifdef USE_INSTANCING
      modelViewPosition = instanceMatrix * modelViewPosition;
    #endif
    
    modelViewPosition = modelViewMatrix * modelViewPosition;
    gl_Position = projectionMatrix * modelViewPosition;

    #include <logdepthbuf_vertex>
  }

`;

export const minimalInstanceUvsFrag = /*glsl*/`

  varying vec2 vUv;
  uniform sampler2D map;
  uniform vec3 diffuse;

  #include <common>
  #include <logdepthbuf_pars_fragment>

  void main() {
    gl_FragColor = texture2D(map, vUv) * vec4(diffuse, 1);

    // 🔔 fix depth-buffer issue i.e. stop transparent pixels taking precedence
    if(gl_FragColor.a < 0.5) {
      discard;
    }

    #include <logdepthbuf_fragment>
  }

`;

export const meshBasic = {
  
  instanceUvsVert: /*glsl*/`

  // MeshBasicMaterial with InstancedMesh uv map support
  // Expects uniforms map (Texture), mapTransform (e.g. identity Matrix3)

  // One per instance
  attribute vec2 uvDimensions;
  // One per instance
  attribute vec2 uvOffsets;

  #include <common>
  #include <batching_pars_vertex>
  #include <uv_pars_vertex>
  #include <envmap_pars_vertex>
  #include <color_pars_vertex>
  #include <fog_pars_vertex>
  #include <morphtarget_pars_vertex>
  #include <skinning_pars_vertex>
  #include <logdepthbuf_pars_vertex>
  #include <clipping_planes_pars_vertex>

  void main() {

    #include <uv_vertex>
    #include <color_vertex>
    #include <morphinstance_vertex>
    #include <morphcolor_vertex>
    #include <batching_vertex>

    // Per instance uv mapping
    vMapUv = (uv * uvDimensions) + uvOffsets;

    #if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )

      #include <beginnormal_vertex>
      #include <morphnormal_vertex>
      #include <skinbase_vertex>
      #include <skinnormal_vertex>
      #include <defaultnormal_vertex>

    #endif

    #include <begin_vertex>
    #include <morphtarget_vertex>
    #include <skinning_vertex>
    #include <project_vertex>
    #include <logdepthbuf_vertex>
    #include <clipping_planes_vertex>

    #include <worldpos_vertex>
    #include <envmap_vertex>
    #include <fog_vertex>

  }
  `,

  simplifiedVert: /*glsl*/`
  #include <common>
  #include <logdepthbuf_pars_vertex>

  varying vec2 vUv;

  void main() {

    vUv = uv;

    #include <uv_vertex>
    #include <color_vertex>

    #include <begin_vertex>
    #include <project_vertex>
    #include <logdepthbuf_vertex>
    // #include <clipping_planes_vertex>
    // #include <worldpos_vertex>

  }
  `,

  Vert: /*glsl*/`

  #include <common>
  #include <batching_pars_vertex>
  #include <uv_pars_vertex>
  #include <envmap_pars_vertex>
  #include <color_pars_vertex>
  #include <fog_pars_vertex>
  #include <morphtarget_pars_vertex>
  #include <skinning_pars_vertex>
  #include <logdepthbuf_pars_vertex>
  #include <clipping_planes_pars_vertex>

  void main() {

    #include <uv_vertex>
    #include <color_vertex>
    #include <morphinstance_vertex>
    #include <morphcolor_vertex>
    #include <batching_vertex>

    #if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )

      #include <beginnormal_vertex>
      #include <morphnormal_vertex>
      #include <skinbase_vertex>
      #include <skinnormal_vertex>
      #include <defaultnormal_vertex>

    #endif

    #include <begin_vertex>
    #include <morphtarget_vertex>
    #include <skinning_vertex>
    #include <project_vertex>
    #include <logdepthbuf_vertex>
    #include <clipping_planes_vertex>

    #include <worldpos_vertex>
    #include <envmap_vertex>
    #include <fog_vertex>

  }
  `,

  Frag: /*glsl*/`
  
  uniform vec3 diffuse;
  uniform float opacity;
  
  #ifndef FLAT_SHADED
  
  varying vec3 vNormal;
  
  #endif
  
  #include <common>
  #include <dithering_pars_fragment>
  #include <color_pars_fragment>
  #include <uv_pars_fragment>
  #include <map_pars_fragment>
  #include <alphamap_pars_fragment>
  #include <alphatest_pars_fragment>
  #include <alphahash_pars_fragment>
  #include <aomap_pars_fragment>
  #include <lightmap_pars_fragment>
  #include <envmap_common_pars_fragment>
  #include <envmap_pars_fragment>
  #include <fog_pars_fragment>
  #include <specularmap_pars_fragment>
  #include <logdepthbuf_pars_fragment>
  #include <clipping_planes_pars_fragment>
  
  void main() {
  
    vec4 diffuseColor = vec4(diffuse, opacity);
    #include <clipping_planes_fragment>
  
    #include <logdepthbuf_fragment>
    #include <map_fragment>
    #include <color_fragment>
  
    #include <alphamap_fragment>
    #include <alphatest_fragment>
    #include <alphahash_fragment>
    #include <specularmap_fragment>
  
    ReflectedLight reflectedLight = ReflectedLight(vec3(0.0), vec3(0.0), vec3(0.0), vec3(0.0));
  
    // accumulation (baked indirect lighting only)
    #ifdef USE_LIGHTMAP
  
    vec4 lightMapTexel = texture2D(lightMap, vLightMapUv);
    reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
  
    #else
  
    reflectedLight.indirectDiffuse += vec3(1.0);
  
    #endif
  
    // modulation
    #include <aomap_fragment>
  
    reflectedLight.indirectDiffuse *= diffuseColor.rgb;
  
    vec3 outgoingLight = reflectedLight.indirectDiffuse;
  
    #include <envmap_fragment>
  
    #include <opaque_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
    #include <premultiplied_alpha_fragment>
    #include <dithering_fragment>
  
  }
  `,

};

export const basicGradientFrag = /*glsl*/`

  varying vec2 vUv;
  uniform vec3 diffuse;
  uniform float opacity;

  #include <common>
  #include <logdepthbuf_pars_fragment>

  vec3 colorA = vec3(0, 0, 0);
  vec3 colorB = vec3(0.4, 0.4, 0.4);

  void main() {

    vec4 diffuseColor = vec4(diffuse, opacity);

    #include <logdepthbuf_fragment>

    vec3 outgoingLight = diffuseColor.rgb;

    #include <opaque_fragment>

    vec3 color = mix(colorA, colorB, vUv.y);
    gl_FragColor = vec4(color, 1.0);
    // gl_FragColor = vec4(color, 0.5); // needs transparent on mesh

  }
`;

/**
 * Assume these are NOT defined:
 * - FLAT_SHADED
 * - DOUBLE_SIDED, FLIP_SIDED
 * - USE_TANGENT, USE_NORMALMAP_TANGENTSPACE, USE_CLEARCOAT_NORMALMAP
 * - USE_ANISOTROPY
 *
 * We're using this as a guide:
 * - https://github.com/mrdoob/three.js/blob/master/src/renderers/shaders/ShaderLib/meshphong.glsl.js
 * 
 */
export const meshDiffuseTest = {

  Vert: /*glsl*/`

  #include <common>
  
  //region #include <normal_pars_vertex>
	varying vec3 vNormal;
  //#endregion

  //#region #include <logdepthbuf_pars_vertex>
  #ifdef USE_LOGDEPTHBUF
    varying float vFragDepth;
    varying float vIsPerspective;
  #endif
  //#endregion

  void main() {

    //#region #include <beginnormal_vertex>
    vec3 objectNormal = vec3( normal );
    //#endregion

    //#region #include <begin_vertex>
    vec3 transformed = vec3( position );
    //#endregion

    //#region #include <project_vertex>
    vec4 mvPosition = vec4( transformed, 1.0 );

    #ifdef USE_INSTANCING
      mvPosition = instanceMatrix * mvPosition;
    #endif

    mvPosition = modelViewMatrix * mvPosition;
    gl_Position = projectionMatrix * mvPosition;
    //#endregion

    //#region #include <logdepthbuf_vertex>
    #ifdef USE_LOGDEPTHBUF
      vFragDepth = 1.0 + gl_Position.w;
      vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
    #endif
    //#endregion

    //#region #include <defaultnormal_vertex>
    vec3 transformedNormal = objectNormal;

    #ifdef USE_INSTANCING
      // this is in lieu of a per-instance normal-matrix
      // shear transforms in the instance matrix are not supported
      mat3 im = mat3( instanceMatrix );
      transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
      transformedNormal = im * transformedNormal;
    #endif

    transformedNormal = normalMatrix * transformedNormal;
    //#endregion
    
    //#region #include <normal_vertex>
    vNormal = normalize( transformedNormal );
    //#endregion
  }
  `,

  Frag: /*glsl*/`

  uniform vec3 diffuse;

  #include <common>

  //#region #include <normal_pars_vertex>
	varying vec3 vNormal;
  //#endregion

  // #include <lights_pars_begin>
  #include <logdepthbuf_pars_fragment>

  void main() {
    
    //#include <normal_fragment_begin>
    // vec3 normal = normalize( vNormal );
    vec3 normal = vNormal;

    // 🚧
    // gl_FragColor = vec4(diffuse, 1);
    gl_FragColor = vec4(diffuse * normal, 1);

    #include <logdepthbuf_fragment>
  }
  `,
};

export const InstancedSpriteSheetMaterial = shaderMaterial(
  {
    map: null,
    diffuse: new THREE.Vector3(1, 0.9, 0.6),
    opacity: 0.6,
    alphaTest: 0.5,
    // mapTransform: new THREE.Matrix3(),
  },
  minimalInstanceUvsVert,
  minimalInstanceUvsFrag,
);

export const MeshDiffuseTestMaterial = shaderMaterial(
  {
    diffuse: new THREE.Vector3(1, 0.9, 0.6),
  },
  meshDiffuseTest.Vert,
  meshDiffuseTest.Frag,
);

// See glsl.d.ts
extend({
  InstancedSpriteSheetMaterial,
  MeshDiffuseTestMaterial,
});
