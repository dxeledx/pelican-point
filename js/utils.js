import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const UP = new THREE.Vector3(0, 1, 0);

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (v - a) / (b - a);
export const smoothstep = (edge0, edge1, v) => {
  const t = clamp((v - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};
export const smootherstep = (edge0, edge1, v) => {
  const t = clamp((v - edge0) / (edge1 - edge0), 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt));
export const dampVec3 = (current, target, lambda, dt) => {
  const t = 1 - Math.exp(-lambda * dt);
  current.lerp(target, t);
  return current;
};
export const wrap = (v, min, max) => {
  const range = max - min;
  return ((((v - min) % range) + range) % range) + min;
};
export const wrapAngle = (a) => wrap(a, -Math.PI, Math.PI);
export const dampAngle = (current, target, lambda, dt) => {
  current += wrapAngle(target - current) * (1 - Math.exp(-lambda * dt));
  return current;
};
export const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomRange(random, min, max) {
  return min + (max - min) * random();
}

export function canvas2d(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  return { canvas, ctx };
}

export function makeCanvasTexture(canvas, { srgb = true, repeat = null, anisotropy = 4 } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
  }
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

export function makeWoodTexture() {
  const { canvas, ctx } = canvas2d(512, 512);
  const random = mulberry32(44291);
  const base = ctx.createLinearGradient(0, 0, 0, 512);
  base.addColorStop(0, '#8c603d');
  base.addColorStop(0.45, '#9f714b');
  base.addColorStop(1, '#7a4f31');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 120; i++) {
    const y = random() * 512;
    const alpha = randomRange(random, 0.025, 0.12);
    ctx.strokeStyle = `rgba(${random() > 0.5 ? '47,25,12' : '235,201,154'},${alpha})`;
    ctx.lineWidth = randomRange(random, 0.5, 2.2);
    ctx.beginPath();
    ctx.moveTo(-10, y);
    for (let x = 0; x <= 522; x += 24) {
      const wobble = Math.sin(x * 0.035 + i) * randomRange(random, 0.6, 3.4);
      ctx.lineTo(x, y + wobble + Math.sin(x * 0.012 + random() * 5) * 4);
    }
    ctx.stroke();
  }

  for (let i = 0; i < 10; i++) {
    const x = random() * 512;
    const y = random() * 512;
    const radius = randomRange(random, 3, 11);
    const knot = ctx.createRadialGradient(x, y, 0, x, y, radius);
    knot.addColorStop(0, 'rgba(48,24,12,.36)');
    knot.addColorStop(0.55, 'rgba(61,32,16,.14)');
    knot.addColorStop(1, 'rgba(61,32,16,0)');
    ctx.fillStyle = knot;
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 1.8, radius * 0.5, random() * Math.PI, 0, TAU);
    ctx.fill();
  }

  const shade = ctx.createLinearGradient(0, 0, 512, 0);
  shade.addColorStop(0, 'rgba(25,12,6,.18)');
  shade.addColorStop(0.4, 'rgba(255,229,187,.04)');
  shade.addColorStop(0.82, 'rgba(255,229,187,.045)');
  shade.addColorStop(1, 'rgba(25,12,6,.16)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 512, 512);

  return makeCanvasTexture(canvas, { repeat: [1, 1], anisotropy: 8 });
}

export function makeFeatherTexture() {
  const { canvas, ctx } = canvas2d(512, 512);
  ctx.fillStyle = '#8b8b8b';
  ctx.fillRect(0, 0, 512, 512);
  const random = mulberry32(20261);
  // Fine down-like texture.
  const image = ctx.getImageData(0, 0, 512, 512);
  for (let i = 0; i < image.data.length; i += 4) {
    const n = 128 + (random() - 0.5) * 28;
    image.data[i] = n;
    image.data[i + 1] = n;
    image.data[i + 2] = n;
  }
  ctx.putImageData(image, 0, 0);
  ctx.lineCap = 'round';
  for (let row = 0; row < 10; row++) {
    const y = row * 52 + 40;
    for (let col = -1; col < 10; col++) {
      const x = col * 56 + (row % 2) * 28;
      ctx.strokeStyle = 'rgba(44,44,44,.28)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 27, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(225,225,225,.26)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y - 4, 25, 0.14 * Math.PI, 0.86 * Math.PI);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(55,55,55,.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y - 2);
      ctx.lineTo(x, y - 18);
      ctx.stroke();
    }
  }
  return makeCanvasTexture(canvas, { srgb: false, repeat: [4, 3], anisotropy: 4 });
}

export function makeSandTexture() {
  const { canvas, ctx } = canvas2d(256, 256);
  const random = mulberry32(77821);
  const image = ctx.createImageData(256, 256);
  for (let i = 0; i < image.data.length; i += 4) {
    const n = 198 + random() * 42;
    image.data[i] = n + 14;
    image.data[i + 1] = n + 4;
    image.data[i + 2] = n - 12;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < 42; i++) {
    ctx.strokeStyle = random() > 0.5 ? '#f4ddb6' : '#7f6244';
    ctx.lineWidth = randomRange(random, 0.4, 1.4);
    ctx.beginPath();
    const y = random() * 256;
    ctx.moveTo(0, y);
    for (let x = 0; x <= 256; x += 16) {
      ctx.lineTo(x, y + Math.sin(x * 0.04 + i) * 2);
    }
    ctx.stroke();
  }
  return makeCanvasTexture(canvas, { repeat: [22, 22], anisotropy: 8 });
}

export function makeWickerTexture() {
  const { canvas, ctx } = canvas2d(256, 256);
  const random = mulberry32(9843);
  ctx.fillStyle = '#73502f';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 22) {
    for (let x = 0; x < 256; x += 22) {
      const even = ((x / 22 + y / 22) | 0) % 2 === 0;
      const grad = ctx.createLinearGradient(x, y, x + 22, y + 22);
      if (even) {
        grad.addColorStop(0, '#c4975f');
        grad.addColorStop(0.45, '#ad7f4c');
        grad.addColorStop(1, '#805a34');
      } else {
        grad.addColorStop(0, '#b88954');
        grad.addColorStop(1, '#664327');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(x + 1, y + 2, 20, 17);
      ctx.strokeStyle = 'rgba(55,32,14,.34)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, y + 2, 20, 17);
    }
  }
  for (let i = 0; i < 28; i++) {
    ctx.fillStyle = `rgba(50,28,12,${randomRange(random, 0.04, 0.16)})`;
    ctx.fillRect(0, random() * 256, 256, randomRange(random, 1, 4));
  }
  return makeCanvasTexture(canvas, { repeat: [2, 1], anisotropy: 4 });
}

export function makeGlowTexture(color = 'rgba(255,215,150,1)', softness = 0.15) {
  const { canvas, ctx } = canvas2d(128, 128);
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, color);
  gradient.addColorStop(softness, color);
  gradient.addColorStop(0.48, color.replace(/[\d.]+\)$/, '0.24)'));
  gradient.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function makePointTexture() {
  const { canvas, ctx } = canvas2d(64, 64);
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.3, 'rgba(255,244,208,.8)');
  gradient.addColorStop(1, 'rgba(255,214,150,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return makeCanvasTexture(canvas);
}

export function makeSignTexture({ top, middle, bottom, accent = '#f0a361' }) {
  const { canvas, ctx } = canvas2d(512, 320);
  ctx.fillStyle = '#163f3b';
  ctx.fillRect(0, 0, 512, 320);

  ctx.strokeStyle = 'rgba(244,235,215,.62)';
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, 476, 284);
  ctx.strokeStyle = 'rgba(244,235,215,.16)';
  ctx.lineWidth = 1;
  ctx.strokeRect(28, 28, 456, 264);

  ctx.fillStyle = accent;
  ctx.font = '600 21px "Avenir Next", "Helvetica Neue", sans-serif';
  ctx.letterSpacing = '5px';
  ctx.fillText(top, 48, 84);

  ctx.fillStyle = '#f2ead9';
  ctx.font = '400 58px "Bodoni 72", Didot, Baskerville, serif';
  ctx.fillText(middle, 45, 168);

  ctx.fillStyle = 'rgba(242,234,217,.62)';
  ctx.font = '400 18px "SFMono-Regular", Menlo, monospace';
  ctx.letterSpacing = '2px';
  ctx.fillText(bottom, 49, 222);

  ctx.strokeStyle = 'rgba(242,234,217,.28)';
  ctx.beginPath();
  ctx.moveTo(48, 252);
  ctx.lineTo(320, 252);
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(382, 269);
  ctx.lineTo(421, 248);
  ctx.lineTo(421, 290);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = accent;
  ctx.beginPath();
  ctx.moveTo(330, 269);
  ctx.lineTo(415, 269);
  ctx.stroke();

  return makeCanvasTexture(canvas, { anisotropy: 8 });
}

export function makeBadgeTexture(text) {
  const { canvas, ctx } = canvas2d(256, 128);
  ctx.fillStyle = '#e9ddc4';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#624d31';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, 240, 112);
  ctx.fillStyle = '#3b2c1d';
  ctx.font = '700 46px "Avenir Next", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, 128, 78);
  ctx.font = '500 14px "SFMono-Regular", monospace';
  ctx.fillText('PELICAN POINT', 128, 103);
  return makeCanvasTexture(canvas, { anisotropy: 4 });
}

export function createSkyEnvironment(hour, atmosphere) {
  const { canvas, ctx } = canvas2d(512, 256);
  const zenith = atmosphere.zenith.clone();
  const horizon = atmosphere.horizon.clone();
  const sunColor = atmosphere.sun.clone();
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, `#${zenith.getHexString()}`);
  gradient.addColorStop(0.48, `#${horizon.clone().lerp(zenith, 0.28).getHexString()}`);
  gradient.addColorStop(0.53, `#${horizon.getHexString()}`);
  gradient.addColorStop(0.7, `#${atmosphere.waterDeep.getHexString()}`);
  gradient.addColorStop(1, '#031012');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 256);

  const sunAngle = Math.atan2(atmosphere.sunDirection.z, atmosphere.sunDirection.x);
  const normalized = ((sunAngle + Math.PI) / TAU);
  const sunX = normalized * 512;
  const sunY = (0.5 - atmosphere.sunDirection.y * 0.46) * 256;
  const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 94);
  glow.addColorStop(0, `rgba(${Math.round(sunColor.r * 255)},${Math.round(sunColor.g * 255)},${Math.round(sunColor.b * 255)},1)`);
  glow.addColorStop(0.2, `rgba(${Math.round(sunColor.r * 255)},${Math.round(sunColor.g * 255)},${Math.round(sunColor.b * 255)},.44)`);
  glow.addColorStop(1, 'rgba(255,173,107,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 512, 256);

  const cloud = ctx.createLinearGradient(0, 80, 0, 138);
  cloud.addColorStop(0, 'rgba(255,211,174,.2)');
  cloud.addColorStop(0.5, 'rgba(255,221,189,.08)');
  cloud.addColorStop(1, 'rgba(255,211,174,0)');
  ctx.fillStyle = cloud;
  ctx.fillRect(0, 80, 512, 70);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.needsUpdate = true;
  return texture;
}

export function makeCylinderBetween(a, b, radius, material, radialSegments = 8, radiusTop = radius) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const length = dir.length();
  const geometry = new THREE.CylinderGeometry(radiusTop, radius, 1, radialSegments, 1, false);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  mesh.scale.y = length;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function orientCylinder(mesh, a, b) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const length = dir.length();
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
  mesh.scale.set(1, length, 1);
  return mesh;
}

export function twoBoneIK(root, target, lengthA, lengthB, pole, outElbow = new THREE.Vector3()) {
  const dir = new THREE.Vector3().subVectors(target, root);
  let dist = dir.length();
  const maxDist = lengthA + lengthB - 0.001;
  if (dist > maxDist) {
    dir.multiplyScalar(maxDist / dist);
    dist = maxDist;
  }
  if (dist < 0.001) {
    dir.set(0, -1, 0);
    dist = 0.001;
  }
  dir.normalize();
  const a = (lengthA * lengthA - lengthB * lengthB + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, lengthA * lengthA - a * a));
  const perpendicular = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir)));
  if (perpendicular.lengthSq() < 0.00001) {
    perpendicular.set(1, 0, 0).sub(dir.clone().multiplyScalar(dir.x));
  }
  perpendicular.normalize();
  outElbow.copy(root).addScaledVector(dir, a).addScaledVector(perpendicular, h);
  return {
    elbow: outElbow,
    end: root.clone().addScaledVector(dir, Math.min(dist, lengthA + lengthB)),
    reachable: dist <= maxDist + 0.01,
  };
}

export function setShadows(object, cast = true, receive = true) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = cast;
      child.receiveShadow = receive;
    }
  });
}

export function formatHour(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.round((hour % 1) * 60) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function phaseForHour(hour) {
  if (hour < 5.1) return 'NIGHT WATCH';
  if (hour < 7.2) return 'FIRST LIGHT';
  if (hour < 16.2) return 'DAYLIGHT';
  if (hour < 19.2) return 'GOLDEN HOUR';
  if (hour < 20.5) return 'BLUE HOUR';
  return 'NIGHT WATCH';
}

export function temperatureForHour(hour) {
  if (hour < 5) return '12°C';
  if (hour < 8) return '14°C';
  if (hour < 16) return '21°C';
  if (hour < 20) return '18°C';
  return '13°C';
}

export function hash11(n) {
  return fract(Math.sin(n * 127.1) * 43758.5453123);
}

function fract(v) {
  return v - Math.floor(v);
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 12000);
}

export function chooseMimeType() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

export function setupCanvasForTexture(texture) {
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}
