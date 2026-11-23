import * as THREE from "three";
import { NODE } from "./ModelLibrary.js";
import { worldBox, pyramidRoofGeometry, finialGeometry } from "./geometry.js";
import { ROOF_TILE_M } from "./MaterialLibrary.js";

export const POST = 0.14; // fixed 140 x 140 mm cross-section
const FLOOR = 0.04; // deck thickness: everything vertical starts here
const BEAM_H = 0.16;

const SIDES = {
  front: { dir: [0, 1], rotY: 0, normal: [0, 1] },
  back: { dir: [0, -1], rotY: Math.PI, normal: [0, -1] },
  left: { dir: [-1, 0], rotY: -Math.PI / 2, normal: [-1, 0] },
  right: { dir: [1, 0], rotY: Math.PI / 2, normal: [1, 0] },
};

/**
 * Hybrid parametric assembly.
 *  - If a ModelLibrary provides a node (Post_Corner, Roof_Pyramid, Wall_Solid,
 *    Wall_Louver, Door_SlidingGlass, Deck_Floor) it is cloned and fitted:
 *    posts scale ONLY along Y (cross-section stays 140 mm), wall/door modules
 *    are tiled (never stretched across the span), roof/deck are fitted to size.
 *  - Otherwise detailed procedural geometry with world-scale UVs is built.
 */
export class GazeboAssembly {
  constructor(materials) {
    this.mats = materials;
    this.models = null;
    this.config = null;
    this.onBuilt = null;
    this.explode = 0;

    this.root = new THREE.Group();
    this.root.name = "GazeboAssembly";
    this.deckGroup = new THREE.Group();
    this.postsGroup = new THREE.Group();
    this.beamsGroup = new THREE.Group();
    this.wallsGroup = new THREE.Group();
    this.roofGroup = new THREE.Group();
    this.hitboxGroup = new THREE.Group();
    this.hitboxGroup.visible = false;
    this.highlightGroup = new THREE.Group();
    this.highlightGroup.userData.noContactShadow = true;
    this.root.add(
      this.deckGroup,
      this.postsGroup,
      this.beamsGroup,
      this.wallsGroup,
      this.roofGroup,
      this.hitboxGroup,
      this.highlightGroup
    );

    this.panels = [];
    this.bayHitboxes = [];
    this.highlights = {};
    this._explodables = [];

    this._underside = new THREE.MeshStandardMaterial({ color: "#5d4331", roughness: 1, side: THREE.BackSide });
    this._highlightMat = new THREE.MeshBasicMaterial({
      color: "#ffb35c",
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  setModels(library) {
    this.models = library;
  }

  /* ------------------------------ build ------------------------------ */

  build(config) {
    this.config = config;
    [
      this.deckGroup,
      this.postsGroup,
      this.beamsGroup,
      this.wallsGroup,
      this.roofGroup,
      this.hitboxGroup,
      this.highlightGroup,
    ].forEach((g) => this._clear(g));
    this.panels = [];
    this.bayHitboxes = [];
    this.highlights = {};

    const W = (config.width || 400) / 100;
    const D = (config.depth || 400) / 100;
    const H = (config.wallHeight || 230) / 100;
    const OH = (config.overhang || 30) / 100;

    this.mats.setWoodFinish(config.woodFinish || "teak");
    this.mats.setRoofFinish(config.roofFinish || "shingle-black");

    if (config.includeDecking !== false) this._buildDeck(W, D);
    this._buildFrame(W, D, H);
    this._buildWalls(W, D, H, config.walls || {});
    this._buildRoof(W, D, H, OH, config.roofType || "pyramid", config.includeGutterFinial !== false);
    this._buildBayHelpers(W, D, H);

    this._captureExplode();
    this.setExplode(this.explode);
    this.onBuilt?.(this);
    return this.root;
  }

  _clear(group) {
    group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.isInstancedMesh) o.dispose();
    });
    group.clear();
  }

  _mesh(geo, mat, { cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = receive;
    return m;
  }

  _glb(name, kind) {
    const inst = this.models?.instance(name);
    if (!inst) return null;
    const mats = this.mats;
    inst.object.traverse((m) => {
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      const isGlass = /glass/i.test(m.name) || /glass/i.test(m.material?.name || "");
      if (isGlass) {
        m.material = mats.glass;
        m.castShadow = false;
        m.userData.noContactShadow = true;
      } else {
        m.material = { wood: mats.wood, roof: mats.roof, deck: mats.deck, metal: mats.aluminum }[kind];
      }
    });
    return inst;
  }

  /* ------------------------------ deck ------------------------------- */

  _buildDeck(W, D) {
    const glb = this._glb(NODE.DECK, "deck");
    if (glb) {
      glb.object.scale.set(W / glb.size.x, FLOOR / glb.size.y, D / glb.size.z);
      this.deckGroup.add(glb.object);
      return;
    }
    const count = Math.max(4, Math.round(D / 0.145));
    const pd = D / count;
    const geo = worldBox(W + 0.04, FLOOR, pd - 0.006, "x");
    const inst = new THREE.InstancedMesh(geo, this.mats.deck, count);
    inst.castShadow = true;
    inst.receiveShadow = true;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      m.makeTranslation(0, FLOOR / 2, -D / 2 + pd * (i + 0.5));
      inst.setMatrixAt(i, m);
      inst.setColorAt(i, c.setScalar(0.86 + Math.random() * 0.14));
    }
    this.deckGroup.add(inst);
  }

  /* ----------------------- posts & ring beams ------------------------ */

  _buildFrame(W, D, H) {
    const hw = W / 2 - POST / 2;
    const hd = D / 2 - POST / 2;
    const pts = [
      [-hw, -hd],
      [hw, -hd],
      [-hw, hd],
      [hw, hd],
    ];
    if (W > 4.0) pts.push([0, -hd], [0, hd]); // auto mid posts
    if (D > 4.0) pts.push([-hw, 0], [hw, 0]);

    pts.forEach(([x, z], i) => this.postsGroup.add(this._postUnit(x, z, H, i)));

    const beamY = FLOOR + H - BEAM_H / 2;
    [-hd, hd].forEach((z) => {
      const b = this._mesh(worldBox(W, BEAM_H, POST, "x"), this.mats.wood);
      b.position.set(0, beamY, z);
      this.beamsGroup.add(b);
    });
    [-hw, hw].forEach((x) => {
      const b = this._mesh(worldBox(POST, BEAM_H, D - POST * 2, "z"), this.mats.wood);
      b.position.set(x, beamY, 0);
      this.beamsGroup.add(b);
    });
  }

  _postUnit(x, z, H, idx) {
    const unit = new THREE.Group();
    unit.name = `Post_${idx}`;
    unit.position.set(x, 0, z);
    const sx = Math.abs(x) < 1e-3 ? 0 : Math.sign(x);
    const sz = Math.abs(z) < 1e-3 ? 0 : Math.sign(z);
    unit.userData.outward = new THREE.Vector3(sx, 0, sz);

    const glb = this._glb(NODE.POST, "wood");
    if (glb) {
      // scale ONLY Y with wall height; cross-section pinned to 140 mm
      glb.object.scale.set(POST / glb.size.x, H / glb.size.y, POST / glb.size.z);
      glb.object.position.y = FLOOR;
      unit.add(glb.object);
      return unit;
    }

    const post = this._mesh(worldBox(POST, H, POST, "y"), this.mats.wood);
    post.position.y = FLOOR + H / 2;
    const shoe = this._mesh(new THREE.BoxGeometry(POST + 0.03, 0.08, POST + 0.03), this.mats.aluminum);
    shoe.position.y = FLOOR + 0.04;
    const collar = this._mesh(new THREE.BoxGeometry(POST + 0.016, 0.035, POST + 0.016), this.mats.aluminum);
    collar.position.y = FLOOR + 0.095;
    unit.add(post, shoe, collar);
    return unit;
  }

  /* ------------------------------ walls ------------------------------ */

  _buildWalls(W, D, H, walls) {
    const clear = H - BEAM_H;
    Object.entries(SIDES).forEach(([key, s]) => {
      const type = walls[key] || "open";
      if (type === "open") return;
      const span = (s.dir[0] ? D : W) - POST * 2;

      const bay = new THREE.Group();
      bay.name = `Bay_${key}`;
      bay.position.set(s.dir[0] * (W / 2 - POST / 2), 0, s.dir[1] * (D / 2 - POST / 2));
      bay.rotation.y = s.rotY;
      bay.userData.normal = new THREE.Vector3(s.normal[0], 0, s.normal[1]);

      if (type === "solid") this._plankWall(bay, span, clear);
      else if (type === "half") this._plankWall(bay, span, 0.9, true);
      else if (type === "louver") this._louverWall(bay, span, clear);
      else if (type === "glass") this._glassWall(bay, span, clear, key);
      this.wallsGroup.add(bay);
    });
  }

  _plankWall(bay, span, height, capRail = false) {
    const glb = this.models?.has(NODE.WALL_SOLID);
    if (glb) {
      const probe = this.models.instance(NODE.WALL_SOLID);
      const n = Math.max(1, Math.round(span / probe.size.x));
      for (let i = 0; i < n; i++) {
        const mod = this._glb(NODE.WALL_SOLID, "wood");
        mod.object.scale.set(span / n / mod.size.x, height / mod.size.y, 1);
        mod.object.position.set(-span / 2 + (span / n) * (i + 0.5), FLOOR, 0);
        bay.add(mod.object);
      }
    } else {
      const count = Math.max(1, Math.round(height / 0.12));
      const ph = height / count;
      const back = this._mesh(new THREE.BoxGeometry(span, height, 0.01), this.mats.darkWood);
      back.position.set(0, FLOOR + height / 2, -0.012);
      const inst = new THREE.InstancedMesh(worldBox(span, ph - 0.004, 0.028, "x"), this.mats.wood, count);
      inst.castShadow = true;
      inst.receiveShadow = true;
      const m = new THREE.Matrix4();
      const c = new THREE.Color();
      for (let i = 0; i < count; i++) {
        m.makeTranslation(0, FLOOR + ph * (i + 0.5), 0);
        inst.setMatrixAt(i, m);
        inst.setColorAt(i, c.setScalar(0.88 + Math.random() * 0.12));
      }
      bay.add(back, inst);
    }
    if (capRail) {
      const rail = this._mesh(worldBox(span + 0.02, 0.04, 0.1, "x"), this.mats.wood);
      rail.position.set(0, FLOOR + height + 0.02, 0);
      bay.add(rail);
    }
  }

  _louverWall(bay, span, height) {
    const glb = this.models?.has(NODE.WALL_LOUVER);
    if (glb) {
      const probe = this.models.instance(NODE.WALL_LOUVER);
      const n = Math.max(1, Math.round(span / probe.size.x));
      for (let i = 0; i < n; i++) {
        const mod = this._glb(NODE.WALL_LOUVER, "wood");
        mod.object.scale.set(span / n / mod.size.x, height / mod.size.y, 1);
        mod.object.position.set(-span / 2 + (span / n) * (i + 0.5), FLOOR, 0);
        bay.add(mod.object);
      }
      return;
    }
    const railGeo = worldBox(span, 0.05, 0.07, "x");
    [0.025, height - 0.025].forEach((y) => {
      const r = this._mesh(railGeo, this.mats.wood);
      r.position.set(0, FLOOR + y, 0);
      bay.add(r);
    });
    const count = Math.max(4, Math.floor(span / 0.09));
    const inst = new THREE.InstancedMesh(worldBox(0.028, height - 0.1, 0.075, "y"), this.mats.wood, count);
    inst.castShadow = true;
    inst.receiveShadow = true;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      o.position.set(-span / 2 + (span / count) * (i + 0.5), FLOOR + height / 2, 0);
      o.rotation.y = Math.PI / 5;
      o.updateMatrix();
      inst.setMatrixAt(i, o.matrix);
      inst.setColorAt(i, c.setScalar(0.9 + Math.random() * 0.1));
    }
    bay.add(inst);
  }

  _glassWall(bay, span, height, sideKey) {
    const al = this.mats.aluminum;
    const trackGeo = new THREE.BoxGeometry(span, 0.035, 0.085);
    const bottom = this._mesh(trackGeo, al);
    bottom.position.set(0, FLOOR + 0.0175, 0);
    const top = this._mesh(trackGeo, al);
    top.position.set(0, FLOOR + height - 0.0175, 0);
    bay.add(bottom, top);

    const count = span > 3.5 ? 4 : 3;
    const pw = span / count + 0.03;
    const ph = height - 0.07;
    for (let i = 0; i < count; i++) {
      const panel = new THREE.Group();
      const baseX = -span / 2 + (span / count) * (i + 0.5);
      panel.position.set(baseX, FLOOR + 0.035, i % 2 === 0 ? 0.018 : -0.018);
      panel.userData = { baseX, index: i, count, slide: (span / count) * 0.88 };

      const glb = this._glb(NODE.DOOR, "metal");
      if (glb) {
        glb.object.scale.set(pw / glb.size.x, ph / glb.size.y, 1);
        panel.add(glb.object);
      } else {
        const pane = this._mesh(new THREE.BoxGeometry(pw - 0.05, ph - 0.05, 0.008), this.mats.glass, { cast: false });
        pane.position.y = ph / 2;
        pane.userData.noContactShadow = true;
        panel.add(pane);
        const rail = new THREE.BoxGeometry(pw, 0.03, 0.03);
        const stile = new THREE.BoxGeometry(0.03, ph, 0.03);
        [0.015, ph - 0.015].forEach((y) => {
          const r = this._mesh(rail, al);
          r.position.y = y;
          panel.add(r);
        });
        [-pw / 2 + 0.015, pw / 2 - 0.015].forEach((x) => {
          const s = this._mesh(stile, al);
          s.position.set(x, ph / 2, 0);
          panel.add(s);
        });
        const handle = this._mesh(new THREE.BoxGeometry(0.014, 0.22, 0.02), al);
        handle.position.set(i % 2 === 0 ? pw / 2 - 0.05 : -pw / 2 + 0.05, ph * 0.5, 0.02);
        panel.add(handle);
      }
      bay.add(panel);
      this.panels.push(panel);
    }
  }

  /** 0 = closed, 1 = fully slid open. */
  setGlassSlideOpen(p) {
    const t = THREE.MathUtils.clamp(p, 0, 1);
    this.panels.forEach(({ userData: u, position }) => {
      const dir = u.index < u.count / 2 ? -1 : 1;
      const factor = u.index === 0 || u.index === u.count - 1 ? 0.15 : 1;
      position.x = u.baseX + dir * u.slide * factor * t;
    });
  }

  /* ------------------------------- roof ------------------------------ */

  _buildRoof(W, D, H, OH, type, extras) {
    const baseY = FLOOR + H;
    const rw = W + OH * 2;
    const rd = D + OH * 2;

    if (type === "pyramid") this._pyramidRoof(rw, rd, baseY, extras);
    else this._flatRoof(rw, rd, baseY);

    if (extras) {
      const pipe = this._mesh(new THREE.CylinderGeometry(0.03, 0.03, H, 12), this.mats.aluminum);
      pipe.position.set(-rw / 2 + 0.06, FLOOR + H / 2, rd / 2 - 0.02);
      const tube = new THREE.CylinderGeometry(0.035, 0.035, rw, 12).rotateZ(Math.PI / 2);
      [rd / 2 + 0.03, -rd / 2 - 0.03].forEach((z) => {
        const g = this._mesh(tube, this.mats.aluminum);
        g.position.set(0, baseY - 0.07, z);
        this.roofGroup.add(g);
      });
      this.roofGroup.add(pipe);
    }
  }

  _fascia(rw, rd, y, h) {
    const fb = worldBox(rw + 0.05, h, 0.03, "x");
    const fl = worldBox(0.03, h, rd + 0.05, "z");
    [rd / 2, -rd / 2].forEach((z) => {
      const f = this._mesh(fb, this.mats.wood);
      f.position.set(0, y, z);
      this.roofGroup.add(f);
    });
    [rw / 2, -rw / 2].forEach((x) => {
      const f = this._mesh(fl, this.mats.wood);
      f.position.set(x, y, 0);
      this.roofGroup.add(f);
    });
  }

  _pyramidRoof(rw, rd, baseY, extras) {
    const peak = Math.max(0.7, Math.min(rw, rd) * 0.24);
    const glb = this._glb(NODE.ROOF_PYRAMID, "roof");
    if (glb) {
      glb.object.scale.set(rw / glb.size.x, peak / glb.size.y, rd / glb.size.z);
      glb.object.position.y = baseY;
      this.roofGroup.add(glb.object);
    } else {
      const geo = pyramidRoofGeometry(rw, rd, peak);
      const roof = this._mesh(geo, this.mats.roof);
      roof.position.y = baseY;
      const under = this._mesh(geo, this._underside, { cast: false });
      under.position.y = baseY;
      this.roofGroup.add(roof, under);

      // hip ridge caps
      const apex = new THREE.Vector3(0, baseY + peak, 0);
      [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].forEach(([sx, sz]) => {
        const corner = new THREE.Vector3((sx * rw) / 2, baseY, (sz * rd) / 2);
        const len = corner.distanceTo(apex);
        const hip = this._mesh(new THREE.BoxGeometry(0.09, 0.035, len), this.mats.roof);
        hip.position.copy(corner).add(apex).multiplyScalar(0.5);
        hip.lookAt(apex);
        hip.translateY(0.012);
        this.roofGroup.add(hip);
      });
      this._fascia(rw, rd, baseY - 0.04, 0.1);
    }
    if (extras) {
      const fin = this._mesh(finialGeometry(), this.mats.aluminum);
      fin.position.set(0, baseY + peak - 0.02, 0);
      this.roofGroup.add(fin);
    }
  }

  _flatRoof(rw, rd, baseY) {
    const body = this._mesh(worldBox(rw, 0.14, rd, "x"), this.mats.wood);
    body.position.y = baseY + 0.07;
    const surface = new THREE.PlaneGeometry(rw - 0.04, rd - 0.04).rotateX(-Math.PI / 2);
    const uv = surface.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, (uv.getX(i) * (rw - 0.04)) / ROOF_TILE_M, (uv.getY(i) * (rd - 0.04)) / ROOF_TILE_M);
    }
    const top = this._mesh(surface, this.mats.roof);
    top.position.y = baseY + 0.143;
    const under = this._mesh(new THREE.PlaneGeometry(rw, rd).rotateX(Math.PI / 2), this._underside, { cast: false });
    under.position.y = baseY - 0.001;
    this.roofGroup.add(body, top, under);
    const lip = worldBox(rw + 0.04, 0.025, rd + 0.04, "x");
    const edge = this._mesh(lip, this.mats.aluminum);
    edge.position.y = baseY + 0.145;
    edge.scale.set(1, 0.2, 1); // hairline drip edge
    this.roofGroup.add(edge);
  }

  /* ------------------------ bay picking & highlight ------------------ */

  _buildBayHelpers(W, D, H) {
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    Object.entries(SIDES).forEach(([key, s]) => {
      const span = (s.dir[0] ? D : W) - POST * 2;
      const px = s.dir[0] * (W / 2 - POST / 2);
      const pz = s.dir[1] * (D / 2 - POST / 2);
      const hit = new THREE.Mesh(new THREE.BoxGeometry(span, H - BEAM_H, 0.2), hitMat);
      hit.position.set(px, FLOOR + (H - BEAM_H) / 2, pz);
      hit.rotation.y = s.rotY;
      hit.userData.baySide = key;
      this.hitboxGroup.add(hit);
      this.bayHitboxes.push(hit);

      const plane = new THREE.Mesh(new THREE.PlaneGeometry(span, H - BEAM_H), this._highlightMat);
      plane.position.set(px + s.normal[0] * 0.06, FLOOR + (H - BEAM_H) / 2, pz + s.normal[1] * 0.06);
      plane.rotation.y = s.rotY;
      plane.visible = false;
      plane.userData.noContactShadow = true;
      this.highlightGroup.add(plane);
      this.highlights[key] = plane;
    });
  }

  highlightBay(side) {
    Object.entries(this.highlights).forEach(([k, p]) => (p.visible = k === side));
  }

  /* --------------------------- exploded view ------------------------- */

  _captureExplode() {
    const list = [];
    const add = (obj, off) => list.push({ obj, base: obj.position.clone(), off });
    add(this.roofGroup, new THREE.Vector3(0, 1.8, 0));
    add(this.beamsGroup, new THREE.Vector3(0, 0.6, 0));
    add(this.deckGroup, new THREE.Vector3(0, -0.35, 0));
    this.postsGroup.children.forEach((p) => {
      add(p, p.userData.outward.clone().multiplyScalar(0.32).setY(0.1));
    });
    this.wallsGroup.children.forEach((b) => add(b, b.userData.normal.clone().multiplyScalar(0.95)));
    this._explodables = list;
  }

  /** 0 = assembled, 1 = fully exploded. */
  setExplode(t) {
    this.explode = t;
    this._explodables.forEach(({ obj, base, off }) => obj.position.copy(base).addScaledVector(off, t));
  }
}
