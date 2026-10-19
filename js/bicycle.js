import * as THREE from 'three';
import {
  TAU,
  clamp,
  damp,
  makeBadgeTexture,
  makeCylinderBetween,
  makeGlowTexture,
  makeWickerTexture,
  mulberry32,
} from './utils.js';

const UP = new THREE.Vector3(0, 1, 0);

function makeMesh(geometry, material, cast = true, receive = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

function tubeBetween(a, b, radius, material, radialSegments = 8, radiusTop = radius) {
  return makeCylinderBetween(a, b, radius, material, radialSegments, radiusTop);
}

export class Bicycle {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'bicycle';
    this.wheelAngle = 0;
    this.crankAngle = 0;
    this.steerAngle = 0;
    this.time = 0;
    this.bellPulse = 0;
    this.braking = 0;
    this.fishWiggle = 0;
    this.random = mulberry32(9221);

    this._buildMaterials();
    this._buildWheels();
    this._buildFrame();
    this._buildDrivetrain();
    this._buildSaddle();
    this._buildHandlebars();
    this._buildBasket();
    this._buildLights();
    this._buildContactShadow();
    this._buildDetails();
  }

  _buildMaterials() {
    this.materials = {
      frame: new THREE.MeshPhysicalMaterial({
        color: 0x146a66,
        metalness: 0.55,
        roughness: 0.3,
        clearcoat: 0.85,
        clearcoatRoughness: 0.22,
      }),
      frameDeep: new THREE.MeshStandardMaterial({
        color: 0x0d4b49,
        metalness: 0.6,
        roughness: 0.35,
      }),
      chrome: new THREE.MeshStandardMaterial({
        color: 0xe2d3bb,
        metalness: 0.93,
        roughness: 0.18,
      }),
      darkMetal: new THREE.MeshStandardMaterial({
        color: 0x242629,
        metalness: 0.8,
        roughness: 0.38,
      }),
      rubber: new THREE.MeshStandardMaterial({
        color: 0x171719,
        roughness: 0.92,
        metalness: 0.02,
      }),
      cream: new THREE.MeshPhysicalMaterial({
        color: 0xf0e3cb,
        metalness: 0.12,
        roughness: 0.48,
        clearcoat: 0.4,
        clearcoatRoughness: 0.5,
      }),
      leather: new THREE.MeshStandardMaterial({
        color: 0x613d29,
        roughness: 0.73,
        metalness: 0.04,
      }),
      leatherDark: new THREE.MeshStandardMaterial({
        color: 0x3e291f,
        roughness: 0.8,
      }),
      brass: new THREE.MeshStandardMaterial({
        color: 0xdca746,
        metalness: 0.92,
        roughness: 0.24,
      }),
      wicker: new THREE.MeshStandardMaterial({
        map: makeWickerTexture(),
        roughness: 0.9,
        metalness: 0.01,
      }),
      wickerDark: new THREE.MeshStandardMaterial({
        color: 0x5f4128,
        roughness: 0.92,
      }),
      tireHighlight: new THREE.MeshStandardMaterial({
        color: 0x2c2c2d,
        roughness: 0.8,
      }),
      red: new THREE.MeshStandardMaterial({
        color: 0xc4412f,
        emissive: 0x8f1f13,
        emissiveIntensity: 0.25,
        roughness: 0.45,
      }),
      headlight: new THREE.MeshStandardMaterial({
        color: 0xffe8bb,
        emissive: 0xffb562,
        emissiveIntensity: 1.1,
        roughness: 0.22,
        metalness: 0.2,
      }),
      fishBlue: new THREE.MeshPhysicalMaterial({
        color: 0x7ea1a8,
        metalness: 0.55,
        roughness: 0.32,
        clearcoat: 0.6,
      }),
      fishBelly: new THREE.MeshStandardMaterial({
        color: 0xe8d7b8,
        metalness: 0.3,
        roughness: 0.45,
      }),
      black: new THREE.MeshStandardMaterial({
        color: 0x0a0b0c,
        roughness: 0.6,
      }),
      glass: new THREE.MeshPhysicalMaterial({
        color: 0xfff2cf,
        emissive: 0xffc178,
        emissiveIntensity: 0.4,
        roughness: 0.08,
        metalness: 0.1,
        transparent: true,
        opacity: 0.8,
      }),
    };

    this.materials.wicker.map.repeat.set(2, 1.2);
  }

  _buildWheels() {
    this.rearWheel = this._makeWheel();
    this.rearWheel.group.position.set(-0.82, 0.56, 0);
    this.frontWheel = this._makeWheel();
    this.frontWheel.group.position.set(0.82, 0.56, 0);
    this.group.add(this.rearWheel.group, this.frontWheel.group);

    this._addFender(this.rearWheel.group.position, -0.025);
    this._addFender(this.frontWheel.group.position, 0.1);
  }

  _makeWheel() {
    const group = new THREE.Group();
    const spinner = new THREE.Group();
    const tire = makeMesh(
      new THREE.TorusGeometry(0.496, 0.052, 9, 56),
      this.materials.rubber
    );
    const rim = makeMesh(
      new THREE.TorusGeometry(0.435, 0.014, 6, 56),
      this.materials.chrome
    );
    const rimInner = makeMesh(
      new THREE.TorusGeometry(0.407, 0.006, 4, 48),
      this.materials.cream
    );
    rimInner.castShadow = false;

    const positions = [];
    const spokeCount = 24;
    for (let i = 0; i < spokeCount; i++) {
      const angle = (i / spokeCount) * TAU;
      const inner = 0.03;
      const outer = 0.423;
      const wobble = i % 2 === 0 ? 0.028 : -0.028;
      positions.push(
        Math.cos(angle) * inner,
        Math.sin(angle) * inner,
        wobble,
        Math.cos(angle) * outer,
        Math.sin(angle) * outer,
        wobble * 0.45
      );
    }
    const spokeGeometry = new THREE.BufferGeometry();
    spokeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const spokes = new THREE.LineSegments(
      spokeGeometry,
      new THREE.LineBasicMaterial({
        color: 0xd9c7ae,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      })
    );
    spokes.castShadow = false;

    const hub = makeMesh(
      new THREE.CylinderGeometry(0.048, 0.048, 0.13, 12),
      this.materials.chrome
    );
    hub.rotation.x = Math.PI / 2;
    const hubCap = makeMesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.145, 8),
      this.materials.brass
    );
    hubCap.rotation.x = Math.PI / 2;

    spinner.add(tire, rim, rimInner, spokes, hub, hubCap);
    group.add(spinner);
    return { group, spinner };
  }

  _addFender(position, rotationZ) {
    const fender = makeMesh(
      new THREE.TorusGeometry(0.522, 0.026, 5, 36, Math.PI * 1.06),
      this.materials.cream
    );
    fender.position.copy(position);
    fender.position.y += 0.04;
    fender.rotation.z = rotationZ + 0.06;
    fender.castShadow = true;
    this.group.add(fender);

    const braceGeometry = new THREE.CylinderGeometry(0.005, 0.005, 0.44, 5);
    const braceA = makeMesh(braceGeometry, this.materials.chrome, false, false);
    braceA.position.set(position.x - 0.22, position.y + 0.22, position.z + 0.055);
    braceA.rotation.z = 0.9;
    const braceB = braceA.clone();
    braceB.position.x = position.x + 0.18;
    braceB.scale.z = -1;
    this.group.add(braceA, braceB);
  }

  _buildFrame() {
    const m = this.materials;
    const rearHub = new THREE.Vector3(-0.82, 0.56, 0);
    const bb = new THREE.Vector3(-0.08, 0.43, 0);
    const seatTop = new THREE.Vector3(-0.4, 1.12, 0);
    const headTop = new THREE.Vector3(0.62, 1.04, 0);
    const headBottom = new THREE.Vector3(0.71, 0.74, 0);
    const frontHub = new THREE.Vector3(0.82, 0.56, 0);

    this.framePoints = { rearHub, bb, seatTop, headTop, headBottom, frontHub };

    const mainFrame = new THREE.Group();
    mainFrame.name = 'frame';
    mainFrame.add(
      tubeBetween(bb, seatTop, 0.038, m.frame, 10, 0.042),
      tubeBetween(seatTop, headTop, 0.034, m.frame, 10, 0.039),
      tubeBetween(bb, headBottom, 0.048, m.frame, 10, 0.04),
      tubeBetween(headBottom, headTop, 0.054, m.frame, 10, 0.05)
    );

    for (const side of [-1, 1]) {
      const z = side * 0.062;
      const rHub = rearHub.clone().setZ(z);
      const b = bb.clone().setZ(z * 0.6);
      const s = seatTop.clone().setZ(z * 0.5);
      mainFrame.add(
        tubeBetween(rHub, b, 0.021, m.frameDeep, 7, 0.018),
        tubeBetween(rHub, s, 0.018, m.frame, 7, 0.022)
      );
    }

    // Fork: two slender blades down to the front axle.
    for (const side of [-1, 1]) {
      mainFrame.add(
        tubeBetween(
          headBottom.clone().setZ(side * 0.062),
          frontHub.clone().setZ(side * 0.073),
          0.021,
          m.chrome,
          8,
          0.015
        )
      );
    }
    mainFrame.add(tubeBetween(headTop, new THREE.Vector3(0.61, 1.17, 0), 0.022, m.chrome, 8));

    const seatPost = tubeBetween(seatTop, new THREE.Vector3(-0.44, 1.24, 0), 0.021, m.chrome, 8);
    mainFrame.add(seatPost);

    // Bolted joint details.
    const boltGeometry = new THREE.CylinderGeometry(0.024, 0.024, 0.08, 8);
    for (const point of [bb, seatTop, headTop]) {
      const bolt = makeMesh(boltGeometry, m.brass, true, false);
      bolt.rotation.x = Math.PI / 2;
      bolt.position.copy(point);
      mainFrame.add(bolt);
    }

    this.group.add(mainFrame);
  }

  _buildDrivetrain() {
    const m = this.materials;
    const bb = this.framePoints.bb;
    this.crankGroup = new THREE.Group();
    this.crankGroup.position.copy(bb);

    const chainring = makeMesh(new THREE.TorusGeometry(0.235, 0.016, 6, 40), m.chrome);
    chainring.position.z = -0.13;
    this.crankGroup.add(chainring);

    const gearTeeth = new THREE.Group();
    for (let i = 0; i < 24; i++) {
      const tooth = makeMesh(new THREE.BoxGeometry(0.035, 0.018, 0.022), m.chrome, false, false);
      const angle = (i / 24) * TAU;
      tooth.position.set(Math.cos(angle) * 0.252, Math.sin(angle) * 0.252, -0.13);
      tooth.rotation.z = angle;
      gearTeeth.add(tooth);
    }
    this.crankGroup.add(gearTeeth);

    this.crankArms = [];
    this.pedals = [];
    for (const side of [1, -1]) {
      const sideGroup = new THREE.Group();
      sideGroup.position.z = side * 0.17;
      if (side < 0) sideGroup.rotation.z = Math.PI;
      const arm = makeMesh(new THREE.BoxGeometry(0.038, 0.3, 0.026), m.darkMetal);
      arm.position.y = -0.15;
      sideGroup.add(arm);

      const armCap = makeMesh(new THREE.CylinderGeometry(0.036, 0.036, 0.04, 10), m.chrome);
      armCap.rotation.x = Math.PI / 2;
      armCap.position.z = side * 0.018;
      sideGroup.add(armCap);

      const pedalPivot = new THREE.Group();
      pedalPivot.position.y = -0.3;
      const pedal = new THREE.Group();
      const pedalBody = makeMesh(new THREE.BoxGeometry(0.155, 0.028, 0.1), m.darkMetal);
      const reflector = makeMesh(new THREE.BoxGeometry(0.055, 0.013, 0.012), m.red);
      reflector.position.set(0.018, 0.001, 0.055);
      const axle = makeMesh(new THREE.CylinderGeometry(0.008, 0.008, 0.13, 6), m.chrome, false, false);
      axle.rotation.z = Math.PI / 2;
      pedal.add(pedalBody, reflector, axle);
      pedal.userData.kind = 'pedal';
      pedalPivot.add(pedal);
      sideGroup.add(pedalPivot);
      this.crankGroup.add(sideGroup);
      this.crankArms.push(sideGroup);
      this.pedals.push({ group: pedalPivot, pedal, side });
    }

    this.group.add(this.crankGroup);

    const cog = makeMesh(new THREE.TorusGeometry(0.1, 0.015, 5, 28), m.darkMetal);
    cog.position.copy(this.framePoints.rearHub).setZ(-0.13);
    this.group.add(cog);

    const topChainA = new THREE.Vector3(bb.x, bb.y + 0.215, -0.13);
    const topChainB = new THREE.Vector3(this.framePoints.rearHub.x, this.framePoints.rearHub.y + 0.105, -0.13);
    const bottomChainA = new THREE.Vector3(bb.x, bb.y - 0.215, -0.13);
    const bottomChainB = new THREE.Vector3(this.framePoints.rearHub.x, this.framePoints.rearHub.y - 0.105, -0.13);
    const chainMaterial = new THREE.LineBasicMaterial({
      color: 0x86765f,
      transparent: true,
      opacity: 0.55,
    });
    const chainPoints = [];
    const linkCount = 46;
    const lerpPoint = (a, b, t) => new THREE.Vector3().lerpVectors(a, b, t);
    for (let i = 0; i < linkCount; i++) {
      const t = i / (linkCount - 1);
      const p = lerpPoint(topChainA, topChainB, t);
      chainPoints.push(p.x, p.y, p.z);
    }
    for (let i = 0; i < linkCount; i++) {
      const t = i / (linkCount - 1);
      const p = lerpPoint(bottomChainB, bottomChainA, t);
      chainPoints.push(p.x, p.y, p.z);
    }
    const chainGeometry = new THREE.BufferGeometry();
    chainGeometry.setAttribute('position', new THREE.Float32BufferAttribute(chainPoints, 3));
    const chain = new THREE.Line(chainGeometry, chainMaterial);
    this.group.add(chain);

    // Chain guard: a warm cream arc above the top chain.
    const guard = makeMesh(
      new THREE.TorusGeometry(0.275, 0.013, 4, 24, Math.PI * 0.65),
      m.cream
    );
    guard.position.copy(bb).setZ(-0.155);
    guard.rotation.z = Math.PI * 0.27;
    this.group.add(guard);
  }

  _buildSaddle() {
    const m = this.materials;
    const saddle = new THREE.Group();
    saddle.position.set(-0.41, 1.26, 0);

    const saddleBase = makeMesh(new THREE.SphereGeometry(1, 24, 14), m.leather);
    saddleBase.scale.set(0.19, 0.055, 0.17);
    saddleBase.rotation.z = -0.06;
    const nose = makeMesh(new THREE.SphereGeometry(1, 18, 10), m.leather);
    nose.scale.set(0.12, 0.045, 0.075);
    nose.position.set(0.17, 0.005, 0);
    const seam = makeMesh(
      new THREE.TorusGeometry(0.145, 0.004, 4, 26),
      m.leatherDark,
      false,
      false
    );
    seam.scale.set(1.22, 0.55, 1);
    seam.rotation.x = Math.PI / 2;
    seam.position.y = 0.034;
    saddle.add(saddleBase, nose, seam);

    const springMaterial = m.chrome;
    for (const z of [-0.09, 0.09]) {
      const spring = makeMesh(new THREE.TorusGeometry(0.024, 0.005, 4, 16), springMaterial, false, false);
      spring.rotation.x = Math.PI / 2;
      spring.position.set(-0.09, -0.065, z);
      saddle.add(spring);
    }
    this.group.add(saddle);
    this.saddle = saddle;
  }

  _buildHandlebars() {
    const m = this.materials;
    const pivot = this.framePoints.headTop;
    this.handleGroup = new THREE.Group();
    this.handleGroup.position.copy(pivot);

    const stem = tubeBetween(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-0.01, 0.15, 0),
      0.019,
      m.chrome,
      7
    );
    this.handleGroup.add(stem);

    const barPoints = [
      new THREE.Vector3(-0.15, 0.14, 0.335),
      new THREE.Vector3(-0.08, 0.17, 0.24),
      new THREE.Vector3(0.015, 0.19, 0.1),
      new THREE.Vector3(0.03, 0.2, 0),
      new THREE.Vector3(0.015, 0.19, -0.1),
      new THREE.Vector3(-0.08, 0.17, -0.24),
      new THREE.Vector3(-0.15, 0.14, -0.335),
    ];
    const barCurve = new THREE.CatmullRomCurve3(barPoints);
    const bar = makeMesh(
      new THREE.TubeGeometry(barCurve, 34, 0.017, 7, false),
      m.chrome
    );
    this.handleGroup.add(bar);

    this.gripTargets = [];
    for (const side of [-1, 1]) {
      const grip = makeMesh(
        new THREE.CylinderGeometry(0.031, 0.031, 0.115, 10),
        m.leatherDark
      );
      grip.rotation.z = Math.PI / 2;
      grip.rotation.y = 0.42 * side;
      grip.position.set(-0.14, 0.14, side * 0.3);
      this.handleGroup.add(grip);

      const collar = makeMesh(new THREE.TorusGeometry(0.034, 0.008, 5, 16), m.chrome, false, false);
      collar.rotation.x = Math.PI / 2;
      collar.rotation.z = Math.PI / 2;
      collar.position.set(-0.14, 0.14, side * 0.247);
      this.handleGroup.add(collar);

      const lever = tubeBetween(
        new THREE.Vector3(-0.1, 0.11, side * 0.25),
        new THREE.Vector3(-0.19, 0.06, side * 0.27),
        0.006,
        m.chrome,
        5
      );
      this.handleGroup.add(lever);

      const target = new THREE.Object3D();
      target.position.set(-0.145, 0.14, side * 0.31);
      this.handleGroup.add(target);
      this.gripTargets.push({ side, target });
    }

    // Brass bell.
    this.bell = new THREE.Group();
    this.bell.position.set(0.018, 0.235, 0.105);
    const bellDome = makeMesh(
      new THREE.SphereGeometry(0.04, 16, 10, 0, TAU, 0, Math.PI / 2),
      this.materials.brass
    );
    bellDome.scale.y = 0.82;
    const bellBase = makeMesh(
      new THREE.CylinderGeometry(0.041, 0.043, 0.012, 16),
      this.materials.brass
    );
    bellBase.position.y = -0.017;
    const bellLever = makeMesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.032, 6),
      this.materials.chrome,
      false,
      false
    );
    bellLever.rotation.z = Math.PI / 2;
    bellLever.position.set(-0.055, 0.006, 0);
    this.bell.add(bellDome, bellBase, bellLever);
    this.handleGroup.add(this.bell);

    this.bellRing = makeMesh(
      new THREE.RingGeometry(0.05, 0.052, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffd08a,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      false,
      false
    );
    this.bellRing.rotation.x = -Math.PI / 2;
    this.bellRing.position.y = 0.012;
    this.bell.add(this.bellRing);

    // A little brass headlight fixed to the frame, under the bars.
    this.group.add(this.handleGroup);
  }

  _buildBasket() {
    const m = this.materials;
    const basket = new THREE.Group();
    basket.position.set(0.98, 1.02, 0);
    const width = 0.48;
    const depth = 0.43;
    const height = 0.31;

    const floor = makeMesh(new THREE.BoxGeometry(width, 0.018, depth), m.wickerDark);
    floor.position.y = -height / 2;
    const frontWall = makeMesh(new THREE.BoxGeometry(0.025, height, depth), m.wicker);
    frontWall.position.x = width / 2;
    const backWall = frontWall.clone();
    backWall.position.x = -width / 2;
    const sideWall = makeMesh(new THREE.BoxGeometry(width, height, 0.023), m.wicker);
    sideWall.position.z = depth / 2;
    const sideWall2 = sideWall.clone();
    sideWall2.position.z = -depth / 2;
    const rim = new THREE.Group();
    for (const [x, z, w, d] of [
      [0, depth / 2, width + 0.03, 0.035],
      [0, -depth / 2, width + 0.03, 0.035],
      [width / 2, 0, 0.035, depth + 0.02],
      [-width / 2, 0, 0.035, depth + 0.02],
    ]) {
      const stick = makeMesh(new THREE.BoxGeometry(w, 0.028, d), m.wickerDark);
      stick.position.set(x, height / 2, z);
      rim.add(stick);
    }
    for (const x of [-0.13, 0.03, 0.15]) {
      const strap = makeMesh(new THREE.BoxGeometry(0.014, height + 0.02, depth + 0.008), m.wickerDark, false, false);
      strap.position.set(x, 0, 0);
      basket.add(strap);
    }

    basket.add(floor, frontWall, backWall, sideWall, sideWall2, rim);

    // Two small fish, one very much still alive.
    this.fishGroup = new THREE.Group();
    const fish = this._makeFish(0x7aa4ac);
    fish.position.set(-0.04, 0.09, -0.055);
    fish.rotation.set(0.25, -0.7, -0.28);
    this.fishGroup.add(fish);
    this.fishTail = fish.userData.tail;
    this.fishBody = fish;

    const smallFish = this._makeFish(0xc68163);
    smallFish.scale.setScalar(0.72);
    smallFish.position.set(0.1, 0.02, 0.075);
    smallFish.rotation.set(-0.1, 0.8, 0.4);
    this.fishGroup.add(smallFish);

    basket.add(this.fishGroup);

    const handleCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.22, height / 2, 0),
      new THREE.Vector3(0, height / 2 + 0.23, 0),
      new THREE.Vector3(0.22, height / 2, 0)
    );
    const handle = makeMesh(new THREE.TubeGeometry(handleCurve, 18, 0.012, 5, false), m.wickerDark);
    basket.add(handle);
    this.group.add(basket);
    this.basket = basket;
  }

  _makeFish(color) {
    const group = new THREE.Group();
    const bodyMaterial = this.materials.fishBlue.clone();
    bodyMaterial.color.setHex(color);
    const body = makeMesh(new THREE.SphereGeometry(1, 16, 10), bodyMaterial);
    body.scale.set(0.16, 0.065, 0.055);
    const belly = makeMesh(new THREE.SphereGeometry(1, 12, 8), this.materials.fishBelly);
    belly.scale.set(0.13, 0.028, 0.045);
    belly.position.set(-0.01, -0.034, 0);
    const eye = makeMesh(new THREE.SphereGeometry(0.012, 8, 6), this.materials.black);
    eye.position.set(0.12, 0.018, 0.045);
    const tail = new THREE.Group();
    tail.position.x = -0.15;
    const tailTop = makeMesh(new THREE.ConeGeometry(0.045, 0.13, 3), bodyMaterial);
    tailTop.rotation.z = Math.PI / 2;
    tailTop.position.set(-0.05, 0.02, 0);
    tailTop.scale.z = 0.32;
    const tailBottom = tailTop.clone();
    tailBottom.rotation.z = Math.PI / 2;
    tailBottom.position.y = -0.045;
    tailBottom.rotation.x = Math.PI;
    tail.add(tailTop, tailBottom);
    const fin = makeMesh(new THREE.ConeGeometry(0.04, 0.09, 3), bodyMaterial);
    fin.rotation.z = -Math.PI / 2;
    fin.position.set(-0.02, 0.06, 0);
    fin.scale.z = 0.25;
    group.add(body, belly, eye, tail, fin);
    group.userData.tail = tail;
    group.traverse((child) => {
      child.castShadow = true;
      child.receiveShadow = true;
    });
    return group;
  }

  _buildLights() {
    const m = this.materials;
    const lamp = new THREE.Group();
    lamp.position.set(1.28, 1.02, 0);
    const housing = makeMesh(new THREE.CylinderGeometry(0.068, 0.052, 0.12, 12), m.chrome);
    housing.rotation.z = -Math.PI / 2;
    const bezel = makeMesh(new THREE.TorusGeometry(0.062, 0.012, 5, 18), m.brass);
    bezel.rotation.y = Math.PI / 2;
    bezel.position.x = 0.06;
    const lens = makeMesh(new THREE.CircleGeometry(0.052, 20), m.glass);
    lens.rotation.y = Math.PI / 2;
    lens.position.x = 0.062;
    lamp.add(housing, bezel, lens);
    this.headlightLens = lens;

    const spot = new THREE.SpotLight(0xffc985, 0, 22, 0.35, 0.8, 1.3);
    spot.position.set(0.09, 0, 0);
    this.headlightTarget = new THREE.Object3D();
    this.headlightTarget.position.set(9, -0.9, 0);
    spot.target = this.headlightTarget;
    lamp.add(spot, this.headlightTarget);
    this.headlightSpot = spot;

    const glowTexture = makeGlowTexture('rgba(255,213,151,1)', 0.08);
    this.headlightGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0xffd9a1,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
    );
    this.headlightGlow.scale.setScalar(0.5);
    this.headlightGlow.position.set(0.11, 0, 0);
    lamp.add(this.headlightGlow);

    this.group.add(lamp);
    this.headlight = lamp;

    const rearLightMaterial = new THREE.MeshStandardMaterial({
      color: 0x7d1e16,
      emissive: 0xff3b1f,
      emissiveIntensity: 0.3,
      roughness: 0.4,
    });
    const rear = makeMesh(new THREE.SphereGeometry(0.035, 12, 8), rearLightMaterial);
    rear.scale.set(0.7, 1, 0.65);
    rear.position.set(-0.86, 0.63, 0);
    rear.userData.kind = 'tail-light';
    this.group.add(rear);
    this.tailLight = rear;
    this.tailLightMaterial = rearLightMaterial;

    const rearGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0xff5334,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
      })
    );
    rearGlow.scale.setScalar(0.34);
    rearGlow.position.set(-0.88, 0.64, 0);
    this.group.add(rearGlow);
    this.tailGlow = rearGlow;
  }

  _buildContactShadow() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(128, 64, 8, 128, 64, 124);
    gradient.addColorStop(0, 'rgba(7,18,17,.55)');
    gradient.addColorStop(0.5, 'rgba(7,18,17,.24)');
    gradient.addColorStop(1, 'rgba(7,18,17,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 128);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.25),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        blending: THREE.NormalBlending,
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(-0.02, 0.008, 0);
    shadow.renderOrder = 2;
    this.group.add(shadow);
    this.contactShadow = shadow;
  }

  _buildDetails() {
    const m = this.materials;

    // Cream mudguard tips and rear plate.
    const plateTexture = makeBadgeTexture('PELI');
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.19, 0.095),
      new THREE.MeshBasicMaterial({ map: plateTexture, side: THREE.DoubleSide })
    );
    plate.position.set(-0.92, 0.79, 0.035);
    plate.rotation.y = 0.08;
    this.group.add(plate);

    // Spokes / frame pump / small brass details.
    const pump = makeMesh(new THREE.CylinderGeometry(0.014, 0.014, 0.54, 7), m.cream);
    pump.position.set(-0.3, 0.88, 0.063);
    pump.rotation.z = -0.54;
    this.group.add(pump);

    const headBadge = makeMesh(new THREE.CylinderGeometry(0.055, 0.055, 0.012, 20), m.brass);
    headBadge.rotation.x = Math.PI / 2;
    headBadge.position.set(0.66, 0.89, 0.001);
    this.group.add(headBadge);

    // Tiny fender ornaments.
    for (const x of [-0.82, 0.82]) {
      const ornament = makeMesh(new THREE.SphereGeometry(0.018, 8, 6), m.brass, false, false);
      ornament.position.set(x + (x > 0 ? 0.18 : -0.18), 0.598, 0);
      this.group.add(ornament);
    }

    // Gentle warmth from the rear reflector when the sun drops.
    this.group.traverse((child) => {
      if (child.isMesh && child.material === this.materials.wicker) {
        child.receiveShadow = true;
      }
    });
  }

  getGripPosition(sideSign, target = new THREE.Vector3()) {
    if (!this.gripTargets) return target.set(0.45, 1.15, sideSign * 0.31);
    const entry = this.gripTargets.find((g) => Math.sign(g.side) === Math.sign(sideSign)) || this.gripTargets[0];
    entry.target.getWorldPosition(target);
    this.group.worldToLocal(target);
    return target;
  }

  getPedalPosition(index, target = new THREE.Vector3()) {
    const pedal = this.pedals[index % this.pedals.length];
    pedal.pedal.getWorldPosition(target);
    this.group.worldToLocal(target);
    return target;
  }

  ringBell() {
    this.bellPulse = 1;
    this.bellWave = 0;
  }

  setNight(factor) {
    const brightness = clamp(factor, 0, 1);
    if (this.headlightSpot) this.headlightSpot.intensity = brightness * 34;
    if (this.headlightGlow) this.headlightGlow.material.opacity = brightness * 0.38;
    if (this.tailGlow) this.tailGlow.material.opacity = 0.08 + brightness * 0.4;
    if (this.tailLightMaterial) this.tailLightMaterial.emissiveIntensity = 0.25 + brightness * 2.4;
    if (this.materials.headlight) this.materials.headlight.emissiveIntensity = 0.25 + brightness * 2.8;
    this.nightFactor = brightness;
  }

  update(dt, time, state = {}) {
    this.time = time;
    const speed = Math.max(0, state.speed ?? 0);
    const wheelRate = speed / 0.5;
    this.wheelAngle -= wheelRate * dt;
    this.rearWheel.spinner.rotation.z = this.wheelAngle;
    this.frontWheel.spinner.rotation.z = this.wheelAngle;

    const cadence = clamp(52 + speed * 4.5, 42, 108);
    const crankRate = speed > 0.06 ? (cadence / 60) * TAU : 0;
    this.crankAngle -= crankRate * dt;
    if (this.crankGroup) this.crankGroup.rotation.z = this.crankAngle;

    for (const crank of this.crankArms) {
      // The pedal platforms remain level while the arms turn.
      const index = this.crankArms.indexOf(crank);
      const pedalPivot = this.pedals[index].group;
      pedalPivot.rotation.z = -(this.crankAngle + (crank.rotation.z || 0));
    }

    this.steerAngle = damp(this.steerAngle, (state.steer ?? 0) * 0.17, 7, dt);
    if (this.handleGroup) this.handleGroup.rotation.y = this.steerAngle;
    if (this.handleGroup) this.handleGroup.rotation.z = damp(this.handleGroup.rotation.z, (state.leanInput ?? 0) * 0.02, 5, dt);
    if (this.group) this.group.updateMatrixWorld(true);

    if (this.bellPulse > 0) {
      this.bellPulse = Math.max(0, this.bellPulse - dt * 1.35);
      this.bellWave = (this.bellWave || 0) + dt;
      const wave = 1 - this.bellPulse;
      if (this.bellRing) {
        this.bellRing.material.opacity = this.bellPulse * 0.55;
        this.bellRing.scale.setScalar(0.35 + wave * 3.2);
        this.bellRing.position.y = 0.015 - wave * 0.03;
      }
      if (this.bell) this.bell.rotation.z = Math.sin(time * 42) * this.bellPulse * 0.08;
    } else if (this.bellRing) {
      this.bellRing.material.opacity = 0;
      if (this.bell) this.bell.rotation.z = damp(this.bell.rotation.z, 0, 6, dt);
    }

    if (this.fishGroup) {
      this.fishWiggle += dt * (2.2 + speed * 0.15);
      this.fishGroup.rotation.y = Math.sin(this.fishWiggle * 0.7) * 0.08;
      if (this.fishTail) {
        this.fishTail.rotation.y = Math.sin(this.fishWiggle * 2.6) * 0.3;
        this.fishTail.rotation.z = Math.sin(this.fishWiggle * 1.8 + 0.4) * 0.12;
      }
      if (this.fishBody) {
        this.fishBody.rotation.z = -0.28 + Math.sin(this.fishWiggle * 1.4) * 0.08;
      }
    }

    const braking = state.braking ? 1 : 0;
    this.braking = damp(this.braking, braking, 8, dt);
    if (this.tailLightMaterial) {
      this.tailLightMaterial.emissiveIntensity = 0.18 + this.braking * 1.7 + (this.nightFactor || 0) * 1.4;
    }
    if (this.contactShadow) {
      this.contactShadow.material.opacity = state.airborne ? 0.2 : 0.8;
      const scale = state.airborne ? 1.2 : 1;
      this.contactShadow.scale.set(scale, scale, scale);
    }
  }
}
