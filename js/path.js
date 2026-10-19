import * as THREE from 'three';

export const WALK_Y = 1.55;
export const WALK_WIDTH = 3.75;

const POINTS = [
  new THREE.Vector3(0.4, 0, 16.4),
  new THREE.Vector3(9.2, 0, 14.6),
  new THREE.Vector3(15.4, 0, 8.4),
  new THREE.Vector3(17.2, 0, -0.8),
  new THREE.Vector3(13.2, 0, -9.4),
  new THREE.Vector3(4.6, 0, -14.8),
  new THREE.Vector3(-5.2, 0, -14.2),
  new THREE.Vector3(-13.4, 0, -8.2),
  new THREE.Vector3(-16.2, 0, 1.4),
  new THREE.Vector3(-11.4, 0, 10.4),
];

export const boardwalkCurve = new THREE.CatmullRomCurve3(POINTS, true, 'catmullrom', 0.38);
boardwalkCurve.arcLengthDivisions = 1000;
export const pathLength = boardwalkCurve.getLength();

const _point = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _nextTangent = new THREE.Vector3();
const _lateral = new THREE.Vector3();

export function getPathFrame(t, out = {}) {
  const u = ((t % 1) + 1) % 1;
  _point.copy(boardwalkCurve.getPointAt(u));
  _tangent.copy(boardwalkCurve.getTangentAt(u)).setY(0).normalize();
  _lateral.set(-_tangent.z, 0, _tangent.x);
  out.u = u;
  out.position = (out.position || new THREE.Vector3()).copy(_point);
  out.position.y = WALK_Y;
  out.tangent = (out.tangent || new THREE.Vector3()).copy(_tangent);
  out.lateral = (out.lateral || new THREE.Vector3()).copy(_lateral);
  out.yaw = Math.atan2(-_tangent.z, _tangent.x);
  return out;
}

export function getYawAt(t) {
  const u = ((t % 1) + 1) % 1;
  _tangent.copy(boardwalkCurve.getTangentAt(u)).setY(0).normalize();
  return Math.atan2(-_tangent.z, _tangent.x);
}

export function getLeanAt(t, speed) {
  const u = ((t % 1) + 1) % 1;
  const eps = 0.012;
  _tangent.copy(boardwalkCurve.getTangentAt(u)).setY(0).normalize();
  _nextTangent.copy(boardwalkCurve.getTangentAt((u + eps) % 1)).setY(0).normalize();
  const cross = _tangent.x * _nextTangent.z - _tangent.z * _nextTangent.x;
  const dot = THREE.MathUtils.clamp(_tangent.dot(_nextTangent), -1, 1);
  const turn = Math.atan2(cross, dot);
  return THREE.MathUtils.clamp(turn * 10.5 * speed * 0.12, -0.23, 0.23);
}

export function getFrameAtOffset(t, lateralOffset = 0, yOffset = 0, out = new THREE.Vector3()) {
  getPathFrame(t, frameScratch);
  out.copy(frameScratch.position).addScaledVector(frameScratch.lateral, lateralOffset);
  out.y += yOffset;
  return out;
}

const frameScratch = {};

export const pathSamples = (() => {
  const samples = [];
  const count = 260;
  for (let i = 0; i < count; i++) {
    const u = i / count;
    const p = boardwalkCurve.getPointAt(u);
    samples.push(p.x, p.z);
  }
  return samples;
})();

export function distanceToPath(x, z) {
  let bestSq = Infinity;
  for (let i = 0; i < pathSamples.length; i += 2) {
    const dx = x - pathSamples[i];
    const dz = z - pathSamples[i + 1];
    const distSq = dx * dx + dz * dz;
    if (distSq < bestSq) bestSq = distSq;
  }
  return Math.sqrt(bestSq);
}
