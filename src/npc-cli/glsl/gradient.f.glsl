varying vec2 vUv;
uniform vec3 diffuse;
uniform float opacity;

#include <common>
// #include <uv_pars_fragment>
#include <logdepthbuf_pars_fragment>

vec3 colorA = vec3(0, 0, 0);
vec3 colorB = vec3(0.4, 0.4, 0.4);

void main() {

	vec4 diffuseColor = vec4(diffuse, opacity);
	// #include <clipping_planes_fragment>

	#include <logdepthbuf_fragment>

	vec3 outgoingLight = diffuseColor.rgb;

	#include <opaque_fragment>

	// 🚧
	vec3 color = mix(colorA, colorB, vUv.y);
	gl_FragColor = vec4(color, 1.0);

}