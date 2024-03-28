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