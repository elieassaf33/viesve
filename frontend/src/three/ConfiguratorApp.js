import * as THREE from "three";
import gsap from "gsap";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { SceneManager } from "./SceneManager.js";
import { MaterialLibrary } from "./MaterialLibrary.js";
import { GazeboAssembly } from "./GazeboAssembly.js";
import { ModelLibrary } from "./ModelLibrary.js";

const csrf = () => (document.cookie.match(/csrftoken=([^;]+)/) || [])[1] || "";
const clone = (o) => JSON.parse(JSON.stringify(o));

/** Replace InstancedMesh with plain meshes so any AR viewer can read the .glb. */
function flattenForExport(source) {
  const copy = source.clone(true);
  const instanced = [];
  copy.traverse((o) => o.isInstancedMesh && instanced.push(o));
  instanced.forEach((im) => {
    const g = new THREE.Group();
    g.position.copy(im.position);
    g.quaternion.copy(im.quaternion);
    g.scale.copy(im.scale);
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    for (let i = 0; i < im.count; i++) {
      im.getMatrixAt(i, m);
      const mat = im.material.clone();
      if (im.instanceColor) {
        im.getColorAt(i, c);
        mat.color.multiply(c);
      }
      const mesh = new THREE.Mesh(im.geometry, mat);
      mesh.applyMatrix4(m);
      g.add(mesh);
    }
    im.parent.add(g);
    im.parent.remove(im);
  });
  return copy;
}

function exportGlbUrl(root) {
  return new Promise((resolve, reject) => {
    new GLTFExporter().parse(
      flattenForExport(root),
      (buf) => resolve(URL.createObjectURL(new Blob([buf], { type: "model/gltf-binary" }))),
      reject,
      { binary: true, onlyVisible: true }
    );
  });
}

function createEngine(canvas, bootstrap) {
  const staticUrl = document.body.dataset.static || "/static/";
  const manager = new SceneManager(canvas, { background: "#141210", fogDensity: 0.026 });
  const materials = new MaterialLibrary({ maxAnisotropy: manager.renderer.capabilities.getMaxAnisotropy() });
  materials.registerCatalog({ wood: bootstrap.woodFinishes, roof: bootstrap.roofFinishes });

  const assembly = new GazeboAssembly(materials);
  assembly.onBuilt = () => manager.refreshContactShadow();
  manager.scene.add(assembly.root);
  assembly.build(bootstrap.initialConfig);

  const library = new ModelLibrary({ staticUrl });
  library.load().then((ok) => {
    if (!ok) return;
    assembly.setModels(library);
    assembly.build(assembly.config);
  });

  /* ---- orbit controls, constrained above ground ---- */
  const camera = manager.camera;
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.maxPolarAngle = Math.PI / 2 - 0.03;
  controls.minDistance = 1.2;
  controls.maxDistance = 16;
  controls.target.set(0, 1.2, 0);
  controls.update();
  manager.onBeforeRender = () => controls.update();
  manager.start();

  const goTo = (name, cfg) => {
    const W = (cfg.width || 400) / 100;
    const D = (cfg.depth || 400) / 100;
    const s = Math.max(W, D);
    const presets = {
      overview: { pos: [s * 1.2, s * 0.8, s * 1.3], target: [0, 1.2, 0] },
      front: { pos: [0, 1.6, s * 1.6], target: [0, 1.25, 0] },
      interior: { pos: [0.3, 1.5, D / 2 - 0.5], target: [-0.4, 1.3, -D / 2] },
      top: { pos: [0.01, s * 2.2, 0.01], target: [0, 0, 0] },
    };
    const p = presets[name] || presets.overview;
    gsap.to(camera.position, { x: p.pos[0], y: p.pos[1], z: p.pos[2], duration: 1, ease: "power3.inOut" });
    gsap.to(controls.target, { x: p.target[0], y: p.target[1], z: p.target[2], duration: 1, ease: "power3.inOut" });
  };
  goTo("overview", bootstrap.initialConfig);

  /* ---- clickable 3D bays ---- */
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  let down = { x: 0, y: 0 };
  canvas.addEventListener("pointerdown", (e) => (down = { x: e.clientX, y: e.clientY }));
  canvas.addEventListener("pointerup", (e) => {
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return; // was an orbit drag
    const r = canvas.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(assembly.bayHitboxes, false)[0];
    if (hit) {
      window.dispatchEvent(new CustomEvent("viesve:select-bay", { detail: { side: hit.object.userData.baySide } }));
    }
  });

  return {
    rebuild: (cfg) => assembly.build(cfg),
    setGlassOpen: (v) => assembly.setGlassSlideOpen(v),
    highlightBay: (s) => assembly.highlightBay(s),
    goTo,
    snapshot() {
      manager.renderOnce();
      return canvas.toDataURL("image/png"); // read in the same task as the render
    },
    exportGlb: () => exportGlbUrl(assembly.root),
  };
}

/** Registers the Alpine component + boots the 3D engine. Call before Alpine.start(). */
export function initConfigurator() {
  const canvas = document.getElementById("configurator-canvas");
  const bootEl = document.getElementById("configurator-bootstrap");
  if (!canvas || !bootEl) return;
  const bootstrap = JSON.parse(bootEl.textContent);
  const engine = createEngine(canvas, bootstrap);

  window.viesveConfiguratorApp = () => ({
    step: 1,
    activeBay: "front",
    glassOpen: 0,
    config: bootstrap.initialConfig,
    bom: bootstrap.initialBom,
    totalPrice: bootstrap.initialPrice,
    woodFinishes: bootstrap.woodFinishes,
    roofFinishes: bootstrap.roofFinishes,
    presets: bootstrap.presets,
    shareUuid: bootstrap.shareUuid,
    shareUrl: bootstrap.shareUuid ? `/konfiguratorius/c/${bootstrap.shareUuid}/` : null,
    pdfUrl: bootstrap.shareUuid ? `/konfiguratorius/c/${bootstrap.shareUuid}/pdf/` : null,
    saving: false,
    arModalOpen: false,
    arGlbUrl: null,
    quoteForm: { customer_name: "", customer_email: "", customer_phone: "", customer_notes: "" },
    quoteSubmitted: false,
    quoteError: "",

    init() {
      window.addEventListener("viesve:select-bay", (e) => {
        this.activeBay = e.detail.side;
        this.step = 3;
      });
      const sync = () => engine.highlightBay(this.step === 3 ? this.activeBay : null);
      this.$watch("activeBay", sync);
      this.$watch("step", sync);
    },

    async onConfigChange() {
      engine.rebuild(clone(this.config));
      engine.setGlassOpen(this.glassOpen);
      await this.recalculate();
    },
    onGlassSlideChange() {
      engine.setGlassOpen(this.glassOpen);
    },
    setCamera(name) {
      engine.goTo(name, this.config);
    },
    applyPreset(p) {
      if (!p?.default_config_json) return;
      this.config = clone(p.default_config_json);
      this.onConfigChange();
      this.setCamera("overview");
    },

    async recalculate() {
      const res = await fetch("/api/configurator/calculate/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrf() },
        body: JSON.stringify(this.config),
      });
      if (res.ok) {
        const data = await res.json();
        this.bom = data.bom;
        this.totalPrice = data.total_price;
      }
    },

    async _post(url, extra = {}) {
      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrf() },
        body: JSON.stringify({
          config: clone(this.config),
          snapshot_data_url: engine.snapshot(),
          structure_slug: bootstrap.presetSlug || "",
          ...extra,
        }),
      });
    },

    async saveConfiguration() {
      this.saving = true;
      try {
        const res = await this._post("/api/configurator/save/");
        if (res.ok) {
          const d = await res.json();
          Object.assign(this, { shareUuid: d.uuid, shareUrl: d.share_url, pdfUrl: d.pdf_url });
          window.history.replaceState({}, "", d.share_url);
        }
      } finally {
        this.saving = false;
      }
    },

    async submitQuote() {
      this.quoteError = "";
      if (!this.quoteForm.customer_name || !this.quoteForm.customer_email) {
        this.quoteError = "Prašome įvesti vardą ir el. paštą.";
        return;
      }
      this.saving = true;
      try {
        const res = await this._post("/api/configurator/quote/", clone(this.quoteForm));
        if (res.ok) {
          const d = await res.json();
          Object.assign(this, { shareUuid: d.uuid, shareUrl: d.share_url, pdfUrl: d.pdf_url, quoteSubmitted: true });
        } else {
          this.quoteError = "Nepavyko išsiųsti užklausos. Patikrinkite laukus.";
        }
      } finally {
        this.saving = false;
      }
    },

    async openArPreview() {
      if (this.arGlbUrl) URL.revokeObjectURL(this.arGlbUrl);
      this.arGlbUrl = await engine.exportGlb();
      this.arModalOpen = true;
    },
  });

  return engine;
}
