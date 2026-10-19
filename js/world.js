import * as THREE from 'three';
import {
  WALK_Y,
  WALK_WIDTH,
  boardwalkCurve,
  distanceToPath,
  getPathFrame,
  pathLength,
} from './path.js';
import {
  TAU,
  clamp,
  createSkyEnvironment,
  damp,
  lerp,
  makeGlowTexture,
  makePointTexture,
  makeSandTexture,
  makeSignTexture,
  makeWoodTexture,
  mulberry32,
  randomRange,
  smootherstep,
  smoothstep,
} from './utils.js';

const UP = new THREE.Vector3(0, 1, 0);
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _c1 = new THREE.Color();
const _c2 = new THREE.Color();
const _q1 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4();
const _e1 = new THREE.Euler();

const ATMO_KEYS = [
  {
    h: 0,
    elevation: -0.66,
    azimuth: 2.2,
    zenith: 0x030812,
    horizon: 0x111b2c,
    sun: 0x92a8dd,
    cloudLit: 0x273854,
    cloudShadow: 0x070c16,
    fog: 0x0b1623,
    waterDeep: 0x020811,
    waterShallow: 0x0a2633,
    hemiSky: 0x263752,
    hemiGround: 0x070a0e,
    sunI: 0.0,
    hemiI: 0.42,
    exposure: 0.96,
    night: 1.0,
    stars: 1.0,
    lamp: 1.0,
    env: 0.24,
    fogDensity: 0.0032,
  },
  {
    h: 4.8,
    elevation: -0.3,
    azimuth: 2.55,
    zenith: 0x071329,
    horizon: 0x263147,
    sun: 0xb98d95,
    cloudLit: 0x53445c,
    cloudShadow: 0x101827,
    fog: 0x1b293b,
    waterDeep: 0x03101b,
    waterShallow: 0x0b2c38,
    hemiSky: 0x30445d,
    hemiGround: 0x10161a,
    sunI: 0.05,
    hemiI: 0.52,
    exposure: 1.0,
    night: 0.8,
    stars: 0.55,
    lamp: 0.85,
    env: 0.3,
    fogDensity: 0.003,
  },
  {
    h: 6.3,
    elevation: 0.025,
    azimuth: 2.78,
    zenith: 0x365c80,
    horizon: 0xf2b58e,
    sun: 0xffb87a,
    cloudLit: 0xffc4a1,
    cloudShadow: 0x5f5065,
    fog: 0xcba790,
    waterDeep: 0x062932,
    waterShallow: 0x1d5560,
    hemiSky: 0xd1b2a7,
    hemiGround: 0x3b3735,
    sunI: 0.7,
    hemiI: 0.8,
    exposure: 1.05,
    night: 0.17,
    stars: 0.03,
    lamp: 0.2,
    env: 0.6,
    fogDensity: 0.0028,
  },
  {
    h: 8.2,
    elevation: 0.39,
    azimuth: 3.16,
    zenith: 0x4b83ae,
    horizon: 0xe3d0ae,
    sun: 0xfff0cc,
    cloudLit: 0xffedd8,
    cloudShadow: 0x8a8b97,
    fog: 0xd4c5a9,
    waterDeep: 0x08333c,
    waterShallow: 0x237581,
    hemiSky: 0xbfdce8,
    hemiGround: 0x786651,
    sunI: 2.2,
    hemiI: 1.05,
    exposure: 1.06,
    night: 0.0,
    stars: 0.0,
    lamp: 0.0,
    env: 0.65,
    fogDensity: 0.0026,
  },
  {
    h: 12.2,
    elevation: 1.0,
    azimuth: 4.18,
    zenith: 0x2b76ae,
    horizon: 0xd5d7c9,
    sun: 0xfff8df,
    cloudLit: 0xfff9ea,
    cloudShadow: 0x999ba1,
    fog: 0xd0cbbd,
    waterDeep: 0x0a353e,
    waterShallow: 0x2b7f8d,
    hemiSky: 0xc9e3ec,
    hemiGround: 0x8a735d,
    sunI: 3.4,
    hemiI: 0.55,
    exposure: 1.0,
    night: 0.0,
    stars: 0.0,
    lamp: 0.0,
    env: 0.7,
    fogDensity: 0.0021,
  },
  {
    h: 16.4,
    elevation: 0.54,
    azimuth: 4.72,
    zenith: 0x3c6e98,
    horizon: 0xf3c18d,
    sun: 0xffd092,
    cloudLit: 0xffdcb6,
    cloudShadow: 0x83727e,
    fog: 0xb38d7d,
    waterDeep: 0x06262f,
    waterShallow: 0x175660,
    hemiSky: 0x9bb0bc,
    hemiGround: 0x5b4335,
    sunI: 3.0,
    hemiI: 0.6,
    exposure: 1.0,
    night: 0.0,
    stars: 0.0,
    lamp: 0.0,
    env: 0.6,
    fogDensity: 0.002,
  },
  {
    h: 18.6,
    elevation: 0.09,
    azimuth: 5.08,
    zenith: 0x1b4768,
    horizon: 0xf59a5c,
    sun: 0xffb66e,
    cloudLit: 0xd38f80,
    cloudShadow: 0x37345a,
    fog: 0x8c7d7e,
    waterDeep: 0x021a22,
    waterShallow: 0x0b414c,
    hemiSky: 0x7f9bb0,
    hemiGround: 0x3e2f29,
    sunI: 3.35,
    hemiI: 0.52,
    exposure: 1.05,
    night: 0.0,
    stars: 0.0,
    lamp: 0.05,
    env: 0.6,
    fogDensity: 0.0018,
  },
  {
    h: 19.5,
    elevation: 0.005,
    azimuth: 5.18,
    zenith: 0x152b44,
    horizon: 0xc95d4f,
    sun: 0xff9a5c,
    cloudLit: 0xff9f78,
    cloudShadow: 0x3a2f48,
    fog: 0x80636b,
    waterDeep: 0x02141b,
    waterShallow: 0x08313b,
    hemiSky: 0x6f8599,
    hemiGround: 0x2a2326,
    sunI: 0.38,
    hemiI: 0.46,
    exposure: 1.01,
    night: 0.12,
    stars: 0.12,
    lamp: 0.45,
    env: 0.48,
    fogDensity: 0.0028,
  },
  {
    h: 20.5,
    elevation: -0.17,
    azimuth: 5.33,
    zenith: 0x101a32,
    horizon: 0x68546c,
    sun: 0xd98579,
    cloudLit: 0x875d6a,
    cloudShadow: 0x211e36,
    fog: 0x46505f,
    waterDeep: 0x020c15,
    waterShallow: 0x092431,
    hemiSky: 0x4c5872,
    hemiGround: 0x121319,
    sunI: 0.04,
    hemiI: 0.62,
    exposure: 1.06,
    night: 0.62,
    stars: 0.45,
    lamp: 0.88,
    env: 0.36,
    fogDensity: 0.003,
  },
  {
    h: 22.2,
    elevation: -0.48,
    azimuth: 5.62,
    zenith: 0x050a16,
    horizon: 0x151e30,
    sun: 0x8ba2d6,
    cloudLit: 0x2a3a55,
    cloudShadow: 0x070c15,
    fog: 0x0c1725,
    waterDeep: 0x020710,
    waterShallow: 0x092431,
    hemiSky: 0x223450,
    hemiGround: 0x060a0e,
    sunI: 0,
    hemiI: 0.45,
    exposure: 0.98,
    night: 0.96,
    stars: 1.0,
    lamp: 1.0,
    env: 0.26,
    fogDensity: 0.0032,
  },
  {
    h: 24,
    elevation: -0.66,
    azimuth: 2.2 + TAU,
    zenith: 0x030812,
    horizon: 0x111b2c,
    sun: 0x92a8dd,
    cloudLit: 0x273854,
    cloudShadow: 0x070c16,
    fog: 0x0b1623,
    waterDeep: 0x020811,
    waterShallow: 0x0a2633,
    hemiSky: 0x263752,
    hemiGround: 0x070a0e,
    sunI: 0.0,
    hemiI: 0.42,
    exposure: 0.96,
    night: 1.0,
    stars: 1.0,
    lamp: 1.0,
    env: 0.24,
    fogDensity: 0.0032,
  },
];

const COLOR_FIELDS = ['zenith', 'horizon', 'sun', 'cloudLit', 'cloudShadow', 'fog', 'waterDeep', 'waterShallow', 'hemiSky', 'hemiGround'];
const NUMBER_FIELDS = ['elevation', 'azimuth', 'sunI', 'hemiI', 'exposure', 'night', 'stars', 'lamp', 'env', 'fogDensity'];

function makeAtmosphereTarget() {
  const colors = {};
  for (const field of COLOR_FIELDS) colors[field] = new THREE.Color(0x000000);
  const target = { ...colors };
  for (const field of NUMBER_FIELDS) target[field] = 0;
  return target;
}

function sampleAtmosphere(hour, target) {
  const h = ((hour % 24) + 24) % 24;
  let a = ATMO_KEYS[0];
  let b = ATMO_KEYS[ATMO_KEYS.length - 1];
  for (let i = 0; i < ATMO_KEYS.length - 1; i++) {
    if (h >= ATMO_KEYS[i].h && h <= ATMO_KEYS[i + 1].h) {
      a = ATMO_KEYS[i];
      b = ATMO_KEYS[i + 1];
      break;
    }
  }
  const span = Math.max(0.0001, b.h - a.h);
  const t = smootherstep(0, 1, clamp((h - a.h) / span, 0, 1));
  for (const field of COLOR_FIELDS) {
    target[field].setHex(a[field]).lerp(_sampleColor.setHex(b[field]), t);
  }
  for (const field of NUMBER_FIELDS) target[field] = lerp(a[field], b[field], t);
  return target;
}

const _sampleColor = new THREE.Color();

export function islandHeight(x, z) {
  const r = Math.hypot(x, z);
  const shelf = 1 - smoothstep(19.5, 28.5, r);
  let h = -3.0 + shelf * 3.1;
  h += 2.85 * Math.exp(-(r * r) / 118);
  h += 0.58 * Math.exp(-(((x - 6.5) ** 2 + (z + 5.5) ** 2)) / 58);
  h += 0.28 * Math.sin(x * 0.43 + 0.8) * Math.cos(z * 0.37 - 0.4) * shelf;
  h += 0.16 * Math.sin(x * 1.2 + z * 0.8 + 2.1) * shelf;
  h += 0.055 * Math.sin(x * 3.1 - z * 2.6) * shelf;
  return h;
}

function hash2(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function noise2(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uz);
}

const SKY_VERTEX = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uSunColor;
  uniform vec3 uCloudLit;
  uniform vec3 uCloudShadow;
  uniform vec3 uSunDir;
  uniform vec3 uMoonDir;
  uniform float uTime;
  uniform float uNight;
  uniform float uStars;

  varying vec3 vDirection;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(p);
      p = p * 2.03 + vec2(13.7, 7.3);
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec3 dir = normalize(vDirection);
    float h = dir.y;
    float skyH = smoothstep(-0.015, 0.31, h);
    vec3 color = mix(uHorizon, uZenith, skyH);

    // A soft band of sea haze on the horizon.
    float haze = exp(-max(h, 0.0) * 11.0);
    color = mix(color, uHorizon * 1.08, haze * 0.4);

    // Warm atmospheric scattering around the sun.
    float sunDot = max(dot(dir, uSunDir), 0.0);
    color += uSunColor * pow(sunDot, 8.0) * 0.045;
    color += uSunColor * pow(sunDot, 34.0) * 0.16;
    color += uSunColor * pow(sunDot, 180.0) * 0.72;
    float discRim = smoothstep(0.9991, 0.9996, sunDot);
    float disc = smoothstep(0.99956, 0.99982, sunDot);
    color += uSunColor * discRim * 0.2;
    color += uSunColor * disc * 1.65;

    // The moon, only at night.
    float moonDot = max(dot(dir, uMoonDir), 0.0);
    float moon = smoothstep(0.99955, 0.99983, moonDot);
    vec3 moonSurface = vec3(0.82, 0.87, 1.0) * (0.9 + 0.1 * noise(dir.xy * 280.0));
    color = mix(color, moonSurface * 1.55, moon * uNight * 0.88);
    color += vec3(0.22, 0.31, 0.54) * pow(moonDot, 65.0) * 0.18 * uNight;

    // Stars: a quiet field, not a screensaver.
    vec3 starCell = floor(dir * 245.0);
    vec3 starFract = fract(dir * 245.0) - 0.5;
    float starSeed = hash21(starCell.xy + starCell.z * 17.31);
    float star = smoothstep(0.13, 0.0, length(starFract)) * smoothstep(0.978, 1.0, starSeed);
    float twinkle = 0.7 + 0.3 * sin(uTime * 1.7 + starSeed * 38.0);
    color += vec3(0.78, 0.86, 1.0) * star * uStars * 1.55 * twinkle * smoothstep(-0.03, 0.18, h);

    // Two layers of wind-combed clouds.
    if (h > -0.01) {
      vec2 p = dir.xz / (max(h, 0.0) + 0.2);
      vec2 drift = vec2(uTime * 0.0038, uTime * 0.0009);
      float low = fbm(p * 0.85 + drift + vec2(2.1, -1.3));
      float warp = fbm(p * 1.65 + low * 1.4 + drift * 1.6);
      float detail = fbm(p * 3.4 - warp * 1.2 + vec2(4.7, 1.9));
      float mask = smoothstep(0.63, 0.8, warp * 0.7 + detail * 0.36);
      float heightMask = smoothstep(0.006, 0.065, h) * (1.0 - smoothstep(0.3, 0.6, h));
      mask *= heightMask;

      float streakMask = smoothstep(0.55, 0.73, fbm(p * vec2(0.6, 3.6) + drift * 2.0 + 22.0));
      streakMask *= smoothstep(0.018, 0.06, h) * (1.0 - smoothstep(0.13, 0.24, h)) * 0.09;

      float lit = pow(sunDot, 3.5);
      vec3 cloudColor = mix(uCloudShadow, uCloudLit, 0.16 + lit * 0.84);
      cloudColor *= 0.86 + detail * 0.28;
      color = mix(color, cloudColor, clamp(mask * 0.42 + streakMask * 0.72, 0.0, 0.58));
    }

    // Slight dither to keep the huge gradients clean.
    color += (hash21(gl_FragCoord.xy) - 0.5) * 0.005;

    gl_FragColor = vec4(color, 1.0);
  }
`;

const OCEAN_VERTEX = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying float vWave;
  varying float vDistance;

  float waveHeight(vec2 p) {
    float w = 0.0;
    w += sin(p.x * 0.23 + uTime * 0.82) * 0.055;
    w += sin(p.y * 0.31 - uTime * 1.03) * 0.04;
    w += sin((p.x + p.y) * 0.17 + uTime * 0.57) * 0.026;
    w += sin(length(p) * 0.62 - uTime * 1.7) * 0.014;
    return w;
  }

  void main() {
    vec3 p = position;
    float h = waveHeight(p.xy);
    p.z += h;
    float e = 0.45;
    float hx = waveHeight(p.xy + vec2(e, 0.0));
    float hy = waveHeight(p.xy + vec2(0.0, e));
    vec3 n = normalize(vec3(-(hx - h) / e, -(hy - h) / e, 1.0));
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * n);
    vWave = h;
    vDistance = length(world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const OCEAN_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uZenithColor;
  uniform vec3 uSunColor;
  uniform vec3 uFogColor;
  uniform vec3 uSunDir;
  uniform float uTime;
  uniform float uNight;
  uniform float uFogDensity;

  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying float vWave;
  varying float vDistance;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vec3 V = normalize(cameraPosition - vWorld);
    vec3 N = normalize(vNormalW);
    N.x += sin(vWorld.x * 3.7 + vWorld.z * 1.4 + uTime * 2.0) * 0.009;
    N.z += cos(vWorld.z * 4.6 - vWorld.x * 1.9 - uTime * 1.6) * 0.009;
    N = normalize(N);

    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 4.5);
    fresnel = mix(0.02, 1.0, fresnel);

    vec3 R = reflect(-V, N);
    float sunSpec = pow(max(dot(R, uSunDir), 0.0), 420.0);
    float sunGlitter = pow(max(dot(R, uSunDir), 0.0), 52.0);
    float glintNoise = noise(vWorld.xz * 2.6 + vec2(uTime * 0.18, -uTime * 0.12));
    float glint = smoothstep(0.78, 0.96, glintNoise) * sunGlitter * 0.22;

    vec3 color = mix(uDeepColor, uShallowColor, 0.44 + max(dot(N, V), 0.0) * 0.18);
    vec3 reflectedSky = mix(uHorizonColor * 0.76, uZenithColor, 0.48);
    color = mix(color, reflectedSky * 0.88, clamp(fresnel * 0.58, 0.0, 0.55));
    color += uSunColor * (sunSpec * 1.35 + sunGlitter * 0.035 + glint);

    // A slow dark swell under the surface.
    color *= 0.94 + smoothstep(-0.12, 0.14, vWave) * 0.08;

    // A thin, broken line of foam along the island shore.
    float r = length(vWorld.xz);
    float shoreMask = smoothstep(19.0, 20.7, r) * (1.0 - smoothstep(20.7, 23.0, r));
    float foamNoise = noise(vWorld.xz * 0.72 + uTime * 0.08) * 0.72
                    + noise(vWorld.xz * 2.9 - uTime * 0.24) * 0.28;
    float foamLine = sin(r * 5.2 - uTime * 1.1 + atan(vWorld.z, vWorld.x) * 6.0) * 0.5 + 0.5;
    float foam = shoreMask * smoothstep(0.64, 0.87, foamLine * 0.55 + foamNoise * 0.6) * 0.6;
    color = mix(color, vec3(0.80, 0.77, 0.68), foam * 0.8);

    // Very calm sea: only a whisper of white on the highest crests.
    float crest = smoothstep(0.155, 0.19, vWave + noise(vWorld.xz * 0.5 + uTime * 0.12) * 0.1);
    color = mix(color, vec3(0.76, 0.78, 0.72), crest * 0.045);

    float dist = length(cameraPosition - vWorld);
    float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
    fog = clamp(fog, 0.0, 1.0);
    color = mix(color, uFogColor, fog);

    gl_FragColor = vec4(color, 1.0);
  }
`;

const BEAM_VERTEX = /* glsl */ `
  varying float vAlong;
  void main() {
    vAlong = clamp(position.x / 28.0, 0.0, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BEAM_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  varying float vAlong;
  void main() {
    float alpha = smoothstep(0.0, 0.045, vAlong) * pow(1.0 - vAlong, 1.6) * 0.18 * uOpacity;
    gl_FragColor = vec4(vec3(1.0, 0.72, 0.38) * alpha, alpha);
  }
`;

export class World {
  constructor(scene, renderer, { reducedMotion = false, quality = 'high' } = {}) {
    this.scene = scene;
    this.renderer = renderer;
    this.reducedMotion = reducedMotion;
    this.quality = quality;
    this.time = 0;
    this.root = new THREE.Group();
    this.root.name = 'pelican-point-world';
    this.scene.add(this.root);
    this.atmosphere = makeAtmosphereTarget();
    this.nightFactor = 0;
    this.sunDirection = new THREE.Vector3(0.32, 0.17, -0.93).normalize();
    this.moonDirection = new THREE.Vector3(-0.24, 0.55, 0.8).normalize();
    this.lampLights = [];
    this.lampGlows = [];
    this.lampGlassMaterials = [];
    this.windowMaterials = [];
    this.windShaders = [];
    this.gulls = [];
    this.fish = [];
    this.splashRings = [];
    this.grassMeshes = [];
    this.clock = 0;
    this.envTexture = null;
    this._envHour = -100;
    this._envTimer = 0;

    this.scene.fog = new THREE.FogExp2(0xce9b85, 0.0039);

    this._setupLights();
    this._buildSky();
    this._buildOcean();
    this._buildIsland();
    this._buildBoardwalk();
    this._buildLighthouse();
    // Tall path lamps were deliberately left out: at this low, wide camera
    // distance, their crooks cut through the rider's silhouette.
    this._buildScenery();
    this._buildGrass();
    this._buildWildlife();
    this._buildDistantScenery();

    this.setTimeOfDay(18.6, true);
  }

  _setupLights() {
    this.sunLight = new THREE.DirectionalLight(0xffb66e, 3.35);
    this.sunLight.position.set(25, 18, -55);
    this.sunLight.target.position.set(0, 0, 0);
    this.sunLight.castShadow = true;
    const shadowSize = this.quality === 'low' ? 1024 : this.quality === 'medium' ? 1536 : 2048;
    this.sunLight.shadow.mapSize.set(shadowSize, shadowSize);
    this.sunLight.shadow.camera.left = -29;
    this.sunLight.shadow.camera.right = 29;
    this.sunLight.shadow.camera.top = 29;
    this.sunLight.shadow.camera.bottom = -29;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 110;
    this.sunLight.shadow.bias = -0.00035;
    this.sunLight.shadow.normalBias = 0.035;
    this.sunLight.shadow.radius = 1.4;
    this.scene.add(this.sunLight, this.sunLight.target);

    this.hemiLight = new THREE.HemisphereLight(0x7f9bb0, 0x3e2f29, 0.52);
    this.scene.add(this.hemiLight);

    this.moonLight = new THREE.DirectionalLight(0x8aa6d8, 0.0);
    this.moonLight.position.set(-20, 35, 40);
    this.moonLight.target.position.set(0, 0, 0);
    this.scene.add(this.moonLight, this.moonLight.target);

    this.ambientLight = new THREE.AmbientLight(0x9cb5c2, 0.025);
    this.scene.add(this.ambientLight);

    // A soft bounce from the west keeps the white feathers from going muddy.
    this.bounceLight = new THREE.DirectionalLight(0x88a8b8, 0.18);
    this.bounceLight.position.set(-30, 8, 20);
    this.bounceLight.target.position.set(0, 2, 0);
    this.scene.add(this.bounceLight, this.bounceLight.target);

    // A gentle camera-side fill keeps feather detail readable when the
    // pelican rides into the sun. It has no shadow, so it never fights the key.
    this.cameraFill = new THREE.DirectionalLight(0xa8bdc5, 0.22);
    this.cameraFill.target.position.set(0, 2, 0);
    this.scene.add(this.cameraFill, this.cameraFill.target);

    this.lighthouseLight = new THREE.PointLight(0xffc179, 0, 26, 1.8);
    this.lighthouseLight.position.set(-4.2, 9.9, -5.4);
    this.scene.add(this.lighthouseLight);

    this.lighthouseGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeGlowTexture('rgba(255,192,110,1)', 0.1),
        color: 0xffc276,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.lighthouseGlow.scale.setScalar(3.2);
    this.lighthouseGlow.position.set(-4.2, 8.9, -5.4);
    this.scene.add(this.lighthouseGlow);
  }

  _buildSky() {
    const geometry = new THREE.SphereGeometry(820, 48, 32);
    this.skyUniforms = {
      uZenith: { value: new THREE.Color(0x2d506c) },
      uHorizon: { value: new THREE.Color(0xef9e66) },
      uSunColor: { value: new THREE.Color(0xffcb8e) },
      uCloudLit: { value: new THREE.Color(0xffc19d) },
      uCloudShadow: { value: new THREE.Color(0x675262) },
      uSunDir: { value: this.sunDirection.clone() },
      uMoonDir: { value: this.moonDirection.clone() },
      uTime: { value: 0 },
      uNight: { value: 0 },
      uStars: { value: 0.015 },
    };
    this.skyMaterial = new THREE.ShaderMaterial({
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.sky = new THREE.Mesh(geometry, this.skyMaterial);
    this.sky.renderOrder = -100;
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);
  }

  _buildOcean() {
    const segments = this.quality === 'high' ? 180 : this.quality === 'medium' ? 132 : 90;
    const geometry = new THREE.PlaneGeometry(1200, 1200, segments, segments);
    this.oceanUniforms = {
      uTime: { value: 0 },
      uDeepColor: { value: new THREE.Color(0x07242c) },
      uShallowColor: { value: new THREE.Color(0x1b5561) },
      uHorizonColor: { value: new THREE.Color(0xef9e66) },
      uZenithColor: { value: new THREE.Color(0x2d506c) },
      uSunColor: { value: new THREE.Color(0xffcb8e) },
      uFogColor: { value: new THREE.Color(0xce9b85) },
      uSunDir: { value: this.sunDirection.clone() },
      uNight: { value: 0 },
      uFogDensity: { value: 0.0039 },
    };
    this.oceanMaterial = new THREE.ShaderMaterial({
      vertexShader: OCEAN_VERTEX,
      fragmentShader: OCEAN_FRAGMENT,
      uniforms: this.oceanUniforms,
      side: THREE.FrontSide,
      fog: false,
    });
    this.ocean = new THREE.Mesh(geometry, this.oceanMaterial);
    this.ocean.rotation.x = -Math.PI / 2;
    this.ocean.position.y = 0;
    this.ocean.frustumCulled = false;
    this.ocean.receiveShadow = false;
    this.root.add(this.ocean);
  }

  _buildIsland() {
    const segments = this.quality === 'high' ? 110 : this.quality === 'medium' ? 82 : 58;
    const geometry = new THREE.PlaneGeometry(92, 92, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.attributes.position;
    const colors = new Float32Array(position.count * 3);
    const dry = new THREE.Color(0xcbb08b);
    const light = new THREE.Color(0xe3cba5);
    const wet = new THREE.Color(0x837364);
    const moss = new THREE.Color(0x78845b);
    const darkMoss = new THREE.Color(0x4e5a42);
    const tint = new THREE.Color();

    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getZ(i);
      const h = islandHeight(x, z);
      position.setY(i, h);

      const r = Math.hypot(x, z);
      const n = noise2(x * 0.32 + 2.3, z * 0.32 - 1.1);
      const fine = noise2(x * 1.4, z * 1.4);
      tint.copy(dry).lerp(light, clamp(n * 0.8 + fine * 0.3, 0, 1));
      if (h < 0.5) {
        const wetness = 1 - smoothstep(-0.1, 0.55, h);
        tint.lerp(wet, wetness * 0.9);
      }
      const green = smoothstep(0.75, 2.2, h) * smoothstep(0.48, 0.72, noise2(x * 0.23 + 5.0, z * 0.23 - 4.0));
      tint.lerp(n > 0.55 ? moss : darkMoss, green * 0.52);
      if (r > 20) tint.lerp(wet, smoothstep(20, 23, r) * 0.4);
      colors[i * 3] = tint.r;
      colors[i * 3 + 1] = tint.g;
      colors[i * 3 + 2] = tint.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    this.sandTexture = makeSandTexture();
    this.sandTexture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.sandTexture.repeat.set(18, 18);
    this.terrainMaterial = new THREE.MeshStandardMaterial({
      map: this.sandTexture,
      vertexColors: true,
      roughness: 0.97,
      metalness: 0,
      color: 0xffffff,
    });
    this.terrain = new THREE.Mesh(geometry, this.terrainMaterial);
    this.terrain.receiveShadow = true;
    this.terrain.castShadow = false;
    this.root.add(this.terrain);

    // A soft lip of wet sand just below the boardwalk pilings.
    const shoreRing = new THREE.Mesh(
      new THREE.RingGeometry(19.4, 24.4, 96),
      new THREE.MeshBasicMaterial({
        color: 0x8c7c66,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    shoreRing.rotation.x = -Math.PI / 2;
    shoreRing.position.y = 0.08;
    this.root.add(shoreRing);
  }

  _buildBoardwalk() {
    const random = mulberry32(12821);
    this.boardwalkGroup = new THREE.Group();
    this.boardwalkGroup.name = 'boardwalk';
    this.root.add(this.boardwalkGroup);

    this.woodTexture = makeWoodTexture();
    this.woodTexture.rotation = Math.PI / 2;
    this.woodTexture.center.set(0.5, 0.5);
    this.woodTexture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.woodMaterial = new THREE.MeshStandardMaterial({
      map: this.woodTexture,
      color: 0xffffff,
      roughness: 0.79,
      metalness: 0.02,
    });
    this.darkWoodMaterial = new THREE.MeshStandardMaterial({
      color: 0x493727,
      roughness: 0.85,
      metalness: 0.01,
    });
    this.railWoodMaterial = new THREE.MeshStandardMaterial({
      color: 0x614a36,
      roughness: 0.74,
      metalness: 0.02,
    });

    const plankSpacing = 0.355;
    const plankDepth = 0.305;
    const plankCount = Math.max(80, Math.round(pathLength / plankSpacing));
    const plankGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.plankMesh = new THREE.InstancedMesh(plankGeometry, this.woodMaterial, plankCount);
    this.plankMesh.receiveShadow = true;
    this.plankMesh.castShadow = false;
    this.plankMesh.frustumCulled = false;
    const color = new THREE.Color();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const matrix = new THREE.Matrix4();
    const euler = new THREE.Euler();

    for (let i = 0; i < plankCount; i++) {
      const u = i / plankCount;
      const p = boardwalkCurve.getPointAt(u);
      const t = boardwalkCurve.getTangentAt(u).setY(0).normalize();
      const yaw = Math.atan2(-t.z, t.x);
      euler.set(0, yaw, 0);
      quaternion.setFromEuler(euler);
      position.set(p.x, WALK_Y - 0.045 + (random() - 0.5) * 0.008, p.z);
      scale.set(plankDepth, 0.09, WALK_WIDTH);
      matrix.compose(position, quaternion, scale);
      this.plankMesh.setMatrixAt(i, matrix);
      color.setHSL(0.075 + random() * 0.02, 0.2 + random() * 0.15, 0.76 + random() * 0.17);
      this.plankMesh.setColorAt(i, color);
    }
    this.plankMesh.instanceMatrix.needsUpdate = true;
    if (this.plankMesh.instanceColor) this.plankMesh.instanceColor.needsUpdate = true;
    this.boardwalkGroup.add(this.plankMesh);

    // Continuous stringers under the deck.
    this.stringerPoints = [];
    this.railPoints = [];
    const railOffset = WALK_WIDTH / 2 - 0.11;
    const frameCount = 140;
    const frame0p = boardwalkCurve.getPointAt(0);
    const frame0t = boardwalkCurve.getTangentAt(0).setY(0).normalize();
    const outerSign = (-frame0t.z * frame0p.x + frame0t.x * frame0p.z) >= 0 ? 1 : -1;
    for (let i = 0; i < frameCount; i++) {
      const u = i / frameCount;
      const p = boardwalkCurve.getPointAt(u);
      const t = boardwalkCurve.getTangentAt(u).setY(0).normalize();
      const lateral = new THREE.Vector3(-t.z, 0, t.x);
      const left = p.clone().addScaledVector(lateral, -railOffset);
      const right = p.clone().addScaledVector(lateral, railOffset);
      this.stringerPoints.push(
        new THREE.Vector3(left.x, WALK_Y - 0.22, left.z),
        new THREE.Vector3(right.x, WALK_Y - 0.22, right.z)
      );
      this.railPoints.push(
        new THREE.Vector3(p.x + lateral.x * railOffset * outerSign, WALK_Y + 0.32, p.z + lateral.z * railOffset * outerSign)
      );
    }
    const leftStringerCurve = new THREE.CatmullRomCurve3(
      this.stringerPoints.filter((_, i) => i % 2 === 0),
      true
    );
    const rightStringerCurve = new THREE.CatmullRomCurve3(
      this.stringerPoints.filter((_, i) => i % 2 === 1),
      true
    );
    const stringerGeometryLeft = new THREE.TubeGeometry(leftStringerCurve, 180, 0.075, 6, true);
    const stringerGeometryRight = new THREE.TubeGeometry(rightStringerCurve, 180, 0.075, 6, true);
    const stringerLeft = new THREE.Mesh(stringerGeometryLeft, this.darkWoodMaterial);
    const stringerRight = new THREE.Mesh(stringerGeometryRight, this.darkWoodMaterial);
    stringerLeft.castShadow = true;
    stringerRight.castShadow = true;
    this.boardwalkGroup.add(stringerLeft, stringerRight);

    // Supports every few planks, dropping into the sand or the shallows.
    const supportCount = 42;
    const pilingGeometry = new THREE.CylinderGeometry(0.066, 0.082, 1, 7);
    const pilingMesh = new THREE.InstancedMesh(pilingGeometry, this.darkWoodMaterial, supportCount * 2);
    pilingMesh.castShadow = true;
    pilingMesh.receiveShadow = true;
    pilingMesh.frustumCulled = false;
    const beamGeometry = new THREE.BoxGeometry(1, 1, 1);
    const beamMesh = new THREE.InstancedMesh(beamGeometry, this.darkWoodMaterial, supportCount);
    beamMesh.castShadow = true;
    beamMesh.receiveShadow = true;
    beamMesh.frustumCulled = false;

    for (let i = 0; i < supportCount; i++) {
      const u = i / supportCount;
      const p = boardwalkCurve.getPointAt(u);
      const t = boardwalkCurve.getTangentAt(u).setY(0).normalize();
      const lateral = new THREE.Vector3(-t.z, 0, t.x);
      const yaw = Math.atan2(-t.z, t.x);
      for (let side = 0; side < 2; side++) {
        const sign = side === 0 ? -1 : 1;
        const x = p.x + lateral.x * railOffset * sign;
        const z = p.z + lateral.z * railOffset * sign;
        const ground = islandHeight(x, z);
        const top = WALK_Y - 0.2;
        const bottom = clamp(Math.min(ground - 0.08, top - 0.45), -0.75, top - 0.3);
        position.set(x, (top + bottom) / 2, z);
        scale.set(1, Math.max(0.3, top - bottom), 1);
        quaternion.identity();
        matrix.compose(position, quaternion, scale);
        pilingMesh.setMatrixAt(i * 2 + side, matrix);
      }
      _e1.set(0, yaw, 0);
      _q1.setFromEuler(_e1);
      position.set(p.x, WALK_Y - 0.16, p.z);
      scale.set(0.16, 0.14, WALK_WIDTH + 0.16);
      matrix.compose(position, _q1, scale);
      beamMesh.setMatrixAt(i, matrix);
    }
    pilingMesh.instanceMatrix.needsUpdate = true;
    beamMesh.instanceMatrix.needsUpdate = true;
    this.boardwalkGroup.add(pilingMesh, beamMesh);

    // A continuous outer rail, with uprights every 2.2 metres.
    const railCurve = new THREE.CatmullRomCurve3(this.railPoints, true);
    const railTop = new THREE.Mesh(
      new THREE.TubeGeometry(railCurve, 220, 0.014, 4, true),
      this.railWoodMaterial
    );
    railTop.castShadow = true;
    railTop.receiveShadow = true;
    this.boardwalkGroup.add(railTop);

    const postCount = 28;
    const postGeometry = new THREE.CylinderGeometry(0.042, 0.055, 1, 7);
    const postMesh = new THREE.InstancedMesh(postGeometry, this.railWoodMaterial, postCount);
    postMesh.castShadow = true;
    postMesh.receiveShadow = true;
    for (let i = 0; i < postCount; i++) {
      const u = (i / postCount + 0.003) % 1;
      const p = boardwalkCurve.getPointAt(u);
      const t = boardwalkCurve.getTangentAt(u).setY(0).normalize();
      const lateral = new THREE.Vector3(-t.z, 0, t.x);
      const offset = railOffset * outerSign;
      position.set(p.x + lateral.x * offset, WALK_Y + 0.15, p.z + lateral.z * offset);
      scale.set(1, 0.3, 1);
      quaternion.identity();
      matrix.compose(position, quaternion, scale);
      postMesh.setMatrixAt(i, matrix);
    }
    postMesh.instanceMatrix.needsUpdate = true;
    this.boardwalkGroup.add(postMesh);

    // Inner curb, just a slim edge for the deck.
    const curbPoints = [];
    for (let i = 0; i < frameCount; i++) {
      const u = i / frameCount;
      const p = boardwalkCurve.getPointAt(u);
      const t = boardwalkCurve.getTangentAt(u).setY(0).normalize();
      const lateral = new THREE.Vector3(-t.z, 0, t.x);
      curbPoints.push(new THREE.Vector3(p.x - lateral.x * railOffset, WALK_Y - 0.02, p.z - lateral.z * railOffset));
    }
    const curb = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curbPoints, true), 200, 0.035, 5, true),
      this.railWoodMaterial
    );
    curb.castShadow = true;
    this.boardwalkGroup.add(curb);

    this.outerSign = outerSign;
  }

  _buildLighthouse() {
    const baseX = -4.1;
    const baseZ = -5.6;
    const baseY = islandHeight(baseX, baseZ) - 0.12;
    this.lighthouse = new THREE.Group();
    this.lighthouse.position.set(baseX, baseY, baseZ);
    this.lighthouse.name = 'lighthouse';
    this.root.add(this.lighthouse);

    const stoneMaterial = new THREE.MeshStandardMaterial({
      color: 0x6e6860,
      roughness: 0.93,
      flatShading: true,
    });
    const whiteMaterial = new THREE.MeshStandardMaterial({
      color: 0xece1ca,
      roughness: 0.7,
    });
    const redMaterial = new THREE.MeshStandardMaterial({
      color: 0xa94b3c,
      roughness: 0.65,
    });
    const navyMaterial = new THREE.MeshStandardMaterial({
      color: 0x18353b,
      roughness: 0.48,
      metalness: 0.32,
    });
    const roofMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a2525,
      roughness: 0.55,
      metalness: 0.15,
    });
    const lanternMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffe2ac,
      emissive: 0xffb55c,
      emissiveIntensity: 0.4,
      roughness: 0.12,
      metalness: 0.2,
      transparent: true,
      opacity: 0.82,
    });
    this.lanternMaterial = lanternMaterial;
    this.lampGlassMaterials.push(lanternMaterial);

    const rockBase = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.85, 0.55, 12), stoneMaterial);
    rockBase.position.y = 0.2;
    rockBase.castShadow = true;
    rockBase.receiveShadow = true;
    this.lighthouse.add(rockBase);

    // A few tumbled boulders around the base.
    const rockGeometry = new THREE.DodecahedronGeometry(0.48, 0);
    for (let i = 0; i < 7; i++) {
      const angle = i * 1.7 + 0.4;
      const rock = new THREE.Mesh(rockGeometry, stoneMaterial);
      rock.scale.set(1.4 + (i % 3) * 0.3, 0.65 + (i % 2) * 0.3, 1.15);
      rock.position.set(Math.cos(angle) * (1.6 + (i % 3) * 0.22), 0.12, Math.sin(angle) * (1.5 + (i % 2) * 0.2));
      rock.rotation.set(i * 0.4, angle, i * 0.21);
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.lighthouse.add(rock);
    }

    const towerBottom = 0.35;
    const towerHeight = 6.35;
    const bands = 6;
    let y = towerBottom;
    for (let i = 0; i < bands; i++) {
      const t0 = i / bands;
      const t1 = (i + 1) / bands;
      const bottomRadius = lerp(0.8, 0.49, t0);
      const topRadius = lerp(0.8, 0.49, t1);
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(topRadius, bottomRadius, towerHeight / bands + 0.01, 20),
        i % 2 === 0 ? whiteMaterial : redMaterial
      );
      band.position.y = y + towerHeight / bands / 2;
      band.castShadow = true;
      band.receiveShadow = true;
      this.lighthouse.add(band);
      y += towerHeight / bands;
    }

    const galleryY = towerBottom + towerHeight;
    const gallery = new THREE.Mesh(new THREE.CylinderGeometry(0.94, 0.98, 0.1, 20), navyMaterial);
    gallery.position.y = galleryY;
    gallery.castShadow = true;
    this.lighthouse.add(gallery);
    const galleryLip = new THREE.Mesh(new THREE.TorusGeometry(0.91, 0.035, 5, 28), navyMaterial);
    galleryLip.rotation.x = Math.PI / 2;
    galleryLip.position.y = galleryY + 0.06;
    this.lighthouse.add(galleryLip);

    // Gallery railing.
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * TAU;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 5), navyMaterial);
      post.position.set(Math.cos(angle) * 0.82, galleryY + 0.21, Math.sin(angle) * 0.82);
      this.lighthouse.add(post);
    }
    const railing = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.016, 4, 32), navyMaterial);
    railing.rotation.x = Math.PI / 2;
    railing.position.y = galleryY + 0.37;
    this.lighthouse.add(railing);

    // Lantern room.
    const lanternY = galleryY + 0.08;
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.53, 0.96, 12, 1, true), lanternMaterial);
    lantern.position.y = lanternY + 0.5;
    this.lighthouse.add(lantern);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * TAU;
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.98, 0.026), navyMaterial);
      mullion.position.set(Math.cos(angle) * 0.508, lanternY + 0.5, Math.sin(angle) * 0.508);
      mullion.rotation.y = -angle;
      this.lighthouse.add(mullion);
    }
    const lanternFloor = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 16), navyMaterial);
    lanternFloor.position.y = lanternY + 0.02;
    this.lighthouse.add(lanternFloor);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.68, 0.6, 12), roofMaterial);
    roof.position.y = lanternY + 1.23;
    roof.castShadow = true;
    this.lighthouse.add(roof);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), navyMaterial);
    finial.position.y = lanternY + 1.56;
    this.lighthouse.add(finial);
    const finialSpike = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 5), navyMaterial);
    finialSpike.position.y = lanternY + 1.72;
    this.lighthouse.add(finialSpike);

    // The beam is a shader ghost, rotated slowly after dusk.
    this.lighthouseBeamMaterial = new THREE.ShaderMaterial({
      vertexShader: BEAM_VERTEX,
      fragmentShader: BEAM_FRAGMENT,
      uniforms: { uOpacity: { value: 0 } },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.lighthouseBeam = new THREE.Group();
    this.lighthouseBeam.position.y = lanternY + 0.52;
    const beamGeometry = new THREE.ConeGeometry(2.5, 28, 24, 1, true);
    beamGeometry.rotateZ(Math.PI / 2);
    beamGeometry.translate(14, 0, 0);
    const beamA = new THREE.Mesh(beamGeometry, this.lighthouseBeamMaterial);
    const beamB = new THREE.Mesh(beamGeometry, this.lighthouseBeamMaterial);
    beamB.rotation.y = Math.PI;
    this.lighthouseBeam.add(beamA, beamB);
    this.lighthouse.add(this.lighthouseBeam);

    // A small, warm keeper's cottage at the foot of the tower.
    const cottage = new THREE.Group();
    cottage.position.set(2.35, -0.05, 0.55);
    cottage.rotation.y = -0.55;
    const walls = new THREE.Mesh(new THREE.BoxGeometry(2.25, 1.35, 1.55), whiteMaterial);
    walls.position.y = 0.7;
    walls.castShadow = true;
    walls.receiveShadow = true;
    cottage.add(walls);
    const roofLeft = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.08, 1.75), roofMaterial);
    roofLeft.position.set(-0.41, 1.52, 0);
    roofLeft.rotation.z = 0.72;
    roofLeft.castShadow = true;
    const roofRight = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.08, 1.75), roofMaterial);
    roofRight.position.set(0.41, 1.52, 0);
    roofRight.rotation.z = -0.72;
    roofRight.castShadow = true;
    cottage.add(roofLeft, roofRight);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.78, 0.04), navyMaterial);
    door.position.set(-0.42, 0.38, 0.785);
    cottage.add(door);
    const windowMaterial = new THREE.MeshStandardMaterial({
      color: 0xffe3b0,
      emissive: 0xffb55e,
      emissiveIntensity: 0.2,
      roughness: 0.18,
    });
    this.windowMaterials.push(windowMaterial);
    for (const [x, z, ry] of [[0.45, 0.785, 0], [1.13, 0, Math.PI / 2]]) {
      const window = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.3), windowMaterial);
      window.position.set(x, 0.78, z);
      window.rotation.y = ry;
      cottage.add(window);
    }
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.68, 0.25), stoneMaterial);
    chimney.position.set(0.55, 1.66, -0.45);
    chimney.castShadow = true;
    cottage.add(chimney);
    this.lighthouse.add(cottage);

    this.lighthouseLight.position.set(baseX, baseY + lanternY + 0.55, baseZ);
    this.lighthouseGlow.position.set(baseX, baseY + lanternY + 0.58, baseZ);

    // A few simple fence posts around the path to the cottage.
    for (let i = 0; i < 5; i++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.035, 0.65, 6), this.railWoodMaterial);
      post.position.set(-0.9 + i * 0.48, 0.35, 1.65);
      post.rotation.z = (i % 2 ? 0.02 : -0.03);
      post.castShadow = true;
      this.lighthouse.add(post);
    }
  }

  _buildDistantScenery() {
    const distantMaterial = new THREE.MeshBasicMaterial({
      color: 0x273d46,
      fog: true,
    });
    const distantMaterial2 = new THREE.MeshBasicMaterial({
      color: 0x324c54,
      fog: true,
    });
    this.distantMaterials = [distantMaterial, distantMaterial2];
    this.distantMeshes = [];
    const placements = [
      { x: -165, z: -245, sx: 105, sy: 13, sz: 38, rot: 0.2, mat: distantMaterial },
      { x: -55, z: -310, sx: 84, sy: 18, sz: 26, rot: -0.4, mat: distantMaterial2 },
      { x: 210, z: -240, sx: 88, sy: 9, sz: 32, rot: 0.6, mat: distantMaterial },
      { x: 155, z: 310, sx: 70, sy: 7, sz: 25, rot: 1.2, mat: distantMaterial2 },
    ];
    for (const placement of placements) {
      const island = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), placement.mat);
      island.position.set(placement.x, -3.4, placement.z);
      island.scale.set(placement.sx, placement.sy, placement.sz);
      island.rotation.set(0.1, placement.rot, 0.1);
      this.root.add(island);
      this.distantMeshes.push(island);
      const hill = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), placement.mat);
      hill.position.set(placement.x + placement.sx * 0.35, -1.4, placement.z + 8);
      hill.scale.set(placement.sx * 0.34, placement.sy * 0.9, placement.sz * 0.6);
      hill.rotation.set(0.2, placement.rot + 0.7, 0.1);
      this.root.add(hill);
      this.distantMeshes.push(hill);
    }

    // A lone sailboat on the horizon.
    const boat = new THREE.Group();
    boat.position.set(96, 0.2, -135);
    boat.rotation.y = 0.8;
    const hull = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.24, 2.2, 4, 7),
      new THREE.MeshBasicMaterial({ color: 0x241d1a })
    );
    hull.rotation.z = Math.PI / 2;
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.04, 4.6, 5),
      new THREE.MeshBasicMaterial({ color: 0x33251d })
    );
    mast.position.y = 2.4;
    const sailGeometry = new THREE.BufferGeometry();
    sailGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0.1, 0,
      0, 4.1, 0,
      1.6, 0.18, 0,
    ], 3));
    sailGeometry.computeVertexNormals();
    const sail = new THREE.Mesh(
      sailGeometry,
      new THREE.MeshBasicMaterial({ color: 0xded3bd, side: THREE.DoubleSide, fog: true })
    );
    sail.position.set(0.05, 0, 0);
    boat.add(hull, mast, sail);
    this.root.add(boat);
    this.sailboat = boat;
  }

  _buildLampPosts() {
    const metal = new THREE.MeshStandardMaterial({
      color: 0x1f3b38,
      roughness: 0.52,
      metalness: 0.55,
    });
    const capMaterial = new THREE.MeshStandardMaterial({
      color: 0x0e2424,
      roughness: 0.55,
      metalness: 0.45,
    });
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffe1aa,
      emissive: 0xffb45c,
      emissiveIntensity: 0.2,
      roughness: 0.1,
      metalness: 0.05,
      transparent: true,
      opacity: 0.7,
    });
    this.lampGlassMaterials.push(glassMaterial);
    const glowTexture = makeGlowTexture('rgba(255,196,117,1)', 0.1);
    const lampPoolTexture = makeGlowTexture('rgba(255,192,110,1)', 0.05);
    const lampPositions = [0.08, 0.32, 0.58, 0.82];

    for (let index = 0; index < lampPositions.length; index++) {
      const u = lampPositions[index];
      const p = boardwalkCurve.getPointAt(u);
      const t = boardwalkCurve.getTangentAt(u).setY(0).normalize();
      const lateral = new THREE.Vector3(-t.z, 0, t.x);
      const radialDot = lateral.x * p.x + lateral.z * p.z;
      const outer = radialDot >= 0 ? 1 : -1;
      const offset = (WALK_WIDTH / 2 - 0.1) * outer;
      const x = p.x + lateral.x * offset;
      const z = p.z + lateral.z * offset;
      const armDirection = new THREE.Vector3(-lateral.x * outer, 0, -lateral.z * outer);
      const group = new THREE.Group();
      group.position.set(x, WALK_Y, z);
      group.scale.set(0.96, 0.83, 0.96);
      const armYaw = Math.atan2(-armDirection.z, armDirection.x);
      group.rotation.y = armYaw;

      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.145, 0.07, 10), capMaterial);
      base.position.y = 0.035;
      base.castShadow = true;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.042, 2.55, 9), metal);
      post.position.y = 1.31;
      post.castShadow = true;
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 5, 14), metal);
      collar.rotation.x = Math.PI / 2;
      collar.position.y = 0.12;

      const armCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 2.53, 0),
        new THREE.Vector3(0.02, 2.72, 0),
        new THREE.Vector3(0.25, 2.79, 0),
        new THREE.Vector3(0.46, 2.76, 0),
        new THREE.Vector3(0.52, 2.63, 0),
      ]);
      const arm = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 18, 0.027, 6, false), metal);
      arm.castShadow = true;

      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 5), metal);
      chain.position.set(0.52, 2.56, 0);
      const capTop = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.14, 8), metal);
      capTop.position.set(0.52, 2.46, 0);
      capTop.castShadow = true;
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.075, 0.21, 8), glassMaterial);
      glass.position.set(0.52, 2.29, 0);
      const cageTop = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.025, 8), capMaterial);
      cageTop.position.set(0.52, 2.4, 0);
      const cageBottom = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.025, 8), capMaterial);
      cageBottom.position.set(0.52, 2.18, 0);
      const light = new THREE.PointLight(0xffb96f, 0, 8.5, 1.8);
      light.position.set(0.52, 2.3, 0);

      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTexture,
          color: 0xffc078,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      glow.position.set(0.52, 2.3, 0);
      glow.scale.setScalar(0.85);

      const pool = new THREE.Mesh(
        new THREE.PlaneGeometry(2.8, 2.8),
        new THREE.MeshBasicMaterial({
          map: lampPoolTexture,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          color: 0xffbe7b,
        })
      );
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(1.2, 0.012, 0);
      pool.renderOrder = 3;

      group.add(base, post, collar, arm, chain, capTop, glass, cageTop, cageBottom, glow, light, pool);
      this.root.add(group);
      this.lampLights.push(light);
      this.lampGlows.push(glow);
      this.lampPools = this.lampPools || [];
      this.lampPools.push(pool);
    }
  }

  _buildScenery() {
    // Hand-painted sign at the inland edge of the path.
    const signU = 0.72;
    const signPoint = boardwalkCurve.getPointAt(signU);
    const signTangent = boardwalkCurve.getTangentAt(signU).setY(0).normalize();
    const signLateral = new THREE.Vector3(-signTangent.z, 0, signTangent.x);
    const signOuter = signLateral.x * signPoint.x + signLateral.z * signPoint.z >= 0 ? 1 : -1;
    const signX = signPoint.x - signLateral.x * signOuter * (WALK_WIDTH / 2 + 0.9);
    const signZ = signPoint.z - signLateral.z * signOuter * (WALK_WIDTH / 2 + 0.9);
    const signY = islandHeight(signX, signZ);
    this.sign = new THREE.Group();
    this.sign.position.set(signX, signY + 0.05, signZ);
    const normal = new THREE.Vector3(signLateral.x * signOuter, 0, signLateral.z * signOuter);
    this.sign.rotation.y = Math.atan2(normal.x, normal.z);
    const signTexture = makeSignTexture({
      top: 'PELICAN POINT',
      middle: 'Lighthouse Trail',
      bottom: '120 M  ·  NO FISHING',
    });
    const signMaterial = new THREE.MeshStandardMaterial({
      map: signTexture,
      roughness: 0.75,
    });
    const backMaterial = this.darkWoodMaterial;
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, 0.97, 0.06),
      [backMaterial, backMaterial, backMaterial, backMaterial, signMaterial, backMaterial]
    );
    board.position.y = 2.05;
    board.castShadow = true;
    board.receiveShadow = true;
    this.sign.add(board);
    for (const x of [-0.58, 0.58]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.072, 2.2, 7), this.railWoodMaterial);
      post.position.set(x, 1.05, 0);
      post.castShadow = true;
      this.sign.add(post);
    }
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.12, 7), this.railWoodMaterial);
    cap.position.set(-0.58, 2.19, 0);
    this.sign.add(cap);
    this.root.add(this.sign);

    // Weathered driftwood on the beach.
    const driftwoodMaterial = new THREE.MeshStandardMaterial({
      color: 0x8a7c6a,
      roughness: 0.9,
      flatShading: true,
    });
    for (let i = 0; i < 3; i++) {
      const angle = 2.65 + i * 0.45;
      const radius = 21.5 + i * 1.2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = islandHeight(x, z);
      if (y < -0.1) continue;
      const log = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 1.3 + i * 0.35, 3, 6), driftwoodMaterial);
      trunk.rotation.z = Math.PI / 2;
      trunk.rotation.y = i * 0.8;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      log.add(trunk);
      for (let b = 0; b < 2; b++) {
        const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.035, 0.55, 5), driftwoodMaterial);
        branch.position.set((b - 0.5) * 0.42, 0.06, 0.04);
        branch.rotation.z = 0.5 + b * 0.25;
        branch.rotation.y = i + b;
        branch.castShadow = true;
        log.add(branch);
      }
      log.position.set(x, Math.max(0.18, y + 0.12), z);
      log.rotation.y = angle + i;
      this.root.add(log);
    }

    // A bobbing red buoy near the western shore.
    const buoy = new THREE.Group();
    const buoyX = -22.8;
    const buoyZ = 7.8;
    const red = new THREE.MeshStandardMaterial({ color: 0xb84935, roughness: 0.55 });
    const white = new THREE.MeshStandardMaterial({ color: 0xe7dcc5, roughness: 0.55 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), red);
    body.scale.y = 1.5;
    body.position.y = 0.3;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.31, 0.16, 14), white);
    band.position.y = 0.48;
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 8), red);
    top.position.y = 0.9;
    buoy.add(body, band, top);
    buoy.position.set(buoyX, 0.0, buoyZ);
    this.root.add(buoy);
    this.buoy = buoy;

    this.cypresses = [];

    // Low coastal shrubs.
    const shrubMaterial = new THREE.MeshStandardMaterial({
      color: 0x4e644b,
      roughness: 0.93,
      flatShading: true,
    });
    const shrubMaterial2 = new THREE.MeshStandardMaterial({
      color: 0x69754e,
      roughness: 0.94,
      flatShading: true,
    });
    const random = mulberry32(55321);
    for (let i = 0; i < 16; i++) {
      const angle = random() * TAU;
      const radius = 4 + random() * 13;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (distanceToPath(x, z) < WALK_WIDTH / 2 + 1.1) continue;
      if (Math.hypot(x + 4.1, z + 5.6) < 2.7) continue;
      const h = islandHeight(x, z);
      if (h < 0.35) continue;
      const shrub = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1, 1),
        i % 3 === 0 ? shrubMaterial2 : shrubMaterial
      );
      shrub.scale.set(0.42 + random() * 0.7, 0.22 + random() * 0.34, 0.38 + random() * 0.55);
      shrub.position.set(x, h + 0.15, z);
      shrub.rotation.set(random() * 0.2, random() * TAU, random() * 0.1);
      shrub.castShadow = true;
      shrub.receiveShadow = true;
      this.root.add(shrub);
    }

    // Rocks along the beach and under the lighthouse.
    const rockMaterial = new THREE.MeshStandardMaterial({
      color: 0x5e5a52,
      roughness: 0.92,
      flatShading: true,
    });
    const rockMaterial2 = new THREE.MeshStandardMaterial({
      color: 0x766d5f,
      roughness: 0.9,
      flatShading: true,
    });
    const rockGeom = new THREE.DodecahedronGeometry(1, 0);
    const random2 = mulberry32(71129);
    for (let i = 0; i < 26; i++) {
      const angle = random2() * TAU;
      const radius = 4.5 + random2() * 20;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (distanceToPath(x, z) < WALK_WIDTH / 2 + 1.2) continue;
      const h = islandHeight(x, z);
      if (h < -0.2) continue;
      if (Math.hypot(x + 4.1, z + 5.6) < 2.2) continue;
      const rock = new THREE.Mesh(rockGeom, i % 3 === 0 ? rockMaterial2 : rockMaterial);
      rock.scale.set(0.2 + random2() * 0.6, 0.16 + random2() * 0.4, 0.25 + random2() * 0.5);
      rock.position.set(x, h + rock.scale.y * 0.35, z);
      rock.rotation.set(random2() * 2, random2() * TAU, random2() * 2);
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.root.add(rock);
    }
  }

  _makeCypress(x, z, scale, seed) {
    const tree = new THREE.Group();
    const random = mulberry32(8010 + seed * 91);
    const baseHeight = islandHeight(x, z);
    tree.position.set(x, baseHeight, z);
    tree.scale.setScalar(scale);
    const trunkMaterial = new THREE.MeshStandardMaterial({
      color: 0x4b3728,
      roughness: 0.95,
    });
    const canopyMaterial = new THREE.MeshStandardMaterial({
      color: seed % 2 ? 0x364c3e : 0x405441,
      roughness: 0.92,
      flatShading: true,
    });
    let current = new THREE.Vector3(0, 0, 0);
    let direction = new THREE.Vector3(0.1, 1, 0.03).normalize();
    const segmentCount = 3;
    for (let i = 0; i < segmentCount; i++) {
      const next = current.clone().addScaledVector(direction, 0.72 + i * 0.1);
      const radius = 0.09 * (1 - i * 0.2);
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.72, radius, next.distanceTo(current), 6),
        trunkMaterial
      );
      trunk.position.copy(current).add(next).multiplyScalar(0.5);
      trunk.quaternion.setFromUnitVectors(UP, next.clone().sub(current).normalize());
      trunk.castShadow = true;
      tree.add(trunk);
      current = next;
      direction.x += random() * 0.18;
      direction.normalize();
    }

    // Flat, wind-combed canopies.
    for (let i = 0; i < 5; i++) {
      const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), canopyMaterial);
      canopy.scale.set(0.55 + random() * 0.38, 0.2 + random() * 0.24, 0.34 + random() * 0.3);
      canopy.position.set(
        current.x + (random() - 0.3) * 0.8,
        current.y - 0.2 + random() * 0.68,
        current.z + (random() - 0.5) * 0.65
      );
      canopy.rotation.set(random() * 0.25, random() * TAU, (random() - 0.5) * 0.22);
      canopy.castShadow = true;
      canopy.receiveShadow = true;
      tree.add(canopy);
    }
    // A lower sun-bleached branch.
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.045, 1.1, 5), trunkMaterial);
    branch.position.set(0.35, 1.15, 0.03);
    branch.rotation.z = 1.12;
    branch.castShadow = true;
    tree.add(branch);
    return tree;
  }

  _buildGrass() {
    const bladeGeometry = (() => {
      const positions = [];
      const colors = [];
      const indices = [];
      const random = mulberry32(69831);
      const rootDark = new THREE.Color(0x34482d);
      const rootLight = new THREE.Color(0x8d925c);
      const bladeCount = 9;
      for (let i = 0; i < bladeCount; i++) {
        const angle = (i / bladeCount) * TAU + (random() - 0.5) * 0.75;
        const radius = 0.01 + random() * 0.095;
        const height = 0.4 + random() * 0.45;
        const width = 0.022 + random() * 0.022;
        const bend = 0.08 + random() * 0.22;
        const dx = Math.cos(angle);
        const dz = Math.sin(angle);
        const px = -dz * width;
        const pz = dx * width;
        const bx = dx * radius;
        const bz = dz * radius;
        const base = positions.length / 3;
        positions.push(bx + px, 0, bz + pz);
        positions.push(bx - px, 0, bz - pz);
        positions.push(bx + dx * bend, height, bz + dz * bend);
        const baseColor = rootDark.clone().lerp(rootLight, 0.12 + random() * 0.18);
        const tipColor = rootLight.clone().offsetHSL((random() - 0.5) * 0.04, (random() - 0.5) * 0.08, random() * 0.13);
        colors.push(baseColor.r, baseColor.g, baseColor.b);
        colors.push(baseColor.r * 0.82, baseColor.g * 0.82, baseColor.b * 0.82);
        colors.push(tipColor.r, tipColor.g, tipColor.b);
        indices.push(base, base + 1, base + 2);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return geometry;
    })();

    this.grassMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    this.grassMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uWindTime = { value: 0 };
      shader.vertexShader = `uniform float uWindTime;\n${shader.vertexShader}`;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
          #include <begin_vertex>
          #ifdef USE_INSTANCING
            float grassPhase = instanceMatrix[3].x * 0.72 + instanceMatrix[3].z * 0.53;
          #else
            float grassPhase = 0.0;
          #endif
          float grassBend = smoothstep(0.0, 0.68, position.y);
          transformed.x += sin(uWindTime * 1.15 + grassPhase) * 0.085 * grassBend;
          transformed.z += cos(uWindTime * 0.78 + grassPhase * 1.7) * 0.05 * grassBend;
        `
      );
      this.windShaders.push(shader);
    };
    this.grassMaterial.customProgramCacheKey = () => 'pelican-grass-wind-v1';

    const count = this.quality === 'high' ? 850 : this.quality === 'medium' ? 560 : 360;
    const random = mulberry32(44107);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const mesh = new THREE.InstancedMesh(bladeGeometry, this.grassMaterial, count);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < count * 18) {
      attempts++;
      const angle = random() * TAU;
      const radius = 3.2 + Math.pow(random(), 0.64) * 19.8;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (distanceToPath(x, z) < WALK_WIDTH / 2 + 0.55) continue;
      const h = islandHeight(x, z);
      if (h < 0.3) continue;
      if (Math.hypot(x + 4.1, z + 5.6) < 2.0) continue;
      dummy.position.set(x, h - 0.02, z);
      dummy.rotation.set(0, random() * TAU, 0);
      const s = 0.65 + random() * 0.95;
      dummy.scale.set(s, 0.72 + random() * 0.9, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(placed, dummy.matrix);
      color.setHSL(0.19 + random() * 0.08, 0.2 + random() * 0.25, 0.62 + random() * 0.28);
      mesh.setColorAt(placed, color);
      placed++;
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.root.add(mesh);
    this.grassMeshes.push(mesh);

    // Flowers: tiny enamel dots in the grass.
    const flowerCount = this.quality === 'low' ? 65 : 130;
    const flowerGeometry = new THREE.SphereGeometry(0.023, 5, 4);
    const flowerMaterial = new THREE.MeshStandardMaterial({
      color: 0xffe0a4,
      emissive: 0x7c4b1e,
      emissiveIntensity: 0.25,
      roughness: 0.55,
    });
    const flowers = new THREE.InstancedMesh(flowerGeometry, flowerMaterial, flowerCount);
    flowers.frustumCulled = false;
    let flowerPlaced = 0;
    attempts = 0;
    while (flowerPlaced < flowerCount && attempts < flowerCount * 40) {
      attempts++;
      const angle = random() * TAU;
      const radius = 4 + Math.pow(random(), 0.7) * 14.5;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (distanceToPath(x, z) < WALK_WIDTH / 2 + 0.65) continue;
      const h = islandHeight(x, z);
      if (h < 0.5) continue;
      dummy.position.set(x, h + 0.22 + random() * 0.25, z);
      dummy.rotation.set(0, random() * TAU, 0);
      const s = 0.65 + random() * 0.8;
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      flowers.setMatrixAt(flowerPlaced, dummy.matrix);
      color.setHSL(0.1 + random() * 0.05, 0.5, 0.75 + random() * 0.2);
      flowers.setColorAt(flowerPlaced, color);
      flowerPlaced++;
    }
    flowers.count = flowerPlaced;
    flowers.instanceMatrix.needsUpdate = true;
    if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
    this.root.add(flowers);
  }

  _buildWildlife() {
    // Gulls, lazily circling the point.
    const gullWhite = new THREE.MeshStandardMaterial({
      color: 0xece8dd,
      roughness: 0.78,
      side: THREE.DoubleSide,
    });
    const gullGrey = new THREE.MeshStandardMaterial({
      color: 0x9b9d9c,
      roughness: 0.8,
      side: THREE.DoubleSide,
    });
    const gullBeak = new THREE.MeshStandardMaterial({
      color: 0xd8903e,
      roughness: 0.62,
    });
    const gullDark = new THREE.MeshStandardMaterial({
      color: 0x333331,
      roughness: 0.75,
    });

    for (let i = 0; i < 6; i++) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 9), gullWhite);
      body.scale.set(0.26, 0.08, 0.095);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), gullWhite);
      head.position.set(0.24, 0.055, 0);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.027, 0.14, 5), gullBeak);
      beak.rotation.z = -Math.PI / 2;
      beak.position.set(0.38, 0.05, 0);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.23, 4), gullGrey);
      tail.rotation.z = Math.PI / 2;
      tail.position.set(-0.28, 0.01, 0);
      tail.scale.z = 0.5;
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), gullDark);
      eyeL.position.set(0.28, 0.07, 0.065);
      const eyeR = eyeL.clone();
      eyeR.position.z = -0.065;
      group.add(body, head, beak, tail, eyeL, eyeR);

      const wings = [];
      for (const side of [-1, 1]) {
        const wingGroup = new THREE.Group();
        wingGroup.position.set(0.03, 0.03, side * 0.065);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([
          0.1, 0, 0,
          -0.12, 0.01, side * 0.56,
          -0.36, 0, side * 0.34,
          -0.23, 0, side * 0.03,
        ], 3));
        geometry.setIndex([0, 1, 2, 0, 2, 3]);
        geometry.computeVertexNormals();
        const wing = new THREE.Mesh(geometry, gullWhite);
        const tipGeometry = new THREE.BufferGeometry();
        tipGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
          -0.12, 0.011, side * 0.56,
          -0.36, 0.001, side * 0.34,
          -0.43, 0.001, side * 0.15,
        ], 3));
        tipGeometry.setIndex([0, 1, 2]);
        tipGeometry.computeVertexNormals();
        const tip = new THREE.Mesh(tipGeometry, gullGrey);
        wingGroup.add(wing, tip);
        group.add(wingGroup);
        wings.push({ group: wingGroup, side });
      }

      const scale = 1.1 + Math.random() * 0.8;
      group.scale.setScalar(scale);
      group.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = false;
          child.receiveShadow = false;
        }
      });
      this.root.add(group);
      this.gulls.push({
        group,
        wings,
        radius: 16 + Math.random() * 19,
        height: 7 + Math.random() * 9,
        phase: Math.random() * TAU,
        speed: 0.075 + Math.random() * 0.06,
        direction: Math.random() > 0.5 ? 1 : -1,
        flapSpeed: 3.2 + Math.random() * 2.3,
        glide: Math.random() * 0.5,
      });
    }

    // A single gull resting on the lighthouse gallery.
    const perched = new THREE.Group();
    const perchedBody = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), gullWhite);
    perchedBody.scale.set(0.3, 0.16, 0.16);
    perchedBody.position.y = 0.1;
    const perchedHead = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 7), gullWhite);
    perchedHead.position.set(0.22, 0.26, 0);
    const perchedBeak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.15, 5), gullBeak);
    perchedBeak.rotation.z = -Math.PI / 2;
    perchedBeak.position.set(0.35, 0.26, 0);
    const perchedWing = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), gullGrey);
    perchedWing.scale.set(0.22, 0.08, 0.09);
    perchedWing.position.set(-0.03, 0.13, 0.08);
    perchedWing.rotation.z = -0.3;
    perched.add(perchedBody, perchedHead, perchedBeak, perchedWing);
    perched.position.set(-3.3, islandHeight(-4.1, -5.6) + 7.1, -5.0);
    perched.rotation.y = 1.4;
    perched.scale.setScalar(0.9);
    this.root.add(perched);
    this.perchedGull = perched;

    // Leaping fish.
    const fishMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x9bbcc0,
      roughness: 0.28,
      metalness: 0.48,
      clearcoat: 0.65,
      clearcoatRoughness: 0.25,
    });
    for (let i = 0; i < 3; i++) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), fishMaterial);
      body.scale.set(0.25, 0.09, 0.05);
      const tail = new THREE.Group();
      const finTop = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.22, 3), fishMaterial);
      finTop.rotation.z = Math.PI / 2;
      finTop.position.set(-0.12, 0.03, 0);
      finTop.scale.z = 0.25;
      const finBottom = finTop.clone();
      finBottom.rotation.x = Math.PI;
      finBottom.position.y = -0.03;
      tail.add(finTop, finBottom);
      tail.position.x = -0.25;
      const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.11, 3), fishMaterial);
      dorsal.position.set(0.02, 0.09, 0);
      dorsal.scale.z = 0.25;
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), new THREE.MeshBasicMaterial({ color: 0x111111 }));
      eye.position.set(0.18, 0.02, 0.042);
      group.add(body, tail, dorsal, eye);
      group.visible = false;
      group.scale.setScalar(1.2);
      this.root.add(group);
      this.fish.push({
        group,
        tail,
        active: false,
        nextAt: 3 + Math.random() * 7,
        startedAt: 0,
        duration: 1.2,
        phase: Math.random() * TAU,
        start: new THREE.Vector3(),
        end: new THREE.Vector3(),
        height: 1.1 + Math.random() * 0.7,
      });
    }

    const ringGeometry = new THREE.RingGeometry(0.08, 0.13, 24);
    for (let i = 0; i < 6; i++) {
      const ring = new THREE.Mesh(
        ringGeometry,
        new THREE.MeshBasicMaterial({
          color: 0xeadbc3,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.visible = false;
      this.root.add(ring);
      this.splashRings.push({ mesh: ring, age: 1 });
    }

    this._buildParticles();
  }

  _buildParticles() {
    const moteVertex = /* glsl */ `
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uTwinkle;
      attribute float aPhase;
      attribute float aSize;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.17 + aPhase) * 0.75;
        p.y += sin(uTime * 0.31 + aPhase * 1.71) * 0.28;
        p.z += cos(uTime * 0.14 + aPhase * 1.3) * 0.62;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = min(26.0, aSize * uPixelRatio * (58.0 / max(1.0, -mv.z)));
        float blink = 0.5 + 0.5 * sin(uTime * 1.2 + aPhase * 3.7);
        vAlpha = mix(1.0, 0.18 + 0.82 * pow(blink, 4.0), uTwinkle);
      }
    `;
    const moteFragment = /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        float alpha = smoothstep(0.5, 0.08, d) * uOpacity * vAlpha;
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `;

    const createSystem = (count, color, twinkle, placement) => {
      const positions = new Float32Array(count * 3);
      const phases = new Float32Array(count);
      const sizes = new Float32Array(count);
      const random = mulberry32(placement.seed);
      for (let i = 0; i < count; i++) {
        const angle = random() * TAU;
        let radius;
        let height;
        if (placement.type === 'path') {
          radius = 4 + Math.pow(random(), 0.65) * (placement.radius - 4);
          height = 0.4 + random() * placement.height;
        } else {
          radius = 4 + random() * (placement.radius - 4);
          height = 0.4 + random() * placement.height;
        }
        positions[i * 3] = Math.cos(angle) * radius;
        positions[i * 3 + 1] = height;
        positions[i * 3 + 2] = Math.sin(angle) * radius;
        phases[i] = random() * TAU;
        sizes[i] = placement.minSize + random() * (placement.maxSize - placement.minSize);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
      geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
      const material = new THREE.ShaderMaterial({
        vertexShader: moteVertex,
        fragmentShader: moteFragment,
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
          uTwinkle: { value: twinkle },
          uColor: { value: new THREE.Color(color) },
          uOpacity: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const points = new THREE.Points(geometry, material);
      points.frustumCulled = false;
      points.renderOrder = 4;
      this.root.add(points);
      return { points, material };
    };

    this.pollen = createSystem(80, 0xffd7a1, 0.15, {
      seed: 81234,
      type: 'path',
      radius: 17,
      height: 5.2,
      minSize: 0.15,
      maxSize: 0.44,
    });
    this.fireflies = createSystem(120, 0xffe08a, 1.0, {
      seed: 27123,
      type: 'path',
      radius: 21,
      height: 3.0,
      minSize: 0.5,
      maxSize: 1.6,
    });
    this.fireflies.material.uniforms.uColor.value.setHex(0xffe397);
    this.fireflies.points.visible = false;
  }

  _spawnSplash(position) {
    const splash = this.splashRings.find((entry) => entry.age >= 1);
    if (!splash) return;
    splash.age = 0;
    splash.mesh.position.set(position.x, 0.045, position.z);
    splash.mesh.scale.setScalar(0.4);
    splash.mesh.material.opacity = 0.55;
    splash.mesh.visible = true;
  }

  _resetFish(fish, time) {
    const angle = Math.random() * TAU;
    const radius = 24 + Math.random() * 11;
    fish.start.set(Math.cos(angle) * radius, 0.02, Math.sin(angle) * radius);
    fish.end.set(
      Math.cos(angle + 0.055 + Math.random() * 0.04) * (radius + 1.2),
      0.02,
      Math.sin(angle + 0.055 + Math.random() * 0.04) * (radius + 1.2)
    );
    fish.startedAt = time;
    fish.duration = 1.05 + Math.random() * 0.55;
    fish.height = 0.9 + Math.random() * 0.8;
    fish.active = true;
    fish.group.visible = true;
    fish.group.rotation.y = Math.atan2(-(fish.end.z - fish.start.z), fish.end.x - fish.start.x);
    this._spawnSplash(fish.start);
  }

  setTimeOfDay(hour, immediate = false) {
    this.hour = hour;
    sampleAtmosphere(hour, this.atmosphere);
    const atmo = this.atmosphere;
    const elevation = atmo.elevation;
    const azimuth = atmo.azimuth;
    this.sunDirection.set(
      Math.cos(elevation) * Math.cos(azimuth),
      Math.sin(elevation),
      Math.cos(elevation) * Math.sin(azimuth)
    ).normalize();
    this.moonDirection.set(
      -this.sunDirection.x,
      Math.max(0.2, -this.sunDirection.y * 0.72 + 0.22),
      -this.sunDirection.z
    ).normalize();
    atmo.sunDirection = this.sunDirection;
    this.nightFactor = atmo.night;

    this.skyUniforms.uZenith.value.copy(atmo.zenith);
    this.skyUniforms.uHorizon.value.copy(atmo.horizon);
    this.skyUniforms.uSunColor.value.copy(atmo.sun);
    this.skyUniforms.uCloudLit.value.copy(atmo.cloudLit);
    this.skyUniforms.uCloudShadow.value.copy(atmo.cloudShadow);
    this.skyUniforms.uSunDir.value.copy(this.sunDirection);
    this.skyUniforms.uMoonDir.value.copy(this.moonDirection);
    this.skyUniforms.uNight.value = atmo.night;
    this.skyUniforms.uStars.value = atmo.stars;

    const lightAboveHorizon = smoothstep(-0.05, 0.055, elevation);
    const lightDir = elevation > -0.03 ? this.sunDirection : this.moonDirection;
    const waterLightColor = elevation > -0.03 ? atmo.sun : _c1.setHex(0x8ca6d3);
    this.oceanUniforms.uSunDir.value.copy(lightDir);
    this.oceanUniforms.uSunColor.value.copy(waterLightColor).multiplyScalar(elevation > -0.03 ? 0.65 + atmo.sunI * 0.22 : 0.65);
    this.oceanUniforms.uDeepColor.value.copy(atmo.waterDeep);
    this.oceanUniforms.uShallowColor.value.copy(atmo.waterShallow);
    this.oceanUniforms.uHorizonColor.value.copy(atmo.horizon);
    this.oceanUniforms.uZenithColor.value.copy(atmo.zenith);
    this.oceanUniforms.uFogColor.value.copy(atmo.fog);
    this.oceanUniforms.uFogDensity.value = atmo.fogDensity;
    this.oceanUniforms.uNight.value = atmo.night;

    this.scene.fog.color.copy(atmo.fog);
    this.scene.fog.density = atmo.fogDensity;

    this.sunLight.color.copy(atmo.sun);
    this.sunLight.intensity = atmo.sunI * lightAboveHorizon;
    this.sunLight.position.copy(this.sunDirection).multiplyScalar(72);
    this.sunLight.visible = this.sunLight.intensity > 0.02;

    this.moonLight.intensity = atmo.night * 0.32;
    this.moonLight.position.copy(this.moonDirection).multiplyScalar(65);
    this.hemiLight.color.copy(atmo.hemiSky);
    this.hemiLight.groundColor.copy(atmo.hemiGround);
    this.hemiLight.intensity = atmo.hemiI;
    this.ambientLight.color.copy(atmo.hemiSky);
    this.ambientLight.intensity = 0.02 + atmo.night * 0.035;
    this.bounceLight.color.copy(atmo.cloudLit);
    this.bounceLight.color.setHex(0x98b2c0);
    this.bounceLight.intensity = 0.26 * (1 - atmo.night);

    this.renderer.toneMappingExposure = atmo.exposure;
    this.scene.environmentIntensity = atmo.env;

    const gold = clamp(1 - atmo.night, 0, 1);
    this.lighthouseLight.intensity = atmo.night * 4.4;
    this.lighthouseGlow.material.opacity = atmo.night * 0.72;
    this._lighthouseGlowBase = this.lighthouseGlow.material.opacity;
    this.lanternMaterial.emissiveIntensity = 0.35 + atmo.night * 2.2;
    for (const material of this.windowMaterials) {
      material.emissiveIntensity = 0.16 + atmo.night * 2.6;
    }
    for (let i = 0; i < this.lampGlassMaterials.length; i++) {
      const material = this.lampGlassMaterials[i];
      if (material === this.lanternMaterial) continue;
      material.emissiveIntensity = 0.18 + atmo.night * 1.9;
    }
    this.lampLights.forEach((light, i) => {
      light.intensity = atmo.night * (5.6 + i * 0.4);
    });
    this.lampGlows.forEach((glow, i) => {
      glow.material.opacity = atmo.night * (0.63 + i * 0.035);
    });
    if (this.lampPools) {
      this.lampPools.forEach((pool) => {
        pool.material.opacity = atmo.night * 0.19;
      });
    }
    this.lighthouseBeamMaterial.uniforms.uOpacity.value = smoothstep(0.22, 0.82, atmo.night);
    this.lighthouseBeam.visible = atmo.night > 0.18;

    if (this.distantMaterials) {
      for (let i = 0; i < this.distantMaterials.length; i++) {
        const base = i % 2 === 0 ? _c1.setHex(0x1a3038) : _c2.setHex(0x223b43);
        this.distantMaterials[i].color.copy(base).lerp(atmo.fog, 0.18).multiplyScalar(0.88);
      }
    }

    this._pollenOpacity = (1 - atmo.night * 0.9) * (0.07 + (1 - Math.abs(elevation - 0.18)) * 0.05);
    this._fireflyOpacity = atmo.night * 0.85;
    if (this.fireflies) this.fireflies.points.visible = atmo.night > 0.35;
    if (this.pollen) this.pollen.points.visible = atmo.night < 0.9;

    this._envHour = hour;
    if (immediate) {
      this._updateEnvironment();
    } else {
      if (this._envTimer) window.clearTimeout(this._envTimer);
      this._envTimer = window.setTimeout(() => {
        this._envTimer = 0;
        this._updateEnvironment();
      }, 170);
    }

    if (this.onTimeChange) this.onTimeChange(hour, atmo, this.nightFactor);
  }

  _updateEnvironment() {
    if (!this.scene || !this.atmosphere) return;
    const oldTexture = this.envTexture;
    const texture = createSkyEnvironment(this.hour, this.atmosphere);
    this.scene.environment = texture;
    this.scene.environmentIntensity = this.atmosphere.env;
    this.envTexture = texture;
    if (oldTexture) oldTexture.dispose();
  }

  update(dt, time, rider) {
    this.clock = time;
    this.skyUniforms.uTime.value = time;
    this.oceanUniforms.uTime.value = time;
    if (this.pollen) {
      this.pollen.material.uniforms.uTime.value = time;
      this.pollen.material.uniforms.uOpacity.value = this._pollenOpacity ?? 0.3;
    }
    if (this.fireflies) {
      this.fireflies.material.uniforms.uTime.value = time;
      this.fireflies.material.uniforms.uOpacity.value = this._fireflyOpacity ?? 0;
    }
    for (const shader of this.windShaders) {
      if (shader.uniforms.uWindTime) shader.uniforms.uWindTime.value = time;
    }

    this.lighthouseBeam.rotation.y += dt * 0.19;
    this.lighthouseBeam.visible = (this.nightFactor > 0.18);
    const flicker = 0.94 + Math.sin(time * 6.1) * 0.035 + Math.sin(time * 11.7 + 1.4) * 0.025;
    this.lighthouseLight.intensity = this.nightFactor * 4.4 * flicker;
    this.lighthouseGlow.material.opacity = (this._lighthouseGlowBase || 0) * flicker;
    this.lampLights.forEach((light, i) => {
      const base = this.nightFactor * (5.6 + i * 0.4);
      light.intensity = base * (0.92 + Math.sin(time * 3.3 + i * 2.6) * 0.04 + Math.sin(time * 7.1 + i) * 0.03);
    });

    for (let i = 0; i < this.gulls.length; i++) {
      const gull = this.gulls[i];
      const angle = time * gull.speed * gull.direction + gull.phase;
      const r = gull.radius;
      gull.group.position.set(
        Math.cos(angle) * r,
        gull.height + Math.sin(time * 0.24 + gull.phase) * 0.9,
        Math.sin(angle) * r
      );
      const tx = -Math.sin(angle) * gull.direction;
      const tz = Math.cos(angle) * gull.direction;
      gull.group.rotation.y = Math.atan2(-tz, tx);
      gull.group.rotation.z = Math.sin(time * 0.4 + gull.phase) * 0.08;
      const flap = Math.sin(time * gull.flapSpeed + gull.phase * 5.0);
      const glide = smoothstep(-0.2, 0.4, Math.sin(time * 0.23 + gull.phase * 2.0)) * gull.glide;
      const angleOffset = flap * (0.55 - glide * 0.32);
      for (const wing of gull.wings) {
        wing.group.rotation.x = -wing.side * angleOffset;
        wing.group.rotation.z = wing.side * 0.03;
      }
    }

    if (this.perchedGull) {
      this.perchedGull.rotation.y = 1.4 + Math.sin(time * 0.1) * 0.15;
    }

    for (const fish of this.fish) {
      if (!fish.active && time > fish.nextAt) {
        this._resetFish(fish, time);
      }
      if (fish.active) {
        const t = (time - fish.startedAt) / fish.duration;
        if (t >= 1) {
          fish.active = false;
          fish.group.visible = false;
          this._spawnSplash(fish.end);
          fish.nextAt = time + 5 + Math.random() * 9;
          continue;
        }
        const x = lerp(fish.start.x, fish.end.x, t);
        const z = lerp(fish.start.z, fish.end.z, t);
        const y = 0.04 + Math.sin(t * Math.PI) * fish.height;
        fish.group.position.set(x, y, z);
        fish.group.rotation.z = -Math.cos(t * Math.PI) * 0.9;
        fish.tail.rotation.y = Math.sin(time * 18 + fish.phase * 2) * 0.6;
        fish.group.rotation.y = Math.atan2(-(fish.end.z - fish.start.z), fish.end.x - fish.start.x);
      }
    }

    for (const splash of this.splashRings) {
      if (splash.age >= 1) continue;
      splash.age += dt * 1.8;
      const s = 0.4 + splash.age * 2.6;
      splash.mesh.scale.setScalar(s);
      splash.mesh.material.opacity = (1 - splash.age) * 0.5;
      if (splash.age >= 1) splash.mesh.visible = false;
    }

    if (this.buoy) {
      this.buoy.position.y = Math.sin(time * 0.72) * 0.035;
      this.buoy.rotation.z = Math.sin(time * 0.61) * 0.045;
      this.buoy.rotation.x = Math.cos(time * 0.53) * 0.03;
    }
    if (this.sailboat) {
      this.sailboat.position.y = 0.18 + Math.sin(time * 0.5) * 0.035;
      this.sailboat.rotation.z = Math.sin(time * 0.43) * 0.018;
    }

    if (rider?.camera) {
      this.cameraFill.position.copy(rider.camera.position);
      this.cameraFill.target.position.copy(rider.position);
      this.cameraFill.target.position.y += 1.3;
      this.cameraFill.intensity = 0.3 + this.nightFactor * 0.12;
    }
    if (rider && this.lighthouseGlow) {
      const dist = rider.position.distanceTo(this.lighthouse.position);
      this.lighthouseGlow.material.opacity = (this._lighthouseGlowBase || 0) * (0.9 + 0.1 * Math.sin(time * 2.1));
    }
  }

  getNightFactor() {
    return this.nightFactor;
  }

  dispose() {
    if (this._envTimer) window.clearTimeout(this._envTimer);
    if (this.envTexture) this.envTexture.dispose();
    this.scene.remove(this.sky);
    this.sky.geometry.dispose();
    this.skyMaterial.dispose();
    this.scene.remove(this.root);
  }
}

export { ATMO_KEYS };
