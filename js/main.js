import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { World } from './world.js';
import { Bicycle } from './bicycle.js';
import { Pelican } from './pelican.js';
import { CameraDirector } from './camera.js';
import { Soundscape } from './audio.js';
import { getLeanAt, getPathFrame, pathLength } from './path.js';
import {
  chooseMimeType,
  clamp,
  damp,
  downloadBlob,
  formatHour,
  phaseForHour,
  temperatureForHour,
} from './utils.js';

/* ------------------------------------------------------------------ */
/* DOM                                                                 */
/* ------------------------------------------------------------------ */

const dom = {
  canvas: document.querySelector('#scene'),
  loader: document.querySelector('#loader'),
  loaderStatus: document.querySelector('#loaderStatus'),
  loaderPct: document.querySelector('#loaderPct'),
  loaderBar: document.querySelector('#loaderBar'),
  intro: document.querySelector('#intro'),
  startBtn: document.querySelector('#startBtn'),
  hud: document.querySelector('#hud'),
  soundBtn: document.querySelector('#soundBtn'),
  photoBtn: document.querySelector('#photoBtn'),
  filmBtn: document.querySelector('#filmBtn'),
  cinemaBtn: document.querySelector('#cinemaBtn'),
  fullBtn: document.querySelector('#fullBtn'),
  helpBtn: document.querySelector('#helpBtn'),
  closeHelp: document.querySelector('#closeHelp'),
  dialogSoundBtn: document.querySelector('#dialogSoundBtn'),
  helpDialog: document.querySelector('#helpDialog'),
  cinemaExit: document.querySelector('#cinemaExit'),
  timeSlider: document.querySelector('#timeSlider'),
  clock: document.querySelector('#clock'),
  temp: document.querySelector('#temp'),
  timePhase: document.querySelector('#timePhase'),
  weatherLabel: document.querySelector('#weatherLabel'),
  speedValue: document.querySelector('#speedValue'),
  gear: document.querySelector('#gear'),
  cadence: document.querySelector('#cadence'),
  rideState: document.querySelector('#rideState'),
  dialArc: document.querySelector('#dialArc'),
  recBadge: document.querySelector('#recBadge'),
  recTime: document.querySelector('#recTime'),
  photoFlash: document.querySelector('#photoFlash'),
  filmFlash: document.querySelector('#filmFlash'),
  toast: document.querySelector('#toast'),
  touchButtons: Array.from(document.querySelectorAll('[data-touch]')),
};

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isCoarse = window.matchMedia('(hover: none), (pointer: coarse)').matches;
const params = new URLSearchParams(window.location.search);
const initialQuality = params.get('quality') || (isCoarse || window.innerWidth < 800 ? 'medium' : 'high');
const queryHour = params.has('hour') ? clamp(Number(params.get('hour')), 0, 24) : 18.6;
const queryAutostart = params.get('ride') === '1';
const queryNoUi = params.get('noui') === '1';

const QUALITY = ['low', 'medium', 'high'].includes(initialQuality) ? initialQuality : 'high';
const MAX_DPR = QUALITY === 'high' ? 2 : QUALITY === 'medium' ? 1.5 : 1.05;

const sound = new Soundscape();
const state = {
  started: false,
  speed: 0,
  targetSpeed: 4.2,
  progress: 0.33,
  lane: 0,
  laneTarget: 0,
  steer: 0,
  lean: 0,
  pitch: 0,
  hop: 0,
  velocityY: 0,
  grounded: true,
  air: 0,
  jumpQueued: false,
  hour: queryHour,
  recording: false,
  pressedBoost: false,
  pressedBrake: false,
  pressedLeft: false,
  pressedRight: false,
};

const held = new Set();
const pathFrame = { position: new THREE.Vector3(), tangent: new THREE.Vector3(), lateral: new THREE.Vector3() };
const pointerState = { startX: 0, startY: 0, lastX: 0, lastY: 0, moved: 0, down: false, downTime: 0, multi: false };

let renderer;
let scene;
let camera;
let world;
let bike;
let pelican;
let director;
let composer;
let bloomPass;
let gradePass;
let poseGroup;
let tiltGroup;
let ready = false;
let animationHandle = 0;
let lastFrame = performance.now();
let elapsed = 0;
let uiTimer = 0;
let renderedFrames = 0;
let renderPixelRatio = 1;
let toastTimer = 0;
let recordingRecorder = null;
let recordingChunks = [];
let recordingStopTimer = 0;
let recordingTick = 0;
let recordingStartedAt = 0;
let recordingStream = null;
let lastActionToast = 0;
let lastFrameSample = { time: 0, frames: 0, degraded: false };
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();

const PostGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uVignette: { value: 0.42 },
    uGrain: { value: 0.55 },
    uAberration: { value: 0.0012 },
    uSaturation: { value: 1.07 },
    uContrast: { value: 1.025 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uAberration;
    uniform float uSaturation;
    uniform float uContrast;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(234.34, 435.345));
      p += dot(p, p + 34.23);
      return fract(p.x * p.y);
    }

    void main() {
      vec2 uv = vUv;
      vec2 center = uv - 0.5;
      float radial = length(center * vec2(1.0, 0.8));
      vec2 aberration = normalize(center + vec2(0.00001)) * uAberration * radial;
      vec3 color;
      color.r = texture2D(tDiffuse, uv + aberration).r;
      color.g = texture2D(tDiffuse, uv).g;
      color.b = texture2D(tDiffuse, uv - aberration).b;

      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(luma), color, uSaturation);
      color = (color - 0.5) * uContrast + 0.5;

      float vignette = smoothstep(1.1, 0.26, radial * 1.3);
      color *= mix(1.0, vignette, uVignette);

      float grain = hash(uv * uResolution + fract(uTime) * 173.0) - 0.5;
      color += grain * 0.008 * uGrain;
      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function setLoader(percent, label) {
  if (!dom.loader) return;
  dom.loaderBar.style.width = `${clamp(percent, 0, 100)}%`;
  dom.loaderPct.textContent = String(Math.round(percent)).padStart(2, '0');
  if (label) dom.loaderStatus.textContent = label;
}

function showToast(message, duration = 2800) {
  window.clearTimeout(toastTimer);
  dom.toast.textContent = message;
  dom.toast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => dom.toast.classList.remove('is-visible'), duration);
}

function vibrate(duration = 10) {
  if (navigator.vibrate) navigator.vibrate(duration);
}

function applySoundUI() {
  const audible = sound.active && !sound.muted;
  if (dom.soundBtn) {
    dom.soundBtn.classList.toggle('is-muted', !audible);
    dom.soundBtn.classList.toggle('is-on', audible);
    dom.soundBtn.setAttribute('aria-label', audible ? '静音' : '开启声音');
    dom.soundBtn.setAttribute('aria-pressed', String(audible));
  }
  if (dom.dialogSoundBtn) {
    dom.dialogSoundBtn.textContent = audible ? '声音：开启' : '声音：静音';
  }
}

function updateTimeLabels() {
  const hour = state.hour;
  const formatted = formatHour(hour);
  const phase = phaseForHour(hour);
  if (dom.clock) dom.clock.textContent = formatted;
  if (dom.timePhase) dom.timePhase.textContent = phase;
  if (dom.weatherLabel) dom.weatherLabel.textContent = phase;
  if (dom.temp) dom.temp.textContent = temperatureForHour(hour);
  if (dom.timeSlider) {
    dom.timeSlider.value = String(hour);
    dom.timeSlider.style.setProperty('--fill', `${(hour / 24) * 100}%`);
    dom.timeSlider.setAttribute('aria-valuetext', `${formatted}，${phase}`);
  }
}

function syncNight() {
  if (!world || !bike || !pelican) return;
  bike.setNight(world.getNightFactor());
  pelican.setNight(world.getNightFactor());
}

function setHour(hour) {
  if (!world) return;
  state.hour = clamp(hour, 0, 24);
  world.setTimeOfDay(state.hour);
  syncNight();
  updateTimeLabels();
}

/* ------------------------------------------------------------------ */
/* Scene setup                                                         */
/* ------------------------------------------------------------------ */

function setupRenderer() {
  renderer = new THREE.WebGLRenderer({
    canvas: dom.canvas,
    antialias: false,
    alpha: false,
    stencil: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
  renderPixelRatio = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  renderer.setPixelRatio(renderPixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x071a1b, 1);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.06, 1500);
  camera.position.set(5, 7, 20);
}

function setupWorld() {
  world = new World(scene, renderer, {
    reducedMotion: prefersReducedMotion,
    quality: QUALITY,
  });
  world.setTimeOfDay(state.hour, true);
}

function setupRider() {
  poseGroup = new THREE.Group();
  poseGroup.name = 'rider-pose';
  tiltGroup = new THREE.Group();
  tiltGroup.name = 'rider-lean';
  tiltGroup.rotation.order = 'ZXY';
  poseGroup.add(tiltGroup);
  scene.add(poseGroup);

  bike = new Bicycle();
  pelican = new Pelican(bike);
  pelican.onHonk = () => {
    sound.honk();
    vibrate(12);
  };
  tiltGroup.add(bike.group, pelican.group);

  bike.bell.traverse((child) => {
    if (child.isMesh) child.userData.action = 'bell';
  });
  bike.fishGroup.traverse((child) => {
    if (child.isMesh) child.userData.action = 'fish';
  });

  getPathFrame(state.progress, pathFrame);
  poseGroup.position.copy(pathFrame.position);
  poseGroup.rotation.y = pathFrame.yaw;
  renderer.shadowMap.needsUpdate = true;

  bike.update(0.016, 0, {
    speed: state.speed,
    steer: 0,
    braking: false,
    airborne: false,
  });
  pelican.update(0.016, 0, {
    speed: state.speed,
    steer: 0,
    air: 0,
    hop: 0,
  });
  syncNight();
}

function setupCamera() {
  director = new CameraDirector(camera, renderer.domElement, {
    reducedMotion: prefersReducedMotion,
  });
  director.setIntroShot(true);
  director.setLookAtRig(poseGroup.position, pathFrame.tangent, pathFrame.lateral, 0, 0, world.sunDirection);
  director.update(0.016, 0, poseGroup.position);
}

function setupComposer() {
  composer = new EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(window.innerWidth, window.innerHeight);
  const samples = QUALITY === 'high' ? 4 : QUALITY === 'medium' ? 2 : 0;
  composer.renderTarget1.samples = samples;
  composer.renderTarget2.samples = samples;
  composer.addPass(new RenderPass(scene, camera));

  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    QUALITY === 'high' ? 0.3 : 0.24,
    0.62,
    1.0
  );
  composer.addPass(bloomPass);

  gradePass = new ShaderPass(PostGradeShader);
  gradePass.material.uniforms.uResolution.value.set(
    window.innerWidth * renderPixelRatio,
    window.innerHeight * renderPixelRatio
  );
  composer.addPass(gradePass);
  composer.addPass(new OutputPass());
}

/* ------------------------------------------------------------------ */
/* Ride simulation                                                     */
/* ------------------------------------------------------------------ */

function updateRig(dt, time) {
  if (!bike || !pelican) return;
  const canControl = state.started;
  state.pressedBoost = canControl && (held.has('ShiftLeft') || held.has('ShiftRight'));
  state.pressedBrake = canControl && (held.has('KeyS') || held.has('ArrowDown'));
  state.pressedLeft = canControl && (held.has('KeyA') || held.has('ArrowLeft'));
  state.pressedRight = canControl && (held.has('KeyD') || held.has('ArrowRight'));
  const forward = canControl && (held.has('KeyW') || held.has('ArrowUp'));

  let targetSpeed = state.started ? 4.25 : 0;
  if (state.pressedBrake) targetSpeed = 0.6;
  else if (forward) targetSpeed = state.pressedBoost ? 9.0 : 6.45;
  else if (state.pressedBoost) targetSpeed = 5.2;
  if (state.recording) targetSpeed = Math.min(targetSpeed, 5.2);
  state.targetSpeed = targetSpeed;
  state.speed = damp(state.speed, targetSpeed, targetSpeed > state.speed ? 0.9 : 1.4, dt);
  if (state.speed < 0.015) state.speed = 0;

  const steerInput = (state.pressedRight ? 1 : 0) - (state.pressedLeft ? 1 : 0);
  state.steer = damp(state.steer, steerInput, 5, dt);
  state.laneTarget = clamp(
    state.laneTarget + steerInput * dt * (0.72 + state.speed * 0.035),
    -1.0,
    1.0
  );
  if (!steerInput) state.laneTarget = damp(state.laneTarget, 0, 0.7, dt);
  state.lane = damp(state.lane, state.laneTarget, 3.6, dt);

  if (state.jumpQueued && state.grounded && state.started) {
    state.jumpQueued = false;
    state.grounded = false;
    state.velocityY = 5.2;
    state.hop = 0.01;
    pelican.flap();
    director?.shake(0.12);
    vibrate(14);
  }
  if (!state.grounded) {
    state.velocityY -= 14.2 * dt;
    state.hop += state.velocityY * dt;
    if (state.hop <= 0) {
      state.hop = 0;
      state.velocityY = 0;
      state.grounded = true;
      director?.shake(0.5);
      vibrate(18);
    }
  }
  state.air = state.grounded ? 0 : clamp(state.hop / 1.25, 0, 1);

  state.progress = ((state.progress + (state.speed * dt) / pathLength) % 1 + 1) % 1;
  getPathFrame(state.progress, pathFrame);

  const pathLean = -getLeanAt(state.progress, state.speed);
  const laneLean = (state.laneTarget - state.lane) * 0.45;
  const steeringLean = state.steer * 0.075;
  state.lean = damp(state.lean, clamp(pathLean + laneLean + steeringLean, -0.3, 0.3), 3.8, dt);
  state.pitch = damp(state.pitch, clamp((targetSpeed - state.speed) * 0.003, -0.018, 0.018) + state.air * 0.022, 5, dt);

  poseGroup.position.copy(pathFrame.position).addScaledVector(pathFrame.lateral, state.lane);
  poseGroup.position.y += state.hop;
  poseGroup.rotation.y = pathFrame.yaw;
  tiltGroup.rotation.x = state.lean;
  tiltGroup.rotation.z = state.pitch;
  poseGroup.updateMatrixWorld(true);

  bike.update(dt, time, {
    speed: state.speed,
    steer: state.steer,
    braking: state.pressedBrake,
    airborne: !state.grounded,
    leanInput: state.steer,
  });
  pelican.update(dt, time, {
    speed: state.speed,
    steer: state.steer,
    air: state.air,
    hop: state.hop,
  });

  if (director) {
    const celestial = world.sunDirection.y > 0.01 ? world.sunDirection : world.moonDirection;
    director.setLookAtRig(poseGroup.position, pathFrame.tangent, pathFrame.lateral, state.lean, state.speed, celestial);
    director.update(dt, time, poseGroup.position);
  }
}

function updateUI(dt) {
  uiTimer += dt;
  if (uiTimer < 0.1) return;
  uiTimer = 0;
  const kmh = state.speed * 3.6;
  const displayed = Math.round(kmh);
  if (dom.speedValue) dom.speedValue.textContent = String(displayed).padStart(2, '0').replace(/^0(?=\d)/, '');
  const cadence = Math.round(clamp(52 + state.speed * 4.5, 42, 108));
  if (dom.cadence) dom.cadence.textContent = String(cadence);
  const gear = state.speed > 7 ? 3 : state.speed > 4.7 ? 2 : 1;
  if (dom.gear) dom.gear.textContent = String(gear);
  if (dom.dialArc) {
    const dash = (clamp(kmh / 36, 0, 1) * 292).toFixed(1);
    dom.dialArc.style.strokeDasharray = `${dash} 999`;
  }
  if (dom.rideState) {
    let label = 'CRUISING';
    if (!state.grounded) label = 'AIRBORNE';
    else if (!state.started) label = 'DREAMING';
    else if (state.pressedBrake) label = 'SLOWING';
    else if (state.pressedBoost && state.speed > 6.2) label = 'SPRINTING';
    else if (state.speed < 1.1) label = 'COASTING';
    dom.rideState.textContent = label;
  }
}

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */

function ignoreGameInput(event) {
  if (dom.helpDialog?.open) return true;
  const target = event.target;
  if (!target) return false;
  if (target.isContentEditable) return true;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return true;
  if (event.code === 'Space' && target.closest?.('button')) return true;
  return false;
}

function ringBell() {
  if (!state.started) return;
  bike.ringBell();
  sound.bell();
  vibrate(16);
  if (performance.now() - lastActionToast > 2400) {
    lastActionToast = performance.now();
    showToast('叮。海风也听见了。');
  }
}

function honkPelican() {
  if (!state.started) return;
  pelican.honk();
  if (performance.now() - lastActionToast > 2600) {
    lastActionToast = performance.now();
    showToast('嘎。鹈鹕对此不置可否。');
  }
}

function queueJump() {
  if (!state.started) return;
  if (state.grounded) state.jumpQueued = true;
}

function onKeyDown(event) {
  if (ignoreGameInput(event)) return;
  const code = event.code;
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  if (!state.started) {
    if (code === 'Space' || code === 'Enter') {
      event.preventDefault();
      startExperience();
      return;
    }
  }

  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(code)) {
    event.preventDefault();
  }

  if (held.has(code) && ['KeyB', 'KeyH', 'KeyC', 'KeyP'].includes(code)) return;
  held.add(code);

  if (code === 'KeyB' && !event.repeat) ringBell();
  if (code === 'KeyH' && !event.repeat) honkPelican();
  if (code === 'Space' && !event.repeat) queueJump();
  if (code === 'KeyC' && !event.repeat) toggleCinema();
  if (code === 'KeyP' && !event.repeat) capturePhoto();
  if (code === 'KeyM' && !event.repeat) toggleSound();
  if (code === 'Escape' && !event.repeat && document.body.classList.contains('is-cinema')) {
    toggleCinema(false);
  }
}

function onKeyUp(event) {
  held.delete(event.code);
}

function setupInput() {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => held.clear());

  dom.startBtn?.addEventListener('click', () => startExperience());
  dom.soundBtn?.addEventListener('click', () => {
    dom.soundBtn.blur();
    toggleSound();
  });
  dom.photoBtn?.addEventListener('click', () => {
    dom.photoBtn.blur();
    capturePhoto();
  });
  dom.filmBtn?.addEventListener('click', () => {
    dom.filmBtn.blur();
    toggleRecording();
  });
  dom.cinemaBtn?.addEventListener('click', () => {
    dom.cinemaBtn.blur();
    toggleCinema();
  });
  dom.cinemaExit?.addEventListener('click', () => toggleCinema(false));
  dom.fullBtn?.addEventListener('click', () => {
    dom.fullBtn.blur();
    toggleFullscreen();
  });
  dom.helpBtn?.addEventListener('click', () => {
    dom.helpBtn.blur();
    openHelp();
  });
  dom.closeHelp?.addEventListener('click', () => dom.helpDialog.close());
  dom.helpDialog?.addEventListener('click', (event) => {
    if (event.target === dom.helpDialog) dom.helpDialog.close();
  });
  dom.dialogSoundBtn?.addEventListener('click', () => toggleSound());

  dom.timeSlider?.addEventListener('input', (event) => {
    setHour(Number(event.target.value));
  });
  dom.timeSlider?.addEventListener('change', (event) => {
    setHour(Number(event.target.value));
  });

  dom.canvas.addEventListener('pointerdown', onCanvasPointerDown);
  dom.canvas.addEventListener('pointermove', onCanvasPointerMove);
  dom.canvas.addEventListener('pointerup', onCanvasPointerUp);
  dom.canvas.addEventListener('pointercancel', onCanvasPointerUp);

  for (const button of dom.touchButtons) {
    const action = button.dataset.touch;
    if (!action) continue;
    const press = (event) => {
      event.preventDefault();
      button.classList.add('is-pressed');
      if (action === 'bell') ringBell();
      else if (action === 'jump') queueJump();
      else if (action === 'left') {
        state.pressedLeft = true;
        held.add('KeyA');
      } else if (action === 'right') {
        state.pressedRight = true;
        held.add('KeyD');
      }
    };
    const release = (event) => {
      event?.preventDefault?.();
      button.classList.remove('is-pressed');
      if (action === 'left') held.delete('KeyA');
      if (action === 'right') held.delete('KeyD');
    };
    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('pointerleave', (event) => {
      if (event.buttons) release(event);
    });
  }

  document.addEventListener('fullscreenchange', updateFullscreenUI);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('resize', () => {
    window.clearTimeout(onResize.timeout);
    onResize.timeout = window.setTimeout(onResize, 120);
  });

  dom.canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    showToast('显卡需要歇一会儿。正在等待海面重新出现。', 5000);
  });
  dom.canvas.addEventListener('webglcontextrestored', () => {
    showToast('海面回来了。');
  });
}

function onCanvasPointerDown(event) {
  pointerState.down = true;
  pointerState.downTime = performance.now();
  pointerState.startX = event.clientX;
  pointerState.startY = event.clientY;
  pointerState.lastX = event.clientX;
  pointerState.lastY = event.clientY;
  pointerState.moved = 0;
  pointerState.multi = event.pointerType === 'touch';
}

function onCanvasPointerMove(event) {
  if (!pointerState.down) return;
  pointerState.moved = Math.max(
    pointerState.moved,
    Math.hypot(event.clientX - pointerState.startX, event.clientY - pointerState.startY)
  );
}

function onCanvasPointerUp(event) {
  if (!pointerState.down) return;
  pointerState.down = false;
  if (!state.started) return;
  if (pointerState.moved > 7) return;
  if (performance.now() - pointerState.downTime > 700) return;
  if (event.pointerType === 'touch' && event.isPrimary === false) return;
  handleCanvasClick(event.clientX, event.clientY);
}

function handleCanvasClick(clientX, clientY) {
  if (!camera || !pelican || !bike) return;
  const rect = dom.canvas.getBoundingClientRect();
  pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNdc, camera);
  const hits = raycaster.intersectObjects([pelican.group, bike.group], true);
  let action = null;
  for (const hit of hits) {
    if (hit.object.userData?.action) {
      action = hit.object.userData.action;
      break;
    }
  }
  if (action === 'bell') {
    ringBell();
  } else if (action === 'fish') {
    sound.pluck(880);
    showToast('那条鱼假装自己是一根法棍。');
    vibrate(10);
  } else if (action === 'honk' || hits.length) {
    honkPelican();
  }
}

/* ------------------------------------------------------------------ */
/* Experience / UX                                                     */
/* ------------------------------------------------------------------ */

async function startExperience({ withSound = true } = {}) {
  if (state.started || !ready) return;
  state.started = true;
  document.body.classList.add('is-riding');
  document.body.classList.remove('is-loading');
  dom.startBtn?.blur();
  dom.hud?.setAttribute('aria-hidden', 'false');
  dom.intro?.setAttribute('aria-hidden', 'true');
  window.setTimeout(() => {
    dom.intro?.setAttribute('inert', '');
  }, 900);
  if (director) director.startRide();
  state.targetSpeed = 4.25;
  if (withSound) {
    try {
      await sound.start();
    } catch (error) {
      console.warn('Audio could not start:', error);
    }
    applySoundUI();
  }
  const hint = isCoarse
    ? '拖动环视 · 下方按钮压弯、按铃、跃起'
    : '拖拽环视 · W/S 骑行 · 空格跃起 · B 按铃';
  window.setTimeout(() => showToast(hint, 4200), 1500);
  if (queryNoUi) document.body.classList.add('is-cinema');
}

async function toggleSound() {
  if (!sound.active) {
    try {
      sound.setMuted(false);
      await sound.start();
    } catch (error) {
      showToast('这个浏览器暂时不允许海风发声。');
      console.warn(error);
    }
  } else {
    sound.setMuted(!sound.muted);
    if (!sound.muted) await sound.resume();
  }
  applySoundUI();
  if (sound.active) {
    showToast(sound.muted ? '声音已关闭。海浪继续无声地走。' : '声音已开启。');
  }
}

function openHelp() {
  if (!dom.helpDialog) return;
  if (!dom.helpDialog.open) dom.helpDialog.showModal();
}

function toggleCinema(force) {
  if (!state.started) return;
  const shouldEnable = force === undefined ? !document.body.classList.contains('is-cinema') : force;
  document.body.classList.toggle('is-cinema', shouldEnable);
  if (shouldEnable) {
    window.clearTimeout(toastTimer);
    dom.toast.classList.remove('is-visible');
  }
  director?.setCinema(shouldEnable);
  if (dom.cinemaBtn) dom.cinemaBtn.setAttribute('aria-pressed', String(shouldEnable));
  if (dom.cinemaExit) dom.cinemaExit.setAttribute('aria-hidden', String(!shouldEnable));
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (error) {
    showToast('这个浏览器不愿意全屏。');
  }
}

function updateFullscreenUI() {
  if (!dom.fullBtn) return;
  const active = Boolean(document.fullscreenElement);
  dom.fullBtn.setAttribute('aria-pressed', String(active));
  dom.fullBtn.setAttribute('aria-label', active ? '退出全屏' : '全屏');
}

function onVisibilityChange() {
  lastFrame = performance.now();
  if (document.hidden) {
    sound.suspend();
  } else if (sound.active && !sound.muted) {
    sound.restore();
  }
}

/* ------------------------------------------------------------------ */
/* Photo & film                                                        */
/* ------------------------------------------------------------------ */

function renderForCapture() {
  if (!composer) return;
  gradePass.material.uniforms.uResolution.value.set(
    dom.canvas.width,
    dom.canvas.height
  );
  gradePass.material.uniforms.uTime.value = elapsed;
  composer.render();
}

function capturePhoto() {
  if (!state.started || !renderer) return;
  try {
    renderForCapture();
    const source = renderer.domElement;
    const output = document.createElement('canvas');
    output.width = source.width;
    output.height = source.height;
    const ctx = output.getContext('2d');
    ctx.drawImage(source, 0, 0);
    const w = output.width;
    const h = output.height;
    const margin = Math.round(w * 0.035);
    const gradient = ctx.createLinearGradient(0, h * 0.58, 0, h);
    gradient.addColorStop(0, 'rgba(3,16,17,0)');
    gradient.addColorStop(0.55, 'rgba(3,16,17,0.16)');
    gradient.addColorStop(1, 'rgba(3,16,17,0.72)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, h * 0.55, w, h * 0.45);

    ctx.strokeStyle = 'rgba(242,234,217,0.44)';
    ctx.lineWidth = Math.max(1.5, w * 0.0008);
    ctx.strokeRect(margin, margin, w - margin * 2, h - margin * 2);
    ctx.strokeStyle = 'rgba(242,234,217,0.12)';
    ctx.lineWidth = Math.max(1, w * 0.0004);
    ctx.strokeRect(margin + w * 0.008, margin + w * 0.008, w - margin * 2 - w * 0.016, h - margin * 2 - w * 0.016);

    const kickerSize = Math.max(12, Math.round(w * 0.0075));
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(242,234,217,0.8)';
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(kickerSize * 0.18)}px`;
    ctx.font = `${kickerSize}px "SFMono-Regular", Menlo, monospace`;
    ctx.fillText('PELICAN POINT  /  NO. 001', margin + w * 0.02, margin + h * 0.025);
    ctx.textAlign = 'right';
    ctx.fillText(`${formatHour(state.hour)}  /  OFFSHORE`, w - margin - w * 0.02, margin + h * 0.025);
    ctx.textAlign = 'left';

    const titleSize = Math.max(36, Math.round(w * 0.047));
    const titleY = h - margin - h * 0.137;
    ctx.fillStyle = '#f2ead9';
    ctx.font = `${titleSize}px "Songti SC", "Bodoni 72", Didot, "Times New Roman", serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(titleSize * 0.05)}px`;
    ctx.fillText('鹈鹕骑士', margin + w * 0.02, titleY);
    ctx.fillStyle = '#f3a15d';
    ctx.fillRect(margin + w * 0.02, titleY + titleSize * 1.35, w * 0.035, Math.max(2, w * 0.0013));
    const smallSize = Math.max(11, Math.round(w * 0.0065));
    ctx.font = `${smallSize}px "SFMono-Regular", Menlo, monospace`;
    ctx.fillStyle = 'rgba(242,234,217,0.64)';
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(smallSize * 0.14)}px`;
    ctx.fillText('A REALTIME 3D POSTCARD  ·  PELICAN COVE', margin + w * 0.02, titleY + titleSize * 1.55);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(242,234,217,0.62)';
    ctx.font = `${smallSize}px "SFMono-Regular", Menlo, monospace`;
    ctx.fillText('37°14′ N  /  122°03′ W', w - margin - w * 0.02, h - margin - smallSize * 2.2);
    ctx.fillStyle = 'rgba(242,234,217,0.4)';
    ctx.fillText(phaseForHour(state.hour), w - margin - w * 0.02, h - margin - smallSize * 4.1);

    const stamp = new Date();
    const stampText = `${stamp.getFullYear()}.${String(stamp.getMonth() + 1).padStart(2, '0')}.${String(stamp.getDate()).padStart(2, '0')}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(242,234,217,0.34)';
    ctx.font = `${Math.max(9, Math.round(w * 0.005))}px "SFMono-Regular", Menlo, monospace`;
    ctx.fillText(stampText, margin + w * 0.02, h - margin - smallSize * 1.4);

    output.toBlob((blob) => {
      if (!blob) {
        showToast('照片没有冲洗出来，请再试一次。');
        return;
      }
      const name = `pelican-point-${stamp.toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
      downloadBlob(blob, name);
      dom.photoFlash.classList.remove('is-firing');
      void dom.photoFlash.offsetWidth;
      dom.photoFlash.classList.add('is-firing');
      vibrate(12);
      showToast('照片已装进口袋 · PNG');
    }, 'image/png');
  } catch (error) {
    console.warn(error);
    showToast('相机卡住了。请再按一次 P。');
  }
}

function formatRecordingTime(seconds) {
  const s = Math.max(0, seconds);
  return `0:${String(Math.ceil(s)).padStart(2, '0')}`;
}

function updateRecordingBadge() {
  if (!state.recording) return;
  const remaining = 6 - (performance.now() - recordingStartedAt) / 1000;
  if (dom.recTime) dom.recTime.textContent = formatRecordingTime(remaining);
  if (remaining <= 0) stopRecording();
}

async function toggleRecording() {
  if (!state.started) return;
  if (state.recording) {
    stopRecording();
    return;
  }
  if (!window.MediaRecorder || !dom.canvas.captureStream) {
    showToast('这个浏览器还不支持录制。可以换 Chrome 试试。');
    return;
  }
  try {
    const canvasStream = dom.canvas.captureStream(30);
    const tracks = [...canvasStream.getVideoTracks()];
    const audioTracks = sound.getAudioTracks();
    if (audioTracks.length) tracks.push(...audioTracks);
    recordingStream = new MediaStream(tracks);
    const mimeType = chooseMimeType();
    recordingChunks = [];
    recordingRecorder = new MediaRecorder(
      recordingStream,
      mimeType ? { mimeType, videoBitsPerSecond: 12_000_000 } : {}
    );
    recordingRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size) recordingChunks.push(event.data);
    };
    recordingRecorder.onstop = () => {
      const type = recordingRecorder?.mimeType || mimeType || 'video/webm';
      const blob = new Blob(recordingChunks, { type });
      recordingChunks = [];
      const extension = type.includes('mp4') ? 'mp4' : 'webm';
      if (blob.size > 0) {
        downloadBlob(blob, `pelican-point-${Date.now()}.${extension}`);
        showToast('六秒海风已收进短片 · ' + (type.includes('mp4') ? 'MP4' : 'WEBM'));
      } else {
        showToast('短片没有录到画面，请再试一次。');
      }
      // Tracks must outlive the encoder long enough to flush the last frame.
      const streamToClose = recordingStream;
      recordingStream = null;
      window.setTimeout(() => {
        streamToClose?.getTracks().forEach((track) => track.stop());
      }, 350);
      recordingRecorder = null;
    };
    recordingRecorder.onerror = () => {
      showToast('录制中断了。');
      stopRecording();
    };
    state.recording = true;
    recordingStartedAt = performance.now();
    recordingRecorder.start(250);
    dom.recBadge.classList.add('is-visible');
    dom.filmBtn.classList.add('is-recording');
    dom.filmBtn.setAttribute('aria-label', '停止录制');
    dom.filmBtn.setAttribute('aria-pressed', 'true');
    dom.recTime.textContent = '0:06';
    dom.filmFlash.classList.remove('is-flashing');
    void dom.filmFlash.offsetWidth;
    dom.filmFlash.classList.add('is-flashing');
    recordingTick = window.setInterval(updateRecordingBadge, 100);
    recordingStopTimer = window.setTimeout(stopRecording, 6000);
    vibrate(12);
  } catch (error) {
    console.warn(error);
    state.recording = false;
    showToast('录影机暂时不肯转动。');
  }
}

function stopRecording() {
  window.clearInterval(recordingTick);
  window.clearTimeout(recordingStopTimer);
  recordingTick = 0;
  recordingStopTimer = 0;
  state.recording = false;
  dom.recBadge.classList.remove('is-visible');
  dom.filmBtn.classList.remove('is-recording');
  dom.filmBtn.setAttribute('aria-label', '录制六秒短片');
  dom.filmBtn.setAttribute('aria-pressed', 'false');
  if (recordingRecorder && recordingRecorder.state !== 'inactive') {
    try {
      recordingRecorder.stop();
    } catch (error) {
      console.warn(error);
    }
  }
  dom.filmFlash.classList.remove('is-flashing');
  void dom.filmFlash.offsetWidth;
  dom.filmFlash.classList.add('is-flashing');
}

/* ------------------------------------------------------------------ */
/* Resize / loop                                                       */
/* ------------------------------------------------------------------ */

function onResize() {
  if (!renderer || !camera) return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  if (composer) {
    composer.setSize(width, height);
    if (gradePass) {
      gradePass.material.uniforms.uResolution.value.set(
        width * renderPixelRatio,
        height * renderPixelRatio
      );
    }
  }
}

function degradeQualityOnce() {
  if (lastFrameSample.degraded) return;
  lastFrameSample.degraded = true;
  renderPixelRatio = Math.min(renderPixelRatio, 1.0);
  renderer.setPixelRatio(renderPixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  if (composer) {
    composer.setPixelRatio(renderPixelRatio);
    composer.setSize(window.innerWidth, window.innerHeight);
  }
  if (gradePass) {
    gradePass.material.uniforms.uResolution.value.set(
      window.innerWidth * renderPixelRatio,
      window.innerHeight * renderPixelRatio
    );
  }
  if (state.started) showToast('为了留住海风，画质自动调低了一档。');
}

function monitorPerformance(now) {
  if (!lastFrameSample.time) {
    lastFrameSample.time = now;
    lastFrameSample.frames = 0;
    return;
  }
  lastFrameSample.frames++;
  if (now - lastFrameSample.time > 3000) {
    const fps = (lastFrameSample.frames * 1000) / (now - lastFrameSample.time);
    if (state.started && fps < 36 && renderPixelRatio > 1.02 && renderedFrames > 90) {
      degradeQualityOnce();
    }
    lastFrameSample.time = now;
    lastFrameSample.frames = 0;
  }
}

function animate(now) {
  animationHandle = requestAnimationFrame(animate);
  const rawDt = (now - lastFrame) / 1000;
  const dt = Math.min(Math.max(rawDt || 0.016, 0), 0.05);
  lastFrame = now;
  elapsed += dt;

  updateRig(dt, elapsed);
  if (world) world.update(dt, elapsed, { position: poseGroup.position, speed: state.speed, hour: state.hour, camera });

  if (renderer && world) {
    renderer.toneMappingExposure = world.atmosphere.exposure * (state.started ? 1.0 : 1.06);
  }
  if (gradePass) {
    gradePass.material.uniforms.uTime.value = elapsed;
    gradePass.material.uniforms.uResolution.value.set(dom.canvas.width, dom.canvas.height);
  }
  if (composer) composer.render();
  renderedFrames++;
  if (renderedFrames > 25) monitorPerformance(now);
  updateUI(dt);
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

async function boot() {
  try {
    setLoader(6, '正在借来一片黄昏');
    await nextFrame();
    setupRenderer();
    setLoader(22, '正在铺好木栈道');
    await nextFrame();
    setupWorld();
    setLoader(53, '正在给灯塔点上灯');
    await nextFrame();
    setupRider();
    setLoader(73, '正在调整鹈鹕的帽子');
    await nextFrame();
    setupCamera();
    setupComposer();
    setupInput();
    setLoader(89, '正在把海浪调成金色');
    updateTimeLabels();
    applySoundUI();
    dom.hud.setAttribute('aria-hidden', 'true');
    dom.cinemaExit.setAttribute('aria-hidden', 'true');
    if (prefersReducedMotion) document.body.classList.add('reduced-motion');

    // A debug handle is useful for field notes and for anyone curious.
    window.__PELICAN__ = {
      THREE,
      scene,
      camera,
      renderer,
      world,
      bike,
      pelican,
      director,
      state,
      sound,
      setHour,
      start: () => startExperience({ withSound: false }),
      get fps() {
        return lastFrameSample.time
          ? Math.round((lastFrameSample.frames * 1000) / Math.max(1, performance.now() - lastFrameSample.time))
          : 0;
      },
    };

    ready = true;
    lastFrame = performance.now();
    animate(lastFrame);
    await sleep(220);
    setLoader(100, '海风已就位');
    await sleep(650);
    document.body.classList.add('is-loaded');
    document.body.classList.remove('is-loading');
    if (queryAutostart) {
      await sleep(200);
      startExperience({ withSound: false });
    }
  } catch (error) {
    console.error(error);
    const foot = dom.loader?.querySelector('.loader-copy small');
    if (foot) foot.textContent = 'WEBGL UNAVAILABLE / TRY A MODERN BROWSER';
    dom.loaderBar.style.width = '100%';
    dom.loaderPct.textContent = 'ERR';
    dom.loaderStatus.textContent = '这片海暂时无法渲染';
  }
}

boot();

window.addEventListener('pagehide', () => {
  if (animationHandle) cancelAnimationFrame(animationHandle);
});
