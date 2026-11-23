import * as THREE from "three";
import gsap from "gsap";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { ContactShadows } from "./ContactShadows.js";

/**
 * Owns renderer, scene, camera, lighting, PMREM environment, ground and
 * contact shadows. It never runs its own requestAnimationFrame loop:
 * `start()` registers a callback on gsap.ticker, which Lenis and
 * ScrollTrigger share, so everything renders in ONE rAF loop.
 */
export class SceneManager {
  constructor(canvas, opts = {}) {
    const {
      background = "#141210",
      fogDensity = 0.028,
      exposure = 1.0,
      envIntensity = 0.6,
      hdriUrl = null,
      shadowExtent = 6,
    } = opts;

    this.canvas = canvas;
    this.parent = canvas.parentElement;
    this.onBeforeRender = null;
    this._pageVisible = !document.hidden;
    this._inView = true;
    this._tick = this._tick.bind(this);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = exposure;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(background);
    this.scene.fog = new THREE.FogExp2(background, fogDensity);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
    this.camera.position.set(6, 3.4, 6.5);

    this._buildEnvironment(envIntensity, hdriUrl);
    this._buildLights(shadowExtent);
    this._buildGround();

    this.contactShadows = new ContactShadows();
    this.scene.add(this.contactShadows.group);

    this._observe();
    this.resize();
  }

  _buildEnvironment(intensity, hdriUrl) {
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.envTexture = this.pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    this.scene.environment = this.envTexture;
    this.scene.environmentIntensity = intensity;

    // Optional photographic HDRI: /static/hdri/<file>.hdr (falls back to RoomEnvironment)
    if (hdriUrl) {
      new HDRLoader().loadAsync(hdriUrl).then(
        (hdr) => {
          hdr.mapping = THREE.EquirectangularReflectionMapping;
          const env = this.pmrem.fromEquirectangular(hdr).texture;
          hdr.dispose();
          this.scene.environment = env;
        },
        () => {}
      );
    }
  }

  _buildLights(extent) {
    // Golden-hour key sun: PCF shadows, tight frustum, no flat ambient.
    this.sun = new THREE.DirectionalLight(0xffd8a8, 3.4);
    this.sun.position.set(6.5, 8.5, 5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const c = this.sun.shadow.camera;
    c.left = -extent;
    c.right = extent;
    c.top = extent;
    c.bottom = -extent;
    c.near = 1;
    c.far = 28;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun);

    this.rim = new THREE.DirectionalLight(0x9fbddc, 0.9);
    this.rim.position.set(-6, 4, -5);
    this.scene.add(this.rim);
  }

  _buildGround() {
    this.ground = new THREE.Mesh(
      new THREE.CircleGeometry(24, 72).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: "#2a2520", roughness: 0.96, metalness: 0 })
    );
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    this.grid = new THREE.GridHelper(20, 40, 0x4a4137, 0x2f2a24);
    this.grid.position.y = 0.004;
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.35;
    this.scene.add(this.grid);
  }

  _observe() {
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(this.parent);

    this._io = new IntersectionObserver(
      (entries) => {
        this._inView = entries[0].isIntersecting;
      },
      { threshold: 0 }
    );
    this._io.observe(this.canvas);

    this._onVis = () => {
      this._pageVisible = !document.hidden;
    };
    document.addEventListener("visibilitychange", this._onVis);
  }

  resize() {
    const w = this.parent.clientWidth;
    const h = this.parent.clientHeight;
    if (!w || !h) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  get active() {
    return this._inView && this._pageVisible;
  }

  /** Re-bake the contact shadow after the structure changes. */
  refreshContactShadow() {
    this.contactShadows.render(this.renderer, this.scene, [this.ground, this.grid]);
  }

  renderOnce() {
    this.onBeforeRender?.();
    this.renderer.render(this.scene, this.camera);
  }

  _tick() {
    if (!this.active) return;
    this.renderOnce();
  }

  start() {
    gsap.ticker.add(this._tick);
  }

  stop() {
    gsap.ticker.remove(this._tick);
  }

  dispose() {
    this.stop();
    this._ro.disconnect();
    this._io.disconnect();
    document.removeEventListener("visibilitychange", this._onVis);
    this.contactShadows.dispose();
    this.envTexture.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
  }
}
