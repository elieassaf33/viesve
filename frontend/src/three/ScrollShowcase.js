import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SceneManager } from "./SceneManager.js";
import { MaterialLibrary } from "./MaterialLibrary.js";
import { GazeboAssembly } from "./GazeboAssembly.js";
import { ModelLibrary } from "./ModelLibrary.js";

const HERO_CONFIG = {
  width: 400,
  depth: 400,
  wallHeight: 230,
  overhang: 30,
  roofType: "pyramid",
  roofFinish: "shingle-black",
  woodFinish: "natural-pine",
  includeGutterFinial: true,
  includeDecking: true,
  walls: { front: "glass", back: "solid", left: "louver", right: "glass" },
};

/**
 * Homepage pinned scroll-scrubbing story (#hero-3d-stage).
 * Rendering runs on gsap.ticker (shared with Lenis + ScrollTrigger),
 * paused automatically by SceneManager when off-screen / tab hidden.
 */
export function initScrollShowcase({ reducedMotion = false } = {}) {
  const stage = document.getElementById("hero-3d-stage");
  const canvas = document.getElementById("hero-3d-canvas");
  if (!stage || !canvas) return null;

  const staticUrl = document.body.dataset.static || "/static/";
  const manager = new SceneManager(canvas, {
    background: "#0e0d0b",
    fogDensity: 0.03,
    exposure: 1.0,
    hdriUrl: stage.dataset.hdri ? staticUrl + stage.dataset.hdri : null,
  });
  const materials = new MaterialLibrary({ maxAnisotropy: manager.renderer.capabilities.getMaxAnisotropy() });
  const assembly = new GazeboAssembly(materials);
  assembly.onBuilt = () => manager.refreshContactShadow();
  manager.scene.add(assembly.root);
  assembly.build(HERO_CONFIG);

  // Real modular .glb if present, procedural fallback otherwise.
  const library = new ModelLibrary({ staticUrl });
  library.load().then((ok) => {
    if (!ok) return;
    assembly.setModels(library);
    assembly.build(HERO_CONFIG);
    applyState();
  });

  /* ---- camera rig: orbit around the pavilion, blend into the interior ---- */
  const target = new THREE.Vector3(0, 1.2, 0);
  const interiorPos = new THREE.Vector3(0.3, 1.55, 2.35);
  const interiorTarget = new THREE.Vector3(-0.3, 1.3, -0.6);
  const state = {
    az: 0.8,
    radius: 9.2,
    height: 3.4,
    inside: 0,
    explode: 0,
    glassOpen: 0,
    stain: 0, // 0 pine, 1 teak, 2 anthracite
  };
  const _orbit = new THREE.Vector3();
  const _look = new THREE.Vector3();

  function applyState() {
    _orbit.set(Math.sin(state.az) * state.radius, state.height, Math.cos(state.az) * state.radius).add(target);
    manager.camera.position.lerpVectors(_orbit, interiorPos, state.inside);
    _look.lerpVectors(target, interiorTarget, state.inside);
    manager.camera.lookAt(_look);

    assembly.setExplode(state.explode);
    assembly.setGlassSlideOpen(state.glassOpen);
    if (state.stain <= 1) materials.blendWoodFinish("natural-pine", "teak", state.stain);
    else materials.blendWoodFinish("teak", "anthracite", state.stain - 1);
  }
  applyState();

  if (reducedMotion) {
    // static hero render, no pinning / scrubbing
    state.az = 0.8;
    applyState();
    manager.renderOnce();
    manager.start(); // keeps resizes crisp; cheap since nothing animates
    return { manager, assembly };
  }

  manager.start();

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: stage,
      start: "top top",
      end: "+=350%",
      pin: true,
      scrub: 1,
      anticipatePin: 1,
    },
    onUpdate: applyState,
    defaults: { ease: "none" },
  });

  // 0 – 25%  Architectural reveal: golden-hour orbit + headline hand-off
  tl.to(state, { az: 2.4, radius: 8.2, height: 2.7, duration: 0.25 }, 0).to(
    ".hero-phase-1",
    { opacity: 0, y: -24, duration: 0.1 },
    0.15
  );

  // 25 – 55%  Exploded structural breakdown + callouts
  tl.to(state, { explode: 1, duration: 0.2, ease: "power2.inOut" }, 0.25)
    .to(state, { az: 4.0, radius: 10.6, height: 3.8, duration: 0.3 }, 0.25)
    .fromTo(".hero-phase-2", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.08 }, 0.28)
    .to(".hero-phase-2", { opacity: 0, y: -20, duration: 0.06 }, 0.49);

  // 55 – 80%  Reassemble, stain morph, doors slide open, camera glides inside
  tl.to(state, { explode: 0, duration: 0.12, ease: "power2.out" }, 0.55)
    .to(state, { stain: 2, glassOpen: 0.95, duration: 0.22 }, 0.57)
    .to(state, { az: 5.6, radius: 6.5, height: 2.0, duration: 0.12 }, 0.55)
    .to(state, { inside: 1, duration: 0.13, ease: "power1.inOut" }, 0.65)
    .fromTo(".hero-phase-3", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.08 }, 0.58)
    .to(".hero-phase-3", { opacity: 0, y: -20, duration: 0.06 }, 0.74);

  // 80 – 100%  Back to the hero angle, hand off to the configurator
  tl.to(state, { inside: 0, duration: 0.1, ease: "power2.inOut" }, 0.8)
    .to(state, { az: Math.PI * 2 + 0.8, radius: 9.2, height: 3.4, stain: 1, glassOpen: 0.3, duration: 0.2 }, 0.8)
    .fromTo(".hero-phase-4", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.1 }, 0.84);

  ScrollTrigger.refresh();
  return { manager, assembly, timeline: tl };
}
