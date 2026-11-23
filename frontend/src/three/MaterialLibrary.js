import * as THREE from "three";

/* ------------------------------------------------------------------ *
 * Tileable procedural PBR map generation (diffuse + normal + roughness)
 * Each tile represents an exact physical size so UVs can be authored in
 * metres and textures never stretch:  wood = 0.8 m,  roof = 1.0 m.
 * Drop real maps into /static/textures/ and call loadExternalWoodMaps().
 * ------------------------------------------------------------------ */

export const WOOD_TILE_M = 0.8;
export const ROOF_TILE_M = 1.0;

function hash(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function vnoise(x, y, px, py, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const w = (v, p) => ((v % p) + p) % p;
  const a = hash(w(x0, px), w(y0, py), seed);
  const b = hash(w(x0 + 1, px), w(y0, py), seed);
  const c = hash(w(x0, px), w(y0 + 1, py), seed);
  const d = hash(w(x0 + 1, px), w(y0 + 1, py), seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(u, v, cx, cy, octaves, seed) {
  let amp = 0.5;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const f = 1 << o;
    sum += amp * vnoise(u * cx * f, v * cy * f, cx * f, cy * f, seed + o * 17);
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}

function toTexture(data, size, srgb, aniso) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas.getContext("2d").putImageData(new ImageData(data, size, size), 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = aniso;
  tex.needsUpdate = true;
  return tex;
}

/** Wrapped Sobel height -> tangent-space normal map. */
function packMaps(height, luma, rough, size, strength, aniso) {
  const diffuse = new Uint8ClampedArray(size * size * 4);
  const normal = new Uint8ClampedArray(size * size * 4);
  const rmap = new Uint8ClampedArray(size * size * 4);
  const at = (x, y) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const dx = (at(x - 1, y) - at(x + 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const inv = 1 / Math.hypot(dx, dy, 1);
      const o = i * 4;
      normal[o] = (dx * inv * 0.5 + 0.5) * 255;
      normal[o + 1] = (dy * inv * 0.5 + 0.5) * 255;
      normal[o + 2] = (inv * 0.5 + 0.5) * 255;
      normal[o + 3] = 255;
      const l = Math.max(0, Math.min(1, luma[i])) * 255;
      diffuse[o] = diffuse[o + 1] = diffuse[o + 2] = l;
      diffuse[o + 3] = 255;
      const r = Math.max(0, Math.min(1, rough[i])) * 255;
      rmap[o] = 0;
      rmap[o + 1] = r; // roughnessMap reads the G channel
      rmap[o + 2] = 0;
      rmap[o + 3] = 255;
    }
  }
  return {
    map: toTexture(diffuse, size, true, aniso),
    normalMap: toTexture(normal, size, false, aniso),
    roughnessMap: toTexture(rmap, size, false, aniso),
  };
}

/** Wood grain runs along the texture U axis (geometry UV helper rotates it per face). */
function buildWoodMaps(size, aniso) {
  const h = new Float32Array(size * size);
  const l = new Float32Array(size * size);
  const r = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const warp = fbm(u, v, 2, 3, 3, 11);
      const ring = Math.sin((v * 14 + warp * 3.2) * Math.PI * 2) * 0.5 + 0.5;
      const fine = fbm(u, v, 3, 110, 3, 23);
      const pores = fbm(u, v, 28, 150, 2, 5);
      const hv = ring * 0.42 + fine * 0.42 + pores * 0.16;
      const i = y * size + x;
      h[i] = hv;
      l[i] = 0.82 + (hv - 0.5) * 0.55;
      r[i] = 0.78 + (1 - hv) * 0.22;
    }
  }
  return packMaps(h, l, r, size, 2.4, aniso);
}

/** 8 courses per metre, 3 tabs per metre, half-tab stagger, tab slots. */
function buildShingleMaps(size, aniso) {
  const rows = 8;
  const cols = 3;
  const h = new Float32Array(size * size);
  const l = new Float32Array(size * size);
  const r = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const row = Math.floor(v * rows);
      const t = v * rows - row;
      const cu = u * cols + (row % 2) * 0.5;
      const col = Math.floor(cu);
      const f = cu - col;
      const wrapCol = ((col % cols) + cols) % cols;
      let hv = 0.25 + t * 0.55;
      if (t < 0.62 && (f < 0.018 || f > 0.982)) hv = 0.0;
      const tabShade = 0.84 + hash(wrapCol, row, 3) * 0.16;
      const grain = fbm(u, v, 60, 60, 2, 9);
      const i = y * size + x;
      h[i] = hv + grain * 0.12;
      l[i] = (tabShade * (0.72 + grain * 0.35)) * (hv === 0 ? 0.35 : 0.55 + t * 0.5);
      r[i] = 0.88 + grain * 0.1;
    }
  }
  return packMaps(h, l, r, size, 3.2, aniso);
}

function buildEpdmMaps(size, aniso) {
  const h = new Float32Array(size * size);
  const l = new Float32Array(size * size);
  const r = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const n = fbm(u, v, 48, 48, 3, 31);
      const i = y * size + x;
      h[i] = n;
      l[i] = 0.75 + n * 0.25;
      r[i] = 0.7 + n * 0.2;
    }
  }
  return packMaps(h, l, r, size, 0.8, aniso);
}

const DEFAULT_WOOD = {
  "natural-pine": { color: "#D7B286", roughness: 0.78, metalness: 0.0 },
  teak: { color: "#9C5B34", roughness: 0.65, metalness: 0.0 },
  oak: { color: "#B57B45", roughness: 0.68, metalness: 0.0 },
  anthracite: { color: "#3A3F46", roughness: 0.58, metalness: 0.0 },
  "white-wash": { color: "#EAE6DF", roughness: 0.62, metalness: 0.0 },
};

const DEFAULT_ROOF = {
  "shingle-black": { color: "#4B4E55", roughness: 0.9, metalness: 0.0, kind: "shingle" },
  "shingle-red": { color: "#9A4B3D", roughness: 0.9, metalness: 0.0, kind: "shingle" },
  "shingle-green": { color: "#476856", roughness: 0.9, metalness: 0.0, kind: "shingle" },
  "epdm-membrane": { color: "#3D4045", roughness: 0.8, metalness: 0.0, kind: "epdm" },
};

export class MaterialLibrary {
  constructor({ maxAnisotropy = 8 } = {}) {
    this.woodFinishes = { ...DEFAULT_WOOD };
    this.roofFinishes = { ...DEFAULT_ROOF };

    const aniso = Math.min(8, maxAnisotropy);
    this.woodMaps = buildWoodMaps(512, aniso);
    this.shingleMaps = buildShingleMaps(512, aniso);
    this.epdmMaps = buildEpdmMaps(256, aniso);

    this.wood = new THREE.MeshStandardMaterial({
      ...this.woodMaps,
      normalScale: new THREE.Vector2(0.7, 0.7),
      color: new THREE.Color(DEFAULT_WOOD.teak.color),
      roughness: 1,
    });
    this.deck = new THREE.MeshStandardMaterial({
      ...this.woodMaps,
      normalScale: new THREE.Vector2(0.9, 0.9),
      color: new THREE.Color("#8B6A4C"),
      roughness: 1,
    });
    this.darkWood = new THREE.MeshStandardMaterial({ color: "#1b130d", roughness: 1 });
    this.roof = new THREE.MeshStandardMaterial({
      ...this.shingleMaps,
      normalScale: new THREE.Vector2(1.0, 1.0),
      color: new THREE.Color(DEFAULT_ROOF["shingle-black"].color),
      roughness: 1,
    });
    this.aluminum = new THREE.MeshStandardMaterial({ color: "#2A2D31", roughness: 0.35, metalness: 0.9 });
    this.glass = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      roughness: 0.04,
      metalness: 0,
      transmission: 1,
      thickness: 0.012,
      ior: 1.5,
      attenuationColor: new THREE.Color("#cfe8e4"),
      attenuationDistance: 0.6,
      specularIntensity: 1,
      envMapIntensity: 1.2,
      side: THREE.DoubleSide,
    });

    this.setWoodFinish("teak");
    this.setRoofFinish("shingle-black");
  }

  /** Merge DB-driven finishes (hex/roughness/metalness) over the defaults. */
  registerCatalog({ wood = [], roof = [] } = {}) {
    wood.forEach((w) => {
      this.woodFinishes[w.code] = { color: w.hex_color, roughness: w.roughness, metalness: 0 };
    });
    roof.forEach((r) => {
      const base = DEFAULT_ROOF[r.code];
      this.roofFinishes[r.code] = {
        color: r.hex_color,
        roughness: r.roughness,
        metalness: 0,
        kind: base?.kind || (r.code.includes("epdm") ? "epdm" : "shingle"),
      };
    });
  }

  _woodPreset(code) {
    return this.woodFinishes[code] || this.woodFinishes["natural-pine"];
  }

  setWoodFinish(code) {
    const p = this._woodPreset(code);
    this.wood.color.set(p.color);
    this.wood.roughness = p.roughness;
    this.wood.metalness = p.metalness;
  }

  /** Smooth stain transition used by the scroll story (Pine -> Teak -> Anthracite). */
  blendWoodFinish(codeA, codeB, t) {
    const a = this._woodPreset(codeA);
    const b = this._woodPreset(codeB);
    this.wood.color.set(a.color).lerp(new THREE.Color(b.color), t);
    this.wood.roughness = a.roughness + (b.roughness - a.roughness) * t;
  }

  setRoofFinish(code) {
    const p = this.roofFinishes[code] || this.roofFinishes["shingle-black"];
    const maps = p.kind === "epdm" ? this.epdmMaps : this.shingleMaps;
    this.roof.map = maps.map;
    this.roof.normalMap = maps.normalMap;
    this.roof.roughnessMap = maps.roughnessMap;
    this.roof.color.set(p.color);
    this.roof.roughness = p.roughness;
    this.roof.needsUpdate = true;
  }

  dispose() {
    [this.woodMaps, this.shingleMaps, this.epdmMaps].forEach((m) =>
      Object.values(m).forEach((t) => t.dispose())
    );
    [this.wood, this.deck, this.darkWood, this.roof, this.aluminum, this.glass].forEach((m) => m.dispose());
  }
}
