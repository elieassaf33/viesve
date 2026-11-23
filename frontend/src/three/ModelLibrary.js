import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

/** Node-name contract for the modular Blender export (see static/models/README.md). */
export const NODE = {
  POST: "Post_Corner",
  ROOF_PYRAMID: "Roof_Pyramid",
  WALL_SOLID: "Wall_Solid",
  WALL_LOUVER: "Wall_Louver",
  DOOR: "Door_SlidingGlass",
  DECK: "Deck_Floor",
};

const stripSuffix = (name) => name.replace(/\.\d+$/, "");

/**
 * Loads one modular .glb (Draco compressed or not) and indexes sub-assemblies
 * by node name. Each part is normalised: centred on X/Z, base on Y=0, and its
 * bounding size recorded so the assembly can fit it parametrically.
 * If the file is missing, load() resolves false and the assembly falls back
 * to procedural geometry.
 */
export class ModelLibrary {
  constructor({ staticUrl = "/static/", file = "models/gazebo_modules.glb" } = {}) {
    this.staticUrl = staticUrl;
    this.url = staticUrl + file;
    this.parts = new Map();
    this.loaded = false;
  }

  async load() {
    try {
      const head = await fetch(this.url, { method: "HEAD" });
      const type = head.headers.get("content-type") || "";
      if (!head.ok || type.includes("text/html")) return false;
    } catch {
      return false;
    }

    const draco = new DRACOLoader().setDecoderPath(`${this.staticUrl}draco/`);
    const loader = new GLTFLoader().setDRACOLoader(draco);
    try {
      const gltf = await loader.loadAsync(this.url);
      const wanted = new Set(Object.values(NODE));
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((node) => {
        const key = stripSuffix(node.name);
        if (!wanted.has(key) || this.parts.has(key)) return;

        const holder = new THREE.Group();
        const inner = node.clone(true);
        inner.position.set(0, 0, 0);
        inner.rotation.set(0, 0, 0);
        holder.add(inner);
        holder.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(holder);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        inner.position.set(-center.x, -box.min.y, -center.z);
        this.parts.set(key, { holder, size });
      });
      this.loaded = this.parts.size > 0;
      return this.loaded;
    } catch (err) {
      console.warn("[viesve] .glb load failed, using procedural fallback:", err);
      return false;
    } finally {
      draco.dispose();
    }
  }

  has(name) {
    return this.parts.has(name);
  }

  /** @returns {{ object: THREE.Group, size: THREE.Vector3 } | null} */
  instance(name) {
    const part = this.parts.get(name);
    if (!part) return null;
    return { object: part.holder.clone(true), size: part.size.clone() };
  }
}
