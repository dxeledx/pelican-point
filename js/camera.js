import * as THREE from 'three';
import { clamp, damp, dampAngle, lerp } from './utils.js';

const UP = new THREE.Vector3(0, 1, 0);

const SHOTS = [
  {
    name: 'hero',
    yaw: -1.15,
    pitch: 0.12,
    dist: 5.7,
    fov: 46,
    lookAhead: 0.34,
    hold: 8.5,
    sunAware: true,
    sunSide: -0.27,
    framingX: 0.18,
  },
  {
    name: 'profile',
    yaw: -Math.PI * 0.5,
    pitch: 0.12,
    dist: 5.9,
    fov: 42,
    lookAhead: 0.7,
    hold: 8.0,
  },
  {
    name: 'bow',
    yaw: -Math.PI * 0.88,
    pitch: 0.1,
    dist: 4.4,
    fov: 51,
    lookAhead: 0.18,
    hold: 7.2,
  },
  {
    name: 'high',
    yaw: -Math.PI * 0.3,
    pitch: 0.34,
    dist: 7.3,
    fov: 41,
    lookAhead: 0.5,
    hold: 9.0,
  },
  {
    name: 'stern',
    yaw: Math.PI * 0.08,
    pitch: 0.2,
    dist: 4.7,
    fov: 48,
    lookAhead: 1.0,
    hold: 7.0,
  },
  {
    name: 'low',
    yaw: -Math.PI * 0.66,
    pitch: 0.055,
    dist: 3.9,
    fov: 53,
    lookAhead: 0.4,
    hold: 7.4,
  },
];

export class CameraDirector {
  constructor(camera, domElement, { reducedMotion = false } = {}) {
    this.camera = camera;
    this.dom = domElement;
    this.reducedMotion = reducedMotion;
    this.time = 0;
    this.started = false;
    this.cinema = false;

    this.yaw = -1.1;
    this.pitch = 0.125;
    this.dist = 7.7;
    this.targetFov = 42;
    this.framingX = 0.7;

    this.desiredYaw = this.yaw;
    this.desiredPitch = this.pitch;
    this.desiredDist = this.dist;
    this.desiredFov = this.targetFov;
    this.desiredFramingX = 0.7;

    this.target = new THREE.Vector3(0, 3.3, 15.2);
    this.smoothTarget = this.target.clone();
    this.forward = new THREE.Vector3(1, 0, 0);
    this.right = new THREE.Vector3(0, 0, 1);
    this.lean = 0;
    this.speed = 0;
    this.sunDirection = new THREE.Vector3(0.35, 0.09, -0.93).normalize();
    this.framingX = 0;
    this.framingY = 0;
    this.desiredFramingX = 0;
    this.desiredFramingY = 0;

    this.mode = 'intro';
    this.shotIndex = 0;
    this.nextShotAt = 0;
    this.manualUntil = 0;
    this.auto = true;

    this.inertiaYaw = 0;
    this.inertiaPitch = 0;
    this.dragging = false;
    this.pointers = new Map();
    this.lastPointer = { x: 0, y: 0 };
    this.pinchStart = 0;
    this.pinchCameraDist = this.dist;
    this.wheelStart = 0;
    this.shakeAmount = 0;
    this.shakeTime = 0;
    this.portraitFactor = 0;
    this._firstUpdate = true;

    this._boundPointerDown = this._onPointerDown.bind(this);
    this._boundPointerMove = this._onPointerMove.bind(this);
    this._boundPointerUp = this._onPointerUp.bind(this);
    this._boundWheel = this._onWheel.bind(this);
    this._boundDoubleClick = this._onDoubleClick.bind(this);

    domElement.addEventListener('pointerdown', this._boundPointerDown);
    domElement.addEventListener('pointermove', this._boundPointerMove);
    domElement.addEventListener('pointerup', this._boundPointerUp);
    domElement.addEventListener('pointercancel', this._boundPointerUp);
    domElement.addEventListener('wheel', this._boundWheel, { passive: false });
    domElement.addEventListener('dblclick', this._boundDoubleClick);

    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
    this._targetDesired = new THREE.Vector3();
    this._desiredCamera = new THREE.Vector3();
    this._lookAt = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._viewDir = new THREE.Vector3();
    this._screenRight = new THREE.Vector3();
    this._lookTarget = new THREE.Vector3();
    this._composeScratch = new THREE.Vector3();
  }

  setIntroShot(snap = true) {
    this.mode = 'intro';
    this.desiredYaw = -1.1;
    this.desiredPitch = 0.125;
    this.desiredDist = 7.7;
    this.desiredFov = 42;
    this.manualUntil = 0;
    this.auto = true;
    this.desiredFramingX = 0.7;
    this.desiredFramingY = 0.0;
    if (snap) {
      this.yaw = this.desiredYaw;
      this.pitch = this.desiredPitch;
      this.dist = this.desiredDist;
      this.targetFov = this.desiredFov;
    }
  }

  startRide() {
    this.started = true;
    this.mode = 'director';
    this.shotIndex = 0;
    this.nextShotAt = this.time + SHOTS[0].hold;
    this.auto = true;
    this.desiredFramingX = 0;
    this.desiredFramingY = 0;
    this._applyShot(SHOTS[0]);
  }

  setCinema(enabled) {
    this.cinema = enabled;
    if (enabled) {
      this.mode = 'director';
      this.auto = true;
      this._applyShot(SHOTS[0]);
      this.desiredFramingX = 0;
      this.nextShotAt = this.time + 13;
    } else {
      this.auto = true;
      this.manualUntil = this.time + 4;
    }
  }

  resetDirector() {
    this.auto = true;
    this.manualUntil = 0;
    this.mode = 'director';
    this.inertiaYaw = 0;
    this.inertiaPitch = 0;
    this.shotIndex = 0;
    this._applyShot(SHOTS[0]);
    this.desiredFramingX = 0;
    this.nextShotAt = this.time + SHOTS[0].hold;
    if (this.onReset) this.onReset();
  }

  _applyShot(shot) {
    this.desiredYaw = shot.yaw;
    this.desiredPitch = shot.pitch;
    this.desiredDist = shot.dist;
    this.desiredFov = shot.fov;
    this.desiredFramingX = shot.framingX ?? 0;
    this.currentShot = shot;
  }

  setLookAtRig(position, forward, right, lean, speed, sunDirection = null) {
    this.targetPosition = position;
    this.forward.copy(forward).setY(0).normalize();
    this.right.copy(right).setY(0).normalize();
    this.lean = lean;
    this.speed = speed;
    if (sunDirection) this.sunDirection.copy(sunDirection).normalize();
  }

  _getSunAwareYaw(side = 0) {
    const sx = this.sunDirection.x;
    const sz = this.sunDirection.z;
    const len = Math.hypot(sx, sz);
    if (len < 0.08) return this.desiredYaw;
    const nx = -sx / len;
    const nz = -sz / len;
    const px = -sz / len;
    const pz = sx / len;
    let ox = nx + px * side;
    let oz = nz + pz * side;
    const olen = Math.max(0.0001, Math.hypot(ox, oz));
    ox /= olen;
    oz /= olen;
    return Math.atan2(
      ox * this.right.x + oz * this.right.z,
      -(ox * this.forward.x + oz * this.forward.z)
    );
  }

  shake(amount = 1) {
    if (this.reducedMotion) return;
    this.shakeAmount = Math.min(1.2, this.shakeAmount + amount);
    this.shakeTime = 0;
  }

  _manualInteraction() {
    this.manualUntil = this.time + 18;
    this.auto = false;
    this.inertiaYaw = 0;
    this.inertiaPitch = 0;
  }

  _onPointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (this._isUiTarget(event)) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointers.size === 1) {
      this.dragging = true;
      this.lastPointer.x = event.clientX;
      this.lastPointer.y = event.clientY;
      this._manualInteraction();
      this.dom.classList.add('is-dragging');
      if (this.dom.setPointerCapture) this.dom.setPointerCapture(event.pointerId);
    } else if (this.pointers.size === 2) {
      this.dragging = false;
      this.pinchStart = this._pointerDistance();
      this.pinchCameraDist = this.desiredDist;
    }
  }

  _onPointerMove(event) {
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pointers.size === 2) {
      const dist = this._pointerDistance();
      if (this.pinchStart > 0) {
        this.desiredDist = clamp(this.pinchCameraDist * (this.pinchStart / Math.max(1, dist)), 2.7, 17);
        this.manualUntil = this.time + 18;
      }
      return;
    }

    if (!this.dragging) return;
    const dx = event.clientX - this.lastPointer.x;
    const dy = event.clientY - this.lastPointer.y;
    this.lastPointer.x = event.clientX;
    this.lastPointer.y = event.clientY;
    if (this._isUiTarget(event)) return;

    this.inertiaYaw = -dx * 0.0048;
    this.inertiaPitch = dy * 0.0032;
    this.desiredYaw -= dx * 0.0064;
    this.desiredPitch = clamp(this.desiredPitch + dy * 0.0042, 0.015, 1.03);
    this.manualUntil = this.time + 18;
    this.auto = false;
  }

  _onPointerUp(event) {
    this.pointers.delete(event.pointerId);
    if (this.pointers.size < 2) this.pinchStart = 0;
    if (this.pointers.size === 0) {
      this.dragging = false;
      this.dom.classList.remove('is-dragging');
      if (this.dom.releasePointerCapture && this.dom.hasPointerCapture?.(event.pointerId)) {
        try {
          this.dom.releasePointerCapture(event.pointerId);
        } catch {
          /* no-op */
        }
      }
    }
  }

  _onWheel(event) {
    if (this._isUiTarget(event)) return;
    event.preventDefault();
    this.desiredDist = clamp(this.desiredDist * Math.exp(event.deltaY * 0.00095), 2.7, 17);
    this.desiredPitch = clamp(this.desiredPitch + event.deltaY * 0.00012, 0.015, 1.03);
    this.manualUntil = this.time + 18;
    this.auto = false;
  }

  _onDoubleClick(event) {
    if (this._isUiTarget(event)) return;
    event.preventDefault();
    this.resetDirector();
  }

  _pointerDistance() {
    const values = Array.from(this.pointers.values());
    if (values.length < 2) return 0;
    return Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
  }

  _isUiTarget(event) {
    return Boolean(event.target && event.target.closest && event.target.closest('button, input, dialog'));
  }

  update(dt, time, position) {
    this.time = time;
    if (this.mode === 'intro') {
      const drift = this.reducedMotion ? 0 : Math.sin(time * 0.065) * 0.16;
      if (this.auto) this.desiredYaw = this._getSunAwareYaw(-0.32) + drift;
      this.desiredPitch = 0.125 + Math.sin(time * 0.043) * 0.015;
      this.desiredDist = 7.7 + Math.sin(time * 0.037) * 0.26;
      this.desiredFramingX = 0.7;
    } else if (this.started) {
      if (!this.auto && time > this.manualUntil) {
        this.auto = true;
        this.shotIndex = (this.shotIndex + 1) % SHOTS.length;
        this._applyShot(SHOTS[this.shotIndex]);
        this.nextShotAt = time + (SHOTS[this.shotIndex].hold || 8);
      }
      if (this.auto && time > this.nextShotAt) {
        this.shotIndex = (this.shotIndex + 1) % SHOTS.length;
        this._applyShot(SHOTS[this.shotIndex]);
        this.nextShotAt = time + (this.cinema ? (SHOTS[this.shotIndex].hold || 8) * 1.35 : SHOTS[this.shotIndex].hold);
      }
      if (this.auto && this.currentShot?.sunAware) {
        this.desiredYaw = this._getSunAwareYaw(this.currentShot.sunSide ?? 0);
      }
      if (!this.dragging && Math.abs(this.inertiaYaw) + Math.abs(this.inertiaPitch) > 0.00008) {
        this.desiredYaw += this.inertiaYaw * dt * 13;
        this.desiredPitch = clamp(this.desiredPitch + this.inertiaPitch * dt * 13, 0.015, 1.03);
        const decay = Math.exp(-2.8 * dt);
        this.inertiaYaw *= decay;
        this.inertiaPitch *= decay;
      }
    }

    const aspect = this.camera.aspect || 1.6;
    const portraitTarget = clamp((1.18 - aspect) / 0.7, 0, 1);
    this.portraitFactor = damp(this.portraitFactor, portraitTarget, 2.4, dt);
    const portraitDistance = 1 + this.portraitFactor * 0.55;
    const portraitFraming = 1 - this.portraitFactor * 0.43;

    this.yaw = dampAngle(this.yaw, this.desiredYaw, 4.0, dt);
    this.pitch = damp(this.pitch, this.desiredPitch, 4.0, dt);
    this.dist = damp(this.dist, this.desiredDist * portraitDistance, 3.4, dt);
    this.framingX = damp(this.framingX, this.desiredFramingX * portraitFraming, 2.2, dt);
    this.framingY = damp(this.framingY, this.desiredFramingY * portraitFraming, 2.2, dt);
    const speedLift = clamp((this.speed - 3.5) * 0.35, 0, 3);
    this.targetFov = damp(this.targetFov, this.desiredFov + speedLift, 2.6, dt);

    this._targetDesired.copy(position);
    this._targetDesired.y += 1.76;
    const ahead = (this.currentShot?.lookAhead ?? 0.35) * (1 + this.portraitFactor * 0.65);
    this._targetDesired.addScaledVector(this.forward, ahead);

    this.smoothTarget.lerp(this._targetDesired, 1 - Math.exp(-7.5 * dt));
    if (this._firstUpdate) this.smoothTarget.copy(this._targetDesired);

    const cosPitch = Math.cos(this.pitch);
    const sinPitch = Math.sin(this.pitch);
    const backX = -Math.cos(this.yaw) * cosPitch;
    const sideX = Math.sin(this.yaw) * cosPitch;

    this._desiredCamera.copy(this.smoothTarget);
    this._desiredCamera.x += (this.forward.x * backX + this.right.x * sideX) * this.dist;
    this._desiredCamera.z += (this.forward.z * backX + this.right.z * sideX) * this.dist;
    this._desiredCamera.y += sinPitch * this.dist;

    this._desiredCamera.y = Math.max(this._desiredCamera.y, 1.78);

    if (!this.reducedMotion) {
      const breathe = time * 0.5;
      this._desiredCamera.x += Math.sin(breathe * 0.9) * 0.018;
      this._desiredCamera.y += Math.cos(breathe * 0.7) * 0.012;
    }

    if (this.shakeAmount > 0.001) {
      this.shakeTime += dt;
      const strength = this.shakeAmount * 0.05;
      this._desiredCamera.x += Math.sin(this.shakeTime * 47) * strength;
      this._desiredCamera.y += Math.cos(this.shakeTime * 57) * strength * 0.7;
      this._desiredCamera.z += Math.sin(this.shakeTime * 38) * strength * 0.4;
      this.shakeAmount *= Math.exp(-4.2 * dt);
    }

    if (this._firstUpdate) {
      this.camera.position.copy(this._desiredCamera);
      this._firstUpdate = false;
    } else {
      this.camera.position.lerp(this._desiredCamera, 1 - Math.exp(-8.8 * dt));
    }

    this._lookAt.copy(this.smoothTarget);
    this._lookAt.y += this.cinema ? 0.08 : 0;
    if (Math.abs(this.framingX) > 0.001 || Math.abs(this.framingY) > 0.001) {
      this._viewDir.copy(this._lookAt).sub(this.camera.position).normalize();
      this._screenRight.crossVectors(this._viewDir, UP).normalize();
      this._lookAt.addScaledVector(this._screenRight, -this.framingX);
      this._lookAt.y += this.framingY;
    }
    this.camera.lookAt(this._lookAt);

    const roll = clamp(-this.lean * 0.36 + this.inertiaYaw * 0.5, -0.035, 0.035);
    this.camera.rotateZ(roll);

    if (Math.abs(this.camera.fov - this.targetFov) > 0.01) {
      this.camera.fov = this.targetFov;
      this.camera.updateProjectionMatrix();
    }
  }

  resize() {
    /* Projection is updated by main. */
  }

  dispose() {
    this.dom.removeEventListener('pointerdown', this._boundPointerDown);
    this.dom.removeEventListener('pointermove', this._boundPointerMove);
    this.dom.removeEventListener('pointerup', this._boundPointerUp);
    this.dom.removeEventListener('pointercancel', this._boundPointerUp);
    this.dom.removeEventListener('wheel', this._boundWheel);
    this.dom.removeEventListener('dblclick', this._boundDoubleClick);
  }
}

export { SHOTS };
