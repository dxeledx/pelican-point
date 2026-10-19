import * as THREE from 'three';
import {
  TAU,
  clamp,
  damp,
  lerp,
  mulberry32,
  makeFeatherTexture,
  orientCylinder,
  twoBoneIK,
} from './utils.js';

const UP = new THREE.Vector3(0, 1, 0);
const TEMP = new THREE.Vector3();

function mesh(geometry, material, cast = true, receive = true) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

function ellipsoid(material, sx, sy, sz, segments = 24) {
  const m = mesh(new THREE.SphereGeometry(1, segments, Math.max(8, Math.round(segments * 0.65))), material);
  m.scale.set(sx, sy, sz);
  return m;
}

function makeWingFeather(material, length, width) {
  const feather = mesh(
    new THREE.SphereGeometry(1, 10, 6),
    material,
    true,
    true
  );
  feather.scale.set(length, width * 0.35, width);
  return feather;
}

function makeFoot(material, accentMaterial) {
  const group = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-0.055, -0.06);
  shape.quadraticCurveTo(0.045, -0.115, 0.14, -0.115);
  shape.quadraticCurveTo(0.235, -0.12, 0.3, -0.075);
  shape.quadraticCurveTo(0.24, -0.035, 0.315, 0.0);
  shape.quadraticCurveTo(0.24, 0.035, 0.3, 0.075);
  shape.quadraticCurveTo(0.235, 0.12, 0.14, 0.115);
  shape.quadraticCurveTo(0.045, 0.115, -0.055, 0.06);
  shape.quadraticCurveTo(-0.08, 0.0, -0.055, -0.06);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.018,
    bevelEnabled: false,
    curveSegments: 8,
  });
  geometry.rotateX(-Math.PI / 2);
  const web = mesh(geometry, material);
  web.position.y = 0.011;
  group.add(web);

  for (let i = -1; i <= 1; i++) {
    const toe = mesh(
      new THREE.CylinderGeometry(0.012, 0.021, 0.25, 6),
      accentMaterial,
      true,
      true
    );
    toe.rotation.z = Math.PI / 2;
    toe.rotation.y = i * 0.22;
    toe.position.set(0.12, 0.027, i * 0.055);
    group.add(toe);
  }
  group.userData.webbing = web;
  return group;
}

const BILL_SEGMENTS = 28;
const BILL_RADIAL = 14;

function smoothProfile(u, keys) {
  const x = clamp(u, 0, 1);
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (x >= a[0] && x <= b[0]) {
      const t = (x - a[0]) / Math.max(0.0001, b[0] - a[0]);
      const s = t * t * (3 - 2 * t);
      return lerp(a[1], b[1], s);
    }
  }
  return keys[keys.length - 1][1];
}

function billProfile(u) {
  const t = clamp(u, 0, 1);
  return {
    x: 0.012 + t * 0.8,
    y: 0.012 - 0.092 * Math.pow(t, 1.7),
    w: 0.158 * (1 - 0.79 * Math.pow(t, 1.55)) + 0.007,
    h: 0.061 * (1 - 0.62 * t),
  };
}

function pouchDepth(u) {
  return smoothProfile(u, [
    [0, 0.13],
    [0.1, 0.18],
    [0.34, 0.235],
    [0.55, 0.22],
    [0.75, 0.145],
    [0.9, 0.07],
    [1, 0.018],
  ]);
}

function makeUpperBillGeometry() {
  const positions = [];
  const colors = [];
  const indices = [];
  const baseColor = new THREE.Color(0xf2ad59);
  const tipColor = new THREE.Color(0xd77b3e);
  const topColor = new THREE.Color(0xf8c376);
  const color = new THREE.Color();
  for (let i = 0; i <= BILL_SEGMENTS; i++) {
    const u = i / BILL_SEGMENTS;
    const p = billProfile(u);
    for (let j = 0; j < BILL_RADIAL; j++) {
      const theta = (j / BILL_RADIAL) * TAU;
      const sin = Math.sin(theta);
      const cos = Math.cos(theta);
      positions.push(p.x, p.y + sin * p.h, cos * p.w);
      color.copy(baseColor).lerp(tipColor, Math.pow(u, 1.4) * 0.78);
      if (sin > 0.2) color.lerp(topColor, sin * 0.42 * (1 - u * 0.45));
      if (sin < -0.2) color.multiplyScalar(0.9);
      colors.push(color.r, color.g, color.b);
    }
  }
  for (let i = 0; i < BILL_SEGMENTS; i++) {
    for (let j = 0; j < BILL_RADIAL; j++) {
      const a = i * BILL_RADIAL + j;
      const b = i * BILL_RADIAL + ((j + 1) % BILL_RADIAL);
      const c = (i + 1) * BILL_RADIAL + j;
      const d = (i + 1) * BILL_RADIAL + ((j + 1) % BILL_RADIAL);
      indices.push(a, c, d, a, d, b);
    }
  }
  const tip = billProfile(1);
  const tipIndex = positions.length / 3;
  positions.push(tip.x + 0.015, tip.y - 0.005, 0);
  color.copy(tipColor).multiplyScalar(0.95);
  colors.push(color.r, color.g, color.b);
  const lastRing = BILL_SEGMENTS * BILL_RADIAL;
  for (let j = 0; j < BILL_RADIAL; j++) {
    indices.push(lastRing + j, tipIndex, lastRing + ((j + 1) % BILL_RADIAL));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makePouchGeometry() {
  const segments = 28;
  const radial = 16;
  const positions = [];
  const colors = [];
  const indices = [];
  const topColor = new THREE.Color(0xf0ae79);
  const bottomColor = new THREE.Color(0xcc7246);
  const color = new THREE.Color();
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const p = billProfile(u);
    const width = p.w * (0.88 + 0.12 * Math.sin(Math.PI * u));
    const depth = pouchDepth(u);
    const topY = p.y - p.h * 0.63;
    for (let j = 0; j <= radial; j++) {
      const theta = (j / radial) * Math.PI;
      const sin = Math.sin(theta);
      const cos = Math.cos(theta);
      positions.push(p.x, topY - depth * Math.pow(sin, 0.92), width * cos);
      color.copy(topColor).lerp(bottomColor, Math.pow(sin, 0.8) * 0.94);
      color.offsetHSL(0, 0, (1 - u) * 0.02 - sin * 0.015);
      colors.push(color.r, color.g, color.b);
    }
  }
  const stride = radial + 1;
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, d, c, a, b, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}


function makeFeatherGeometry({ base = 0xf2e7d4, tip = 0xbaa894, dent = 0.035 } = {}) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.015);
  shape.bezierCurveTo(-0.12, 0.115, -0.5, 0.16, -1.0, 0.025);
  shape.quadraticCurveTo(-0.84, -0.02, -0.64, -0.045);
  shape.quadraticCurveTo(-0.42, -0.13, -0.18, -0.075);
  shape.quadraticCurveTo(-0.08, -0.045, 0, -0.015);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape, 10);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const baseColor = new THREE.Color(base);
  const tipColor = new THREE.Color(tip);
  const color = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const t = clamp(-x, 0, 1);
    color.copy(baseColor).lerp(tipColor, Math.pow(t, 1.35) * 0.92);
    color.offsetHSL(0, 0.01, (Math.sin(i * 2.7) * 0.008));
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function featherMesh(geometry, material, length, width, cast = true) {
  const m = mesh(geometry, material, cast, true);
  // The leaf shape is 0.32 units wide before scaling.
  m.scale.set(length, width * 3.1, 1);
  return m;
}


export class Pelican {
  constructor(bike) {
    this.bike = bike;
    this.group = new THREE.Group();
    this.group.name = 'pelican';
    this.time = 0;
    this.random = mulberry32(34198);
    this.blinkTimer = 2.4 + this.random() * 2.5;
    this.blinking = false;
    this.blinkPhase = 0;
    this.honkTime = 0;
    this.honkDuration = 0.82;
    this.flapTime = 0;
    this.airTime = 0;
    this.bodyBase = new THREE.Vector3(-0.14, 1.56, 0);
    this.tailWag = 0;
    this.pedalEnergy = 0;

    this._buildMaterials();
    this._buildFeatherStatics();
    this._buildBody();
    this._buildNeckAndHead();
    this._buildHatAndScarf();
    this._buildWings();
    this._buildLegs();
    this._tagInteractive();
  }

  _buildMaterials() {
    this.materials = {
      feather: new THREE.MeshPhysicalMaterial({
        color: 0xf4ead8,
        roughness: 0.82,
        metalness: 0,
        clearcoat: 0.06,
        clearcoatRoughness: 0.85,
        sheen: 0.3,
        sheenColor: new THREE.Color(0xffe2bb),
        sheenRoughness: 0.8,
      }),
      featherWarm: new THREE.MeshStandardMaterial({
        color: 0xeaddc5,
        roughness: 0.86,
      }),
      featherShade: new THREE.MeshStandardMaterial({
        color: 0xcbbda8,
        roughness: 0.88,
      }),
      featherWing: new THREE.MeshStandardMaterial({
        color: 0xe4d3b9,
        roughness: 0.84,
      }),
      beak: new THREE.MeshPhysicalMaterial({
        color: 0xf0ad54,
        roughness: 0.43,
        metalness: 0.02,
        clearcoat: 0.42,
        clearcoatRoughness: 0.3,
      }),
      beakTip: new THREE.MeshPhysicalMaterial({
        color: 0xd57138,
        roughness: 0.4,
        clearcoat: 0.4,
      }),
      pouch: new THREE.MeshPhysicalMaterial({
        color: 0xdf8b53,
        roughness: 0.54,
        clearcoat: 0.28,
        clearcoatRoughness: 0.52,
        sheen: 0.2,
        sheenColor: new THREE.Color(0xffc590),
      }),
      pouchLight: new THREE.MeshStandardMaterial({
        color: 0xf0a16b,
        roughness: 0.6,
      }),
      orange: new THREE.MeshStandardMaterial({
        color: 0xe7934e,
        roughness: 0.63,
      }),
      orangeDark: new THREE.MeshStandardMaterial({
        color: 0xb86d35,
        roughness: 0.62,
      }),
      eyeWhite: new THREE.MeshStandardMaterial({
        color: 0xfff9ed,
        roughness: 0.22,
        metalness: 0,
      }),
      iris: new THREE.MeshPhysicalMaterial({
        color: 0xbf7a2b,
        roughness: 0.2,
        metalness: 0.15,
        clearcoat: 0.9,
      }),
      pupil: new THREE.MeshStandardMaterial({
        color: 0x15120f,
        roughness: 0.25,
      }),
      highlight: new THREE.MeshBasicMaterial({ color: 0xfffdf2 }),
      mouth: new THREE.MeshStandardMaterial({
        color: 0x6f3c28,
        roughness: 0.7,
      }),
      navy: new THREE.MeshStandardMaterial({
        color: 0x172f36,
        roughness: 0.58,
        metalness: 0.08,
      }),
      gold: new THREE.MeshStandardMaterial({
        color: 0xe2b25b,
        roughness: 0.28,
        metalness: 0.88,
      }),
      scarf: null,
    };
  }

  _buildFeatherStatics() {
    this.featherBump = makeFeatherTexture();
    this.materials.feather.bumpMap = this.featherBump;
    this.materials.feather.bumpScale = 0.012;
    this.materials.featherWarm.bumpMap = this.featherBump;
    this.materials.featherWarm.bumpScale = 0.008;
    this.featherGeometry = makeFeatherGeometry({ base: 0xf3e8d5, tip: 0xb9a68e });
    this.featherGeometryDark = makeFeatherGeometry({ base: 0xcdbaa1, tip: 0x5c4f45 });
    this.featherGeometrySoft = makeFeatherGeometry({ base: 0xf5ebda, tip: 0xd3c0a7 });
    this.featherPanelMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: 0.78,
      metalness: 0,
      sheen: 0.25,
      sheenColor: new THREE.Color(0xffe0ba),
      sheenRoughness: 0.85,
    });
    this.featherDarkMaterial = this.featherPanelMaterial.clone();
    this.featherDarkMaterial.sheenColor.setHex(0xd9c2aa);
    this.featherSoftMaterial = this.featherPanelMaterial.clone();
    this.featherSoftMaterial.roughness = 0.84;
    this.wingSurfaceMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: 0.81,
      metalness: 0,
      sheen: 0.32,
      sheenColor: new THREE.Color(0xffe3c1),
      sheenRoughness: 0.78,
    });
  }

  _buildBody() {
    this.bodyGroup = new THREE.Group();
    this.bodyGroup.position.copy(this.bodyBase);
    this.bodyGroup.rotation.z = -0.045;
    this.group.add(this.bodyGroup);

    const body = ellipsoid(this.materials.feather, 0.55, 0.43, 0.35, 32);
    body.rotation.z = -0.09;
    const chest = ellipsoid(this.materials.feather, 0.36, 0.33, 0.3, 28);
    chest.position.set(0.2, 0.07, 0);
    const belly = ellipsoid(this.materials.featherWarm, 0.38, 0.24, 0.27, 24);
    belly.position.set(0.12, -0.2, 0);
    this.bodyGroup.add(body, chest, belly);

    // Soft overlapping back feathers.
    const featherCount = 9;
    for (let i = 0; i < featherCount; i++) {
      const angle = -0.65 + (i / (featherCount - 1)) * 1.3;
      const feather = ellipsoid(this.materials.featherWarm, 0.16, 0.025, 0.075, 12);
      feather.position.set(-0.12 - Math.cos(angle) * 0.22, 0.25 + Math.sin(angle) * 0.07, angle * 0.42);
      feather.rotation.set(0.1, 0.2, 0.35 + angle);
      this.bodyGroup.add(feather);
    }

    this.tailGroup = new THREE.Group();
    this.tailGroup.position.set(-0.48, -0.02, 0);
    const tailBase = ellipsoid(this.materials.featherWarm, 0.17, 0.12, 0.18, 16);
    tailBase.position.set(0.02, 0, 0);
    this.tailGroup.add(tailBase);
    for (let i = 0; i < 7; i++) {
      const spread = (i - 3) / 3;
      const feather = featherMesh(
        i % 2 === 0 ? this.featherGeometry : this.featherGeometrySoft,
        this.featherPanelMaterial,
        0.42 + (1 - Math.abs(spread)) * 0.12,
        0.085 + (1 - Math.abs(spread)) * 0.028,
        true
      );
      feather.position.set(-0.015, spread * 0.07, spread * 0.095);
      feather.rotation.z = 0.13 + Math.abs(spread) * 0.06;
      feather.rotation.y = spread * 0.25;
      feather.rotation.x = -spread * 0.12;
      this.tailGroup.add(feather);
    }
    const tailCovert = ellipsoid(this.materials.featherWarm, 0.14, 0.055, 0.2, 16);
    tailCovert.position.set(-0.02, 0.05, 0);
    this.tailGroup.add(tailCovert);
    this.bodyGroup.add(this.tailGroup);


    this.shoulderAnchors = [];
    for (const side of [-1, 1]) {
      const anchor = new THREE.Object3D();
      anchor.position.set(0.09, 0.06, side * 0.31);
      this.bodyGroup.add(anchor);
      this.shoulderAnchors.push({ side, anchor });
    }

    this.hipAnchors = [];
    for (const side of [-1, 1]) {
      const anchor = new THREE.Object3D();
      anchor.position.set(-0.04, -0.25, side * 0.21);
      this.bodyGroup.add(anchor);
      this.hipAnchors.push({ side, anchor });

      const down = ellipsoid(this.materials.feather, 0.16, 0.16, 0.14, 16);
      down.position.set(-0.1, -0.24, side * 0.18);
      down.scale.multiplyScalar(0.82);
      this.bodyGroup.add(down);
    }

    // A few low, soft breast feathers.
    for (let i = 0; i < 3; i++) {
      const feather = ellipsoid(this.materials.featherWarm, 0.13, 0.025, 0.11, 12);
      feather.position.set(0.34 - i * 0.03, -0.13 - i * 0.07, 0);
      feather.rotation.z = -0.2 + i * 0.04;
      this.bodyGroup.add(feather);
    }
  }

  _buildNeckAndHead() {
    const m = this.materials;
    this.neckGroup = new THREE.Group();
    this.neckGroup.position.set(0.23, 0.2, 0);
    this.bodyGroup.add(this.neckGroup);

    const neckCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.015, 0.21, 0),
      new THREE.Vector3(0.11, 0.38, 0),
      new THREE.Vector3(0.3, 0.49, 0),
      new THREE.Vector3(0.39, 0.58, 0),
    ]);
    const neck = mesh(new THREE.TubeGeometry(neckCurve, 24, 0.105, 12, false), m.feather);
    neck.scale.z = 0.94;
    this.neckGroup.add(neck);

    // Warm throat feathers.
    const throat = ellipsoid(m.featherWarm, 0.08, 0.24, 0.075, 16);
    throat.position.set(0.25, 0.38, 0);
    throat.rotation.z = -0.46;
    this.neckGroup.add(throat);

    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0.4, 0.61, 0);
    this.neckGroup.add(this.headGroup);

    const head = ellipsoid(m.feather, 0.24, 0.215, 0.205, 28);
    head.position.set(0.06, 0.015, 0);
    this.headGroup.add(head);

    const cheeks = ellipsoid(m.featherWarm, 0.17, 0.15, 0.185, 20);
    cheeks.position.set(0.09, -0.025, 0);
    this.headGroup.add(cheeks);

    // Crown feathers.
    for (let i = 0; i < 3; i++) {
      const crest = makeWingFeather(m.featherWarm, 0.12, 0.035);
      crest.position.set(-0.05 - i * 0.055, 0.17 + i * 0.018, (i - 1) * 0.035);
      crest.rotation.z = 0.58 + i * 0.12;
      crest.rotation.x = (i - 1) * 0.16;
      this.headGroup.add(crest);
    }

    this._buildEyes();
    this._buildBeak();

    // The scarf knot is hidden by the collar but casts a tiny shadow.
    const knot = mesh(new THREE.TorusKnotGeometry(0.027, 0.009, 36, 5, 2, 3), m.gold || this.materials.gold, false, false);
    knot.visible = false;
    this.neckGroup.add(knot);
  }

  _buildEyes() {
    const m = this.materials;
    this.eyes = [];
    for (const side of [-1, 1]) {
      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(0.13, 0.055, side * 0.165);
      eyeGroup.scale.z = 0.92;

      const white = mesh(new THREE.SphereGeometry(1, 18, 12), m.eyeWhite, false, false);
      white.scale.set(0.071, 0.079, 0.046);
      const iris = mesh(new THREE.SphereGeometry(1, 16, 10), m.iris, false, false);
      iris.scale.set(0.032, 0.038, 0.016);
      iris.position.set(0.014, 0.002, side * 0.071);
      const pupil = mesh(new THREE.SphereGeometry(1, 14, 8), m.pupil, false, false);
      pupil.scale.set(0.018, 0.024, 0.01);
      pupil.position.set(0.023, 0.0, side * 0.084);
      const glint = mesh(new THREE.SphereGeometry(1, 8, 6), m.highlight, false, false);
      glint.scale.setScalar(0.007);
      glint.position.set(0.04, 0.012, side * 0.089);
      eyeGroup.add(white, iris, pupil, glint);

      const brow = makeWingFeather(m.featherShade, 0.095, 0.026);
      brow.position.set(0.03, 0.145, side * 0.18);
      brow.rotation.set(0.15, side * 0.1, -0.13);
      this.headGroup.add(brow);

      this.headGroup.add(eyeGroup);
      this.eyes.push({ side, group: eyeGroup });
    }
  }

  _buildBeak() {
    const m = this.materials;
    this.beakGroup = new THREE.Group();
    this.beakGroup.position.set(0.225, -0.002, 0);
    this.headGroup.add(this.beakGroup);

    this.beakUpperGroup = new THREE.Group();
    this.beakUpperGroup.rotation.z = -0.018;
    const upperMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.4,
      metalness: 0.02,
      clearcoat: 0.42,
      clearcoatRoughness: 0.3,
    });
    const upper = mesh(makeUpperBillGeometry(), upperMaterial);
    upper.material.side = THREE.FrontSide;
    this.upperBillMesh = upper;
    this.upperBillMaterial = upperMaterial;
    this.beakUpperGroup.add(upper);

    // Rounded, hooked nail at the tip.
    const tip = billProfile(1);
    const nail = mesh(new THREE.ConeGeometry(0.034, 0.085, 8), m.beakTip);
    nail.rotation.z = -1.18;
    nail.position.set(tip.x - 0.012, tip.y - 0.032, 0);
    nail.scale.z = 0.8;
    this.beakUpperGroup.add(nail);

    // Nostrils pressed into the warm upper mandible.
    for (const side of [-1, 1]) {
      const nostril = mesh(new THREE.SphereGeometry(1, 8, 6), m.mouth, false, false);
      nostril.scale.set(0.035, 0.009, 0.012);
      nostril.rotation.z = -0.14;
      nostril.position.set(0.17, 0.055, side * 0.064);
      this.beakUpperGroup.add(nostril);
    }

    // Upper ridge highlight.
    const ridgePoints = [];
    for (let i = 0; i <= 14; i++) {
      const u = i / 14;
      const p = billProfile(u);
      ridgePoints.push(new THREE.Vector3(p.x, p.y + p.h + 0.001, 0));
    }
    const ridge = mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ridgePoints), 24, 0.003, 4, false),
      new THREE.MeshStandardMaterial({ color: 0xeab165, roughness: 0.54 }),
      false,
      false
    );
    this.beakUpperGroup.add(ridge);
    this.beakGroup.add(this.beakUpperGroup);

    this.jaw = new THREE.Group();
    this.jaw.position.set(0.004, -0.002, 0);
    this.beakGroup.add(this.jaw);

    this.pouchMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.52,
      metalness: 0,
      clearcoat: 0.25,
      clearcoatRoughness: 0.52,
      sheen: 0.35,
      sheenColor: new THREE.Color(0xffc292),
      sheenRoughness: 0.75,
      side: THREE.DoubleSide,
    });
    this.pouchMesh = mesh(makePouchGeometry(), this.pouchMaterial);
    this.pouchMesh.receiveShadow = true;
    this.jaw.add(this.pouchMesh);

    // Throat base, tying the pouch into the neck.
    this.throatMaterial = this.pouchMaterial.clone();
    this.throatMaterial.vertexColors = false;
    this.throatMaterial.color.setHex(0xe09a69);
    const throat = mesh(new THREE.SphereGeometry(1, 16, 12), this.throatMaterial);
    throat.scale.set(0.115, 0.13, 0.115);
    throat.position.set(0.015, -0.115, 0);
    throat.rotation.z = 0.2;
    this.jaw.add(throat);

    // Two fine mouth seams, one for each side of the pouch.
    const seamMaterial = new THREE.MeshStandardMaterial({
      color: 0x74402c,
      roughness: 0.68,
    });
    for (const side of [-1, 1]) {
      const seamPoints = [];
      for (let i = 0; i <= 18; i++) {
        const u = i / 18;
        const p = billProfile(u);
        const width = p.w * (0.88 + 0.12 * Math.sin(Math.PI * u));
        seamPoints.push(new THREE.Vector3(p.x, p.y - p.h * 0.63 + 0.002, side * width));
      }
      const seam = mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seamPoints), 20, 0.005, 4, false),
        seamMaterial,
        false,
        false
      );
      this.jaw.add(seam);
    }

    // A quiet little chin feather in front of the throat.
    const chin = ellipsoid(this.materials.featherWarm, 0.075, 0.025, 0.09, 12);
    chin.position.set(0.06, -0.22, 0);
    this.jaw.add(chin);

    this.pouch = this.pouchMesh;
    this.throat = throat;
  }

  _buildHatAndScarf() {
    const m = this.materials;
    this.hat = new THREE.Group();
    this.hat.position.set(0.035, 0.205, 0);
    this.hat.rotation.z = -0.06;
    const crown = mesh(new THREE.CylinderGeometry(0.19, 0.225, 0.15, 24), m.feather);
    crown.position.y = 0.065;
    const crownTop = mesh(new THREE.CylinderGeometry(0.228, 0.215, 0.04, 24), m.feather);
    crownTop.position.y = 0.15;
    const band = mesh(new THREE.CylinderGeometry(0.228, 0.23, 0.05, 24), m.navy);
    band.position.y = 0.005;
    const visor = mesh(
      new THREE.CircleGeometry(0.225, 22, -Math.PI / 2, Math.PI),
      m.navy
    );
    visor.rotation.x = -Math.PI / 2;
    visor.rotation.z = -Math.PI / 2;
    visor.scale.set(1.0, 0.7, 1);
    visor.position.set(0.13, -0.022, 0);
    const badge = mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.012, 16), m.gold);
    badge.rotation.x = Math.PI / 2;
    badge.position.set(0.185, 0.02, 0.0);
    const topButton = mesh(new THREE.SphereGeometry(0.024, 12, 8), m.gold, false, false);
    topButton.position.set(0, 0.18, 0);
    this.hat.add(crown, crownTop, band, visor, badge, topButton);
    this.headGroup.add(this.hat);

    // Scarf collar around the base of the neck.
    this.collar = mesh(new THREE.TorusGeometry(0.112, 0.03, 8, 28), m.orangeDark);
    this.collar.rotation.x = Math.PI / 2;
    this.collar.rotation.z = 0.06;
    this.collar.position.set(0.055, 0.18, 0);
    this.collar.scale.z = 0.78;
    this.neckGroup.add(this.collar);

    const knotBall = mesh(new THREE.SphereGeometry(0.046, 12, 8), m.orange);
    knotBall.scale.set(1.2, 0.75, 0.8);
    knotBall.position.set(0.155, 0.155, 0.02);
    this.neckGroup.add(knotBall);

    this.scarfMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uWind: { value: 0.4 },
        uColorA: { value: new THREE.Color(0x7e2f23) },
        uColorB: { value: new THREE.Color(0xf4a04f) },
        uLight: { value: 1.0 },
        uTipColor: { value: new THREE.Color(0xffd89a) },
        uSide: { value: 1 },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uWind;
        varying vec2 vUv;
        varying float vFold;
        varying vec3 vNormalW;
        void main() {
          vUv = uv;
          vec3 p = position;
          float t = uv.x;
          float amp = (0.035 + uWind * 0.15) * pow(t, 1.15);
          float phase = uTime * (2.8 + uWind * 3.4);
          p.y += sin(t * 8.0 - phase) * amp + sin(t * 3.4 + uTime * 1.3) * amp * 0.42;
          p.z += cos(t * 6.7 - phase * 0.83) * amp * 0.82;
          p.y -= t * t * 0.16;
          vFold = sin(t * 8.0 - phase);
          vNormalW = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform vec3 uTipColor;
        uniform float uLight;
        varying vec2 vUv;
        varying float vFold;
        varying vec3 vNormalW;
        void main() {
          float edge = smoothstep(0.0, 0.11, vUv.y) * smoothstep(1.0, 0.89, vUv.y);
          float notch = smoothstep(0.0, 0.05, abs(vUv.y - 0.5) - max(0.0, vUv.x - 0.88) * 2.6);
          edge *= vUv.x > 0.88 ? notch : 1.0;
          vec3 col = mix(uColorA, uColorB, smoothstep(0.0, 1.0, vUv.x) * 0.92);
          col *= 0.88 + vFold * 0.08;
          col = mix(col, uTipColor, smoothstep(0.78, 1.0, vUv.x) * (0.3 + 0.35 * sin(vUv.x * 15.0)));
          col *= uLight;
          float sheen = pow(1.0 - abs(dot(normalize(vNormalW), vec3(0.0, 0.0, 1.0))), 2.0) * 0.13;
          col += vec3(sheen, sheen * 0.55, sheen * 0.3);
          gl_FragColor = vec4(col, edge);
        }
      `,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: true,
    });

    this.scarfTails = [];
    for (let i = 0; i < 2; i++) {
      const length = i === 0 ? 1.05 : 0.78;
      const geometry = new THREE.PlaneGeometry(length, i === 0 ? 0.16 : 0.115, 26, 3);
      geometry.translate(-length / 2, 0, i * 0.025);
      const material = this.scarfMaterial.clone();
      material.uniforms.uTime.value = 0;
      material.uniforms.uColorA.value = new THREE.Color(i === 0 ? 0x6f201a : 0xa54324);
      material.uniforms.uColorB.value = new THREE.Color(i === 0 ? 0xff9f43 : 0xf3b663);
      material.uniforms.uWind.value = 0.45 + i * 0.1;
      const ribbon = mesh(geometry, material, true, false);
      ribbon.position.set(0.09, 0.2 + i * 0.028, 0.026 + i * 0.038);
      ribbon.rotation.z = -0.3 + i * 0.16;
      ribbon.rotation.y = -0.25 + i * 0.34;
      ribbon.rotation.x = -0.03 + i * 0.12;
      ribbon.frustumCulled = false;
      this.neckGroup.add(ribbon);
      this.scarfTails.push({ mesh: ribbon, material });
    }
  }

  _makeWingSurface(side) {
    const columns = 10;
    const rows = 4;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(columns * rows * 3);
    const colors = new Float32Array(columns * rows * 3);
    const indices = [];
    const base = new THREE.Color(0xe1d1b8);
    const edge = new THREE.Color(0x9d8b76);
    const color = new THREE.Color();
    for (let i = 0; i < columns; i++) {
      const u = i / (columns - 1);
      for (let j = 0; j < rows; j++) {
        const v = j / (rows - 1);
        const index = i * rows + j;
        color.copy(base).lerp(edge, Math.pow(v, 1.35) * 0.62 + Math.pow(u, 1.8) * 0.2);
        color.offsetHSL(0, 0.01, Math.sin(i * 1.7 + j * 2.1) * 0.008);
        colors[index * 3] = color.r;
        colors[index * 3 + 1] = color.g;
        colors[index * 3 + 2] = color.b;
      }
    }
    for (let i = 0; i < columns - 1; i++) {
      for (let j = 0; j < rows - 1; j++) {
        const a = i * rows + j;
        const b = (i + 1) * rows + j;
        const c = i * rows + j + 1;
        const d = (i + 1) * rows + j + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const surface = mesh(geometry, this.wingSurfaceMaterial, true, true);
    surface.frustumCulled = false;
    return { surface, geometry, columns, rows };
  }

  _buildWings() {
    const m = this.materials;
    this.wings = [];
    for (const side of [-1, 1]) {
      const upper = mesh(new THREE.CylinderGeometry(0.058, 0.095, 1, 10), m.featherWing);
      const lower = mesh(new THREE.CylinderGeometry(0.035, 0.062, 1, 9), m.featherWing);
      const shoulder = mesh(new THREE.SphereGeometry(0.115, 16, 12), m.feather);
      const elbow = mesh(new THREE.SphereGeometry(0.068, 12, 9), m.featherWarm);
      const wrist = mesh(new THREE.SphereGeometry(0.049, 12, 8), m.featherWarm);

      const primaries = new THREE.Group();
      const primarySpecs = [
        { length: 0.36, width: 0.062, z: -0.065, droop: 0.16, material: this.featherPanelMaterial, geometry: this.featherGeometrySoft },
        { length: 0.45, width: 0.072, z: -0.022, droop: 0.23, material: this.featherPanelMaterial, geometry: this.featherGeometry },
        { length: 0.51, width: 0.08, z: 0.022, droop: 0.31, material: this.featherDarkMaterial, geometry: this.featherGeometryDark },
        { length: 0.44, width: 0.068, z: 0.06, droop: 0.41, material: this.featherDarkMaterial, geometry: this.featherGeometryDark },
      ];
      for (let i = 0; i < primarySpecs.length; i++) {
        const spec = primarySpecs[i];
        const feather = featherMesh(spec.geometry, spec.material, spec.length, spec.width);
        feather.position.set(-0.015, -0.005, spec.z);
        feather.rotation.z = spec.droop;
        feather.rotation.y = (i - 1.5) * 0.09 * side;
        feather.rotation.x = side * (i - 1.5) * 0.04;
        primaries.add(feather);
      }

      const secondaries = [];
      for (let i = 0; i < 4; i++) {
        const feather = featherMesh(
          i < 2 ? this.featherGeometrySoft : this.featherGeometry,
          i < 2 ? this.featherPanelMaterial : this.featherDarkMaterial,
          0.3 + i * 0.04,
          0.085 + i * 0.008
        );
        feather.userData.t = 0.18 + i * 0.23;
        feather.userData.baseDroop = 0.54 + i * 0.035;
        this.group.add(feather);
        secondaries.push(feather);
      }
      const coverts = [];
      for (let i = 0; i < 3; i++) {
        const feather = featherMesh(
          this.featherGeometrySoft,
          this.featherPanelMaterial,
          0.17 + i * 0.035,
          0.07 + i * 0.006
        );
        feather.userData.t = 0.15 + i * 0.27;
        feather.userData.baseDroop = 0.8 + i * 0.04;
        this.group.add(feather);
        coverts.push(feather);
      }

      this.group.add(upper, lower, shoulder, elbow, wrist, primaries);
      this.wings.push({
        side,
        upper,
        lower,
        shoulder,
        elbow,
        wrist,
        primaries,
        secondaries,
        coverts,
        elbowPos: new THREE.Vector3(),
        wristPos: new THREE.Vector3(),
        shoulderPos: new THREE.Vector3(),
      });
    }
  }

  _updateWingSurface(wing, time) {
    const { geometry, columns, rows, surface } = wing.wingSurface;
    const curve = wing.curve;
    curve.points[0].copy(wing.shoulderPos);
    curve.points[1].copy(wing.elbowPos);
    curve.points[2].copy(wing.wristPos);
    curve.updateArcLengths();
    const positions = geometry.attributes.position.array;
    const chordBase = new THREE.Vector3(-0.92, -0.24, wing.side * 0.32).normalize();
    const lead = new THREE.Vector3();
    const point = new THREE.Vector3();
    for (let i = 0; i < columns; i++) {
      const t = i / (columns - 1);
      curve.getPoint(t, lead);
      for (let j = 0; j < rows; j++) {
        const v = j / (rows - 1);
        const chord = (0.035 + Math.sin(Math.PI * Math.min(1, t * 1.12)) * 0.22) * v;
        point.copy(lead).addScaledVector(chordBase, chord);
        point.y -= Math.sin(Math.PI * v) * 0.025;
        point.z += wing.side * Math.sin(Math.PI * v) * 0.025;
        if (j === rows - 1) {
          point.addScaledVector(chordBase, Math.sin(t * Math.PI * 5.0 + wing.side) * 0.018);
        }
        const index = (i * rows + j) * 3;
        positions[index] = point.x;
        positions[index + 1] = point.y;
        positions[index + 2] = point.z;
      }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    surface.material = this.wingSurfaceMaterial;
  }

  _buildLegs() {
    const m = this.materials;
    this.legs = [];
    for (const side of [-1, 1]) {
      const pedalIndex = side > 0 ? 0 : 1;
      const upper = mesh(new THREE.CylinderGeometry(0.046, 0.07, 1, 8), m.orange);
      const lower = mesh(new THREE.CylinderGeometry(0.032, 0.052, 1, 8), m.orange);
      const knee = mesh(new THREE.SphereGeometry(0.043, 10, 8), m.orangeDark);
      const thigh = ellipsoid(m.feather, 0.15, 0.2, 0.13, 16);
      const foot = makeFoot(m.orange, m.orangeDark);
      this.group.add(upper, lower, knee, thigh, foot);
      this.legs.push({
        side,
        pedalIndex,
        upper,
        lower,
        knee,
        thigh,
        foot,
        hip: new THREE.Vector3(),
        kneePos: new THREE.Vector3(),
        target: new THREE.Vector3(),
      });
    }
  }

  _tagInteractive() {
    this.group.traverse((object) => {
      if (object.isMesh) {
        object.userData.action = 'honk';
      }
    });
  }

  honk() {
    if (this.honkTime > 0.15) return;
    this.honkTime = this.honkDuration;
    if (this.onHonk) this.onHonk();
  }

  flap() {
    this.flapTime = 1;
  }

  _updateBlink(dt) {
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0 && !this.blinking) {
      this.blinking = true;
      this.blinkPhase = 0;
    }
    if (this.blinking) {
      this.blinkPhase += dt / 0.14;
      if (this.blinkPhase >= 1) {
        this.blinking = false;
        this.blinkTimer = 2.8 + this.random() * 4.4;
        this.blinkPhase = 0;
      }
    }
    const closed = this.blinking ? 1 - Math.abs(Math.cos(this.blinkPhase * Math.PI)) : 0;
    const scaleY = 1 - closed * 0.92;
    for (const eye of this.eyes) {
      eye.group.scale.y = scaleY;
    }
  }

  _updateScarf(dt, time, speed, air) {
    const wind = clamp(speed / 8.5, 0.06, 1) + air * 0.3;
    for (let i = 0; i < this.scarfTails.length; i++) {
      const { mesh: ribbon, material } = this.scarfTails[i];
      material.uniforms.uTime.value = time + i * 0.6;
      material.uniforms.uWind.value = damp(material.uniforms.uWind.value, 0.18 + wind * 0.9, 2.5, dt);
      material.uniforms.uLight.value = damp(material.uniforms.uLight.value, 0.8 + 0.22 * (1 - clamp((this.nightFactor || 0), 0, 1)), 2, dt);
      ribbon.rotation.z = damp(ribbon.rotation.z, -0.2 - wind * 0.2 + i * 0.16 + Math.sin(time * 1.1 + i) * 0.035, 2.8, dt);
      ribbon.rotation.y = damp(ribbon.rotation.y, (i === 0 ? -0.25 : 0.08) + Math.sin(time * 0.7 + i) * 0.08, 2.2, dt);
      ribbon.rotation.x = damp(ribbon.rotation.x, -0.05 + i * 0.12 + Math.sin(time * 0.8 + i) * 0.04, 2.5, dt);
    }
  }

  _updateWings(dt, time, air, speed) {
    const targetOffsetY = air * 0.36 + Math.sin(time * 2.4) * 0.004;
    const spread = air * 0.29;
    const flap = Math.sin(this.flapTime * Math.PI * 2.2) * this.flapTime * 0.12;

    for (const wing of this.wings) {
      const shoulderAnchor = this.shoulderAnchors.find((entry) => entry.side === wing.side);
      shoulderAnchor.anchor.getWorldPosition(wing.shoulderPos);
      this.group.worldToLocal(wing.shoulderPos);

      const grip = this.bike.getGripPosition(wing.side, TEMP);
      wing.wristPos.copy(grip);
      wing.wristPos.y += targetOffsetY + (air > 0.01 ? 0.16 : 0);
      wing.wristPos.z += wing.side * spread;
      wing.wristPos.x -= air * 0.12;

      const pole = new THREE.Vector3(-0.65, 0.83 + flap, wing.side * 1.25);
      const ik = twoBoneIK(wing.shoulderPos, wing.wristPos, 0.53, 0.5, pole, wing.elbowPos);
      wing.elbowPos.copy(ik.elbow);
      if (!ik.reachable) {
        const dir = wing.wristPos.clone().sub(wing.shoulderPos).normalize();
        wing.elbowPos.copy(wing.shoulderPos).addScaledVector(dir, 0.52).add(new THREE.Vector3(0, 0.16, wing.side * 0.16));
      }

      orientCylinder(wing.upper, wing.shoulderPos, wing.elbowPos);
      orientCylinder(wing.lower, wing.elbowPos, wing.wristPos);

      wing.upper.scale.x = 1;
      wing.upper.scale.z = 0.9;
      wing.lower.scale.z = 0.75;
      wing.shoulder.position.copy(wing.shoulderPos);
      wing.shoulder.scale.set(1.15, 0.9, 1.1);
      wing.elbow.position.copy(wing.elbowPos);
      wing.wrist.position.copy(wing.wristPos);

      wing.primaries.position.copy(wing.wristPos);
      wing.primaries.position.x -= 0.015;
      wing.primaries.position.y -= 0.025;
      wing.primaries.rotation.z = -0.04 + Math.sin(time * 1.5 + wing.side) * 0.025;
      wing.primaries.rotation.x = wing.side * 0.06;
      wing.primaries.rotation.y = wing.side * 0.04;

      for (const feather of wing.secondaries) {
        const t = feather.userData.t;
        feather.position.lerpVectors(wing.elbowPos, wing.wristPos, t);
        feather.position.x -= 0.018;
        feather.position.y -= 0.045;
        feather.position.z += wing.side * 0.04;
        feather.rotation.z = feather.userData.baseDroop + Math.sin(time * 1.25 + t * 5) * 0.025;
      }
      for (const feather of wing.coverts) {
        const t = feather.userData.t;
        feather.position.lerpVectors(wing.shoulderPos, wing.elbowPos, t);
        feather.position.x -= 0.018;
        feather.position.y -= 0.01;
        feather.position.z += wing.side * 0.05;
        feather.rotation.z = feather.userData.baseDroop + Math.sin(time * 1.1 + t * 4) * 0.02;
      }
    }
  }

  _updateLegs(dt, time, air, speed) {
    const footLift = air * 0.28;
    for (const leg of this.legs) {
      const hipAnchor = this.hipAnchors.find((entry) => entry.side === leg.side);
      hipAnchor.anchor.getWorldPosition(leg.hip);
      this.group.worldToLocal(leg.hip);

      const pedal = this.bike.getPedalPosition(leg.pedalIndex, leg.target);
      leg.target.y += 0.082 + footLift;
      leg.target.x += air * -0.06;
      leg.target.z += leg.side * 0.012;
      if (air > 0.01) {
        leg.target.x -= 0.08;
        leg.target.y += 0.1;
      }

      const pole = new THREE.Vector3(1, 0.28, leg.side * 0.08);
      const ik = twoBoneIK(leg.hip, leg.target, 0.63, 0.58, pole, leg.kneePos);
      leg.kneePos.copy(ik.elbow);
      orientCylinder(leg.upper, leg.hip, leg.kneePos);
      orientCylinder(leg.lower, leg.kneePos, leg.target);
      leg.knee.position.copy(leg.kneePos);
      leg.thigh.position.copy(leg.hip);
      leg.thigh.position.x -= 0.02;
      leg.thigh.rotation.z = -0.1;

      leg.foot.position.copy(leg.target);
      leg.foot.position.y -= 0.07;
      const pump = Math.sin(this.bike.crankAngle * 2 + (leg.side > 0 ? 0 : Math.PI));
      leg.foot.rotation.z = 0.015 + pump * 0.025;
      leg.foot.rotation.y = Math.sin(time * 1.2 + leg.side) * 0.02;
    }
  }

  update(dt, time, state = {}) {
    this.time = time;
    const speed = Math.max(0, state.speed ?? 0);
    const air = clamp(state.air ?? 0, 0, 1);
    const crank = this.bike.crankAngle;
    const pedalFactor = clamp(speed / 2.2, 0, 1);
    this.pedalEnergy = damp(this.pedalEnergy, pedalFactor, 3, dt);
    this.airTime = air;

    this.honkTime = Math.max(0, this.honkTime - dt);
    this.flapTime = Math.max(0, this.flapTime - dt * 1.25);
    this._updateBlink(dt);

    const bob = Math.sin(crank * 2) * 0.016 * this.pedalEnergy + Math.sin(time * 1.2) * 0.006;
    const breathing = Math.sin(time * 1.1) * 0.006;
    this.bodyGroup.position.set(
      this.bodyBase.x + Math.sin(crank * 2) * 0.006 * this.pedalEnergy,
      this.bodyBase.y + bob + breathing + air * 0.05,
      this.bodyBase.z + Math.cos(crank) * 0.005 * this.pedalEnergy
    );
    this.bodyGroup.rotation.z = -0.045 - clamp(speed * 0.006, 0, 0.055) + Math.sin(time * 0.8) * 0.006;
    this.bodyGroup.rotation.x = Math.sin(crank) * 0.018 * this.pedalEnergy + Math.sin(time * 0.7) * 0.004;

    const lookYaw = Math.sin(time * 0.28) * 0.06 + (state.steer || 0) * 0.09;
    this.neckGroup.rotation.y = damp(this.neckGroup.rotation.y, lookYaw, 2.2, dt);
    this.neckGroup.rotation.z = -0.018 + Math.sin(time * 1.3) * 0.012 + (state.hop || 0) * 0.015;
    this.headGroup.rotation.z = 0.015 + Math.sin(time * 0.9 + 0.4) * 0.018;
    this.headGroup.rotation.x = Math.sin(time * 0.55) * 0.025;

    const honkOpen = this.honkTime > 0
      ? Math.sin(Math.min(1, (this.honkDuration - this.honkTime) / 0.18) * Math.PI * 0.5)
        * Math.min(1, this.honkTime / 0.2)
      : 0;
    this.jaw.rotation.z = -honkOpen * 0.23 + Math.sin(time * 1.4) * 0.006;
    this.beakUpperGroup.rotation.z = -0.018 + honkOpen * 0.075;
    this.headGroup.rotation.z += honkOpen * 0.08;
    const throatPulse = 1 + Math.sin(crank * 2 + 0.4) * 0.016 * this.pedalEnergy;
    this.throat.scale.set(0.115 * throatPulse, 0.13 * throatPulse, 0.115 * throatPulse);
    this.hat.rotation.z = -0.06 + Math.sin(crank) * 0.012;
    this.hat.rotation.x = Math.sin(time * 0.8) * 0.012;

    this.tailGroup.rotation.z = -0.03 + Math.sin(time * 1.5) * 0.024 + speed * 0.004;
    this.tailGroup.rotation.y = Math.sin(time * 0.9) * 0.045;

    this._updateScarf(dt, time, speed, air);
    this.group.updateMatrixWorld(true);
    this._updateWings(dt, time, air, speed);
    this._updateLegs(dt, time, air, speed);

    if (this.collar) this.collar.rotation.z = 0.06 + Math.sin(time * 0.9) * 0.01;
  }

  setNight(factor) {
    this.nightFactor = factor;
    this.materials.feather.sheenColor.setRGB(
      1.0 - factor * 0.24,
      0.8 - factor * 0.16,
      0.58 - factor * 0.12
    );
  }
}
