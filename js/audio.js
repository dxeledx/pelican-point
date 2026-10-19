/**
 * A tiny, fully procedural soundscape.
 * No audio files: ocean, wind, gulls, bells, the pelican and a
 * soft generative score are all synthesized with the Web Audio API.
 */

const PENTATONIC = [293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 739.99];

export class Soundscape {
  constructor() {
    this.ctx = null;
    this.active = false;
    this.muted = false;
    this.master = null;
    this.recordingDest = null;
    this.timers = new Set();
    this.ambientSources = [];
    this.gullPan = null;
    this._lastClick = 0;
  }

  get isReady() {
    return this.active && this.ctx && this.ctx.state === 'running';
  }

  async start() {
    if (this.active) {
      await this.resume();
      return;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;

    this.ctx = new AudioContext();
    const ctx = this.ctx;

    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.62;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 22;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.008;
    compressor.release.value = 0.28;

    master.connect(compressor);
    compressor.connect(ctx.destination);

    this.recordingDest = ctx.createMediaStreamDestination();
    compressor.connect(this.recordingDest);

    this.master = master;
    this.compressor = compressor;

    const reverb = ctx.createConvolver();
    reverb.buffer = this._makeImpulse(2.6, 0.5);
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.21;
    reverb.connect(reverbGain);
    reverbGain.connect(master);
    this.reverb = reverb;

    this._buildOcean();
    this._buildWind();
    this._buildPad();
    this._scheduleGull();
    this._schedulePluck(2.5);
    this._schedulePluck(6);

    this.active = true;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        /* The first gesture will resume it. */
      }
    }
    return true;
  }

  async resume() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        /* no-op */
      }
    }
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (!this.master || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 0.62, now + 0.25);
  }

  getAudioTracks() {
    if (!this.recordingDest) return [];
    return this.recordingDest.stream.getAudioTracks();
  }

  _makeNoiseBuffer(seconds = 8, color = 'brown') {
    const ctx = this.ctx;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    let lastL = 0;
    let lastR = 0;
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let last = channel === 0 ? lastL : lastR;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        if (color === 'brown') {
          last = (last + 0.014 * white) / 1.014;
          data[i] = last * 3.2;
        } else if (color === 'pink') {
          last = 0.985 * last + 0.015 * white;
          data[i] = last * 2.6;
        } else {
          data[i] = white;
        }
      }
      if (channel === 0) lastL = last;
      else lastR = last;
    }
    return buffer;
  }

  _makeImpulse(seconds, decay) {
    const ctx = this.ctx;
    const length = Math.floor(ctx.sampleRate * seconds);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const t = i / length;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay * 4.2) * (channel ? 0.86 : 1);
      }
    }
    return impulse;
  }

  _buildOcean() {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this._makeNoiseBuffer(11, 'brown');
    source.loop = true;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 460;
    lowpass.Q.value = 0.25;

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 45;

    const gain = ctx.createGain();
    gain.gain.value = 0.21;

    const swell = ctx.createOscillator();
    swell.frequency.value = 0.085;
    const swellGain = ctx.createGain();
    swellGain.gain.value = 0.055;
    swell.connect(swellGain);
    swellGain.connect(gain.gain);

    const filterLfo = ctx.createOscillator();
    filterLfo.frequency.value = 0.047;
    const filterDepth = ctx.createGain();
    filterDepth.gain.value = 140;
    filterLfo.connect(filterDepth);
    filterDepth.connect(lowpass.frequency);

    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(this.master);

    const send = ctx.createGain();
    send.gain.value = 0.16;
    gain.connect(send);
    send.connect(this.reverb);

    source.start();
    swell.start();
    filterLfo.start();
    this.ambientSources.push(source, swell, filterLfo);
  }

  _buildWind() {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this._makeNoiseBuffer(9, 'pink');
    source.loop = true;

    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 680;
    band.Q.value = 0.72;

    const gain = ctx.createGain();
    gain.gain.value = 0.035;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.11;
    const depth = ctx.createGain();
    depth.gain.value = 0.018;
    lfo.connect(depth);
    depth.connect(gain.gain);

    const filterLfo = ctx.createOscillator();
    filterLfo.frequency.value = 0.067;
    const filterDepth = ctx.createGain();
    filterDepth.gain.value = 220;
    filterLfo.connect(filterDepth);
    filterDepth.connect(band.frequency);

    source.connect(band);
    band.connect(gain);
    gain.connect(this.master);
    const send = ctx.createGain();
    send.gain.value = 0.09;
    gain.connect(send);
    send.connect(this.reverb);

    source.start();
    lfo.start();
    filterLfo.start();
    this.ambientSources.push(source, lfo, filterLfo);
  }

  _buildPad() {
    const ctx = this.ctx;
    const notes = [73.42, 110.0, 146.83, 185.0, 220.0];
    const bus = ctx.createGain();
    bus.gain.value = 0.028;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 560;
    filter.Q.value = 0.8;
    bus.connect(filter);
    filter.connect(this.master);
    const send = ctx.createGain();
    send.gain.value = 0.45;
    filter.connect(send);
    send.connect(this.reverb);

    const tremolo = ctx.createOscillator();
    tremolo.frequency.value = 0.055;
    const tremoloGain = ctx.createGain();
    tremoloGain.gain.value = 0.01;
    tremolo.connect(tremoloGain);
    tremoloGain.connect(bus.gain);
    tremolo.start();
    this.ambientSources.push(tremolo);

    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      osc.type = index % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = (index - 2) * 3.2;
      const gain = ctx.createGain();
      gain.gain.value = index === 0 ? 0.02 : 0.009;
      const drift = ctx.createOscillator();
      drift.frequency.value = 0.021 + index * 0.007;
      const driftDepth = ctx.createGain();
      driftDepth.gain.value = 1.2 + index * 0.6;
      drift.connect(driftDepth);
      driftDepth.connect(osc.detune);
      drift.start();
      osc.connect(gain);
      gain.connect(bus);
      osc.start();
      this.ambientSources.push(osc, drift);
    });
  }

  _timer(fn, delay) {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      if (this.active) fn();
    }, delay);
    this.timers.add(id);
  }

  _scheduleGull() {
    const delay = 7800 + Math.random() * 11500;
    this._timer(() => {
      this.gull();
      this._scheduleGull();
    }, delay);
  }

  _schedulePluck(delay = 5000 + Math.random() * 9000) {
    this._timer(() => {
      this.pluck();
      this._schedulePluck(6500 + Math.random() * 9500);
    }, delay);
  }

  pluck(note = null) {
    if (!this.isReady || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.02;
    const freq = note || PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc.type = 'triangle';
    osc2.type = 'sine';
    osc.frequency.value = freq;
    osc2.frequency.value = freq * 2.01;
    const gain = ctx.createGain();
    const gain2 = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);
    gain2.gain.setValueAtTime(0.0001, now);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.008);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
    const panner = ctx.createStereoPanner();
    panner.pan.value = (Math.random() * 2 - 1) * 0.55;
    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = 0.29;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.26;
    delay.connect(feedback);
    feedback.connect(delay);
    const delaySend = ctx.createGain();
    delaySend.gain.value = 0.22;
    gain.connect(panner);
    gain2.connect(panner);
    panner.connect(this.master);
    panner.connect(delaySend);
    delaySend.connect(delay);
    delay.connect(this.reverb);
    panner.connect(this.reverb);
    osc.connect(gain);
    osc2.connect(gain2);
    osc.start(now);
    osc2.start(now);
    osc.stop(now + 2.8);
    osc2.stop(now + 1.6);
  }

  gull() {
    if (!this.isReady || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.04;
    const panner = ctx.createStereoPanner();
    panner.pan.value = (Math.random() * 2 - 1) * 0.8;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    panner.connect(gain);
    gain.connect(this.master);
    const send = ctx.createGain();
    send.gain.value = 0.1;
    gain.connect(send);
    send.connect(this.reverb);

    const calls = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < calls; i++) {
      const start = now + i * (0.22 + Math.random() * 0.08);
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const base = 820 + Math.random() * 280;
      osc.frequency.setValueAtTime(base * 0.72, start);
      osc.frequency.exponentialRampToValueAtTime(base * 1.28, start + 0.06);
      osc.frequency.exponentialRampToValueAtTime(base * 0.78, start + 0.24);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1350;
      filter.Q.value = 1.4;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(0.025, start + 0.018);
      env.gain.exponentialRampToValueAtTime(0.0001, start + 0.26);
      osc.connect(filter);
      filter.connect(env);
      env.connect(panner);
      osc.start(start);
      osc.stop(start + 0.28);
    }
    window.setTimeout(() => {
      panner.disconnect();
      gain.disconnect();
      send.disconnect();
    }, 1600);
  }

  bell() {
    if (!this.isReady) return;
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.01;
    const panner = ctx.createStereoPanner();
    panner.pan.value = 0.12;
    panner.connect(this.master);
    const send = ctx.createGain();
    send.gain.value = 0.2;
    panner.connect(send);
    send.connect(this.reverb);

    const partials = [
      { f: 1567.98, g: 0.12, d: 1.8 },
      { f: 2093.0, g: 0.075, d: 1.25 },
      { f: 3135.96, g: 0.025, d: 0.82 },
      { f: 783.99, g: 0.038, d: 1.5 },
    ];

    partials.forEach(({ f, g, d }) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(g, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + d);
      osc.connect(gain);
      gain.connect(panner);
      osc.start(now);
      osc.stop(now + d + 0.05);
    });
    this._secondBellStrike(now + 0.18, panner);
  }

  _secondBellStrike(now, panner) {
    const ctx = this.ctx;
    const partials = [
      { f: 1567.98, g: 0.06, d: 1.1 },
      { f: 2093.0, g: 0.04, d: 0.9 },
    ];
    partials.forEach(({ f, g, d }) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(g, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + d);
      osc.connect(gain);
      gain.connect(panner);
      osc.start(now);
      osc.stop(now + d + 0.03);
    });
  }

  honk() {
    if (!this.isReady) return;
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.01;
    const panner = ctx.createStereoPanner();
    panner.pan.value = -0.06;
    panner.connect(this.master);
    const send = ctx.createGain();
    send.gain.value = 0.14;
    panner.connect(send);
    send.connect(this.reverb);

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(188, now);
    osc.frequency.exponentialRampToValueAtTime(154, now + 0.13);
    osc.frequency.exponentialRampToValueAtTime(122, now + 0.42);
    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 28;
    const vibratoGain = ctx.createGain();
    vibratoGain.gain.value = 15;
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.frequency);
    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.setValueAtTime(980, now);
    formant.frequency.exponentialRampToValueAtTime(540, now + 0.42);
    formant.Q.value = 2.4;
    const body = ctx.createBiquadFilter();
    body.type = 'lowpass';
    body.frequency.value = 1800;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.11, now + 0.018);
    env.gain.linearRampToValueAtTime(0.075, now + 0.18);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    osc.connect(formant);
    formant.connect(body);
    body.connect(env);
    env.connect(panner);
    osc.start(now);
    vibrato.start(now);
    osc.stop(now + 0.55);
    vibrato.stop(now + 0.55);
    window.setTimeout(() => {
      panner.disconnect();
      send.disconnect();
    }, 1600);
  }

  creak(intensity = 1) {
    if (!this.isReady || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - this._lastClick < 0.09) return;
    this._lastClick = now;
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.025), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
    }
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3100;
    filter.Q.value = 1.6;
    const gain = ctx.createGain();
    gain.gain.value = 0.008 * intensity;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(now);
  }

  async suspend() {
    if (!this.ctx) return;
    try {
      await this.ctx.suspend();
    } catch {
      /* no-op */
    }
  }

  async restore() {
    if (!this.active) return;
    await this.resume();
  }

  dispose() {
    this.timers.forEach((id) => window.clearTimeout(id));
    this.timers.clear();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.active = false;
  }
}
