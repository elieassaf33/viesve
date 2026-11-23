import * as THREE from "three";
import { WOOD_TILE_M, ROOF_TILE_M } from "./MaterialLibrary.js";

/**
 * Box whose UVs are in real-world metres / tile size, so a plank of any
 * length shows the same grain scale (no stretching).
 * grain = world axis the wood fibres run along ('x' | 'y' | 'z').
 * The wood texture's fibres run along U, so faces whose V axis equals
 * the grain axis get U/V swapped.
 */
export function worldBox(w, h, d, grain = "x", tile = WOOD_TILE_M) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z  -> [uSize, vSize, uAxis, vAxis]
  const faces = [
    [d, h, "z", "y"],
    [d, h, "z", "y"],
    [w, d, "x", "z"],
    [w, d, "x", "z"],
    [w, h, "x", "y"],
    [w, h, "x", "y"],
  ];
  faces.forEach(([us, vs, , va], f) => {
    const swap = grain === va;
    for (let i = 0; i < 4; i++) {
      const idx = f * 4 + i;
      const u = uv.getX(idx);
      const v = uv.getY(idx);
      if (swap) uv.setXY(idx, (v * vs) / tile, (u * us) / tile);
      else uv.setXY(idx, (u * us) / tile, (v * vs) / tile);
    }
  });
  uv.needsUpdate = true;
  return g;
}

/**
 * 4-sided pyramid roof (Lugarde VV5 style) centred on the origin, base at y=0.
 * Each slope is a triangle with UVs = real metres (u along the eave, v up the
 * slope) so shingle courses keep a constant physical size at any dimension.
 */
export function pyramidRoofGeometry(rw, rd, peak) {
  const hw = rw / 2;
  const hd = rd / 2;
  const slopes = [
    // [eaveA, eaveB, eaveLength, slopeLength]
    { a: [-hw, 0, hd], b: [hw, 0, hd], len: rw, slope: Math.hypot(hd, peak) },
    { a: [hw, 0, hd], b: [hw, 0, -hd], len: rd, slope: Math.hypot(hw, peak) },
    { a: [hw, 0, -hd], b: [-hw, 0, -hd], len: rw, slope: Math.hypot(hd, peak) },
    { a: [-hw, 0, -hd], b: [-hw, 0, hd], len: rd, slope: Math.hypot(hw, peak) },
  ];
  const pos = [];
  const uvs = [];
  slopes.forEach(({ a, b, len, slope }) => {
    pos.push(...a, ...b, 0, peak, 0);
    uvs.push(0, 0, len / ROOF_TILE_M, 0, len / 2 / ROOF_TILE_M, slope / ROOF_TILE_M);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}

/** Turned decorative finial profile. */
export function finialGeometry() {
  const pts = [
    [0.0, 0.0],
    [0.055, 0.0],
    [0.04, 0.03],
    [0.028, 0.06],
    [0.05, 0.1],
    [0.05, 0.14],
    [0.028, 0.18],
    [0.02, 0.24],
    [0.0, 0.32],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 24);
}
