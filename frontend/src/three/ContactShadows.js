import * as THREE from "three";
import { HorizontalBlurShader } from "three/examples/jsm/shaders/HorizontalBlurShader.js";
import { VerticalBlurShader } from "three/examples/jsm/shaders/VerticalBlurShader.js";

/**
 * Baked, blurred top-down depth "contact shadow" under the structure
 * (technique from three.js webgl_shadow_contact). Rendered on demand
 * (after every rebuild), never per frame.
 */
export class ContactShadows {
  constructor({ size = 14, resolution = 1024, height = 3.4, blur = 3.2, darkness = 1.15, opacity = 0.85 } = {}) {
    this.size = size;
    this.blur = blur;
    this.group = new THREE.Group();
    this.group.position.y = 0.002;

    this.target = new THREE.WebGLRenderTarget(resolution, resolution);
    this.target.texture.generateMipmaps = false;
    this.targetBlur = new THREE.WebGLRenderTarget(resolution, resolution);
    this.targetBlur.texture.generateMipmaps = false;

    const geo = new THREE.PlaneGeometry(size, size).rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: this.target.texture,
      opacity,
      transparent: true,
      depthWrite: false,
    });
    this.plane = new THREE.Mesh(geo, mat);
    this.plane.renderOrder = 1;
    this.plane.scale.y = -1; // render-target texture is flipped
    this.group.add(this.plane);

    this.blurPlane = new THREE.Mesh(geo);
    this.blurPlane.visible = false;
    this.group.add(this.blurPlane);

    this.camera = new THREE.OrthographicCamera(-size / 2, size / 2, size / 2, -size / 2, 0, height);
    this.camera.rotation.x = Math.PI / 2; // look up
    this.group.add(this.camera);

    this.depthMaterial = new THREE.MeshDepthMaterial();
    this.depthMaterial.userData.darkness = { value: darkness };
    this.depthMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.darkness = this.depthMaterial.userData.darkness;
      shader.fragmentShader = `uniform float darkness;\n${shader.fragmentShader.replace(
        "gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );",
        "gl_FragColor = vec4( vec3( 0.0 ), ( 1.0 - fragCoordZ ) * darkness );"
      )}`;
    };
    this.depthMaterial.depthTest = false;
    this.depthMaterial.depthWrite = false;

    this.hBlur = new THREE.ShaderMaterial(HorizontalBlurShader);
    this.hBlur.depthTest = false;
    this.vBlur = new THREE.ShaderMaterial(VerticalBlurShader);
    this.vBlur.depthTest = false;
  }

  _blur(renderer, amount) {
    this.blurPlane.visible = true;
    this.blurPlane.material = this.hBlur;
    this.hBlur.uniforms.tDiffuse.value = this.target.texture;
    this.hBlur.uniforms.h.value = amount / 256;
    renderer.setRenderTarget(this.targetBlur);
    renderer.render(this.blurPlane, this.camera);

    this.blurPlane.material = this.vBlur;
    this.vBlur.uniforms.tDiffuse.value = this.targetBlur.texture;
    this.vBlur.uniforms.v.value = amount / 256;
    renderer.setRenderTarget(this.target);
    renderer.render(this.blurPlane, this.camera);
    this.blurPlane.visible = false;
  }

  /** `hidden`: objects excluded from the depth pass (ground, grid, helpers). */
  render(renderer, scene, hidden = []) {
    const prevBg = scene.background;
    const prevTarget = renderer.getRenderTarget();
    const prevAuto = renderer.autoClear;
    const toHide = [this.group, ...hidden];
    scene.traverse((o) => {
      if (o.userData?.noContactShadow) toHide.push(o);
    });
    const prevVis = toHide.map((o) => o.visible);
    toHide.forEach((o) => (o.visible = false));

    scene.background = null;
    scene.overrideMaterial = this.depthMaterial;
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(this.target);
    renderer.clear();
    renderer.render(scene, this.camera);
    scene.overrideMaterial = null;

    this._blur(renderer, this.blur);
    this._blur(renderer, this.blur * 0.4);

    renderer.setRenderTarget(prevTarget);
    renderer.autoClear = prevAuto;
    scene.background = prevBg;
    toHide.forEach((o, i) => (o.visible = prevVis[i]));
  }

  dispose() {
    this.target.dispose();
    this.targetBlur.dispose();
    this.plane.geometry.dispose();
    this.plane.material.dispose();
    this.depthMaterial.dispose();
    this.hBlur.dispose();
    this.vBlur.dispose();
  }
}
