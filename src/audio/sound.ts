export class Sound {
  private ctx: AudioContext | null = null;
  enabled = true;
  private droneOsc: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private sequenceTimer: number | null = null;
  private loopTimer: number | null = null;
  private looping = false;

  private ensure(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    return this.ctx;
  }

  resume(): void {
    void this.ensure().resume();
  }

  private blip(freq: number, dur: number, type: OscillatorType, gain = 0.08): void {
    if (!this.enabled) {
      return;
    }
    const ctx = this.ensure();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  click(): void {
    this.blip(420, 0.07, "sine", 0.05);
  }

  start(): void {
    this.blip(180, 0.35, "triangle", 0.07);
    this.blip(360, 0.22, "sine", 0.04);
  }

  collide(kind: string): void {
    if (kind === "merge" || kind === "swallow") {
      this.blip(90, 0.4, "sine", 0.1);
    } else if (kind === "big-bang") {
      this.blip(40, 1.2, "sawtooth", 0.08);
      this.blip(220, 0.8, "sine", 0.05);
    } else {
      this.blip(55, 0.55, "sawtooth", 0.06);
      this.blip(140, 0.2, "square", 0.03);
    }
  }

  /** Single pitched tone for the "奏でる" gesture. */
  note(freq: number, dur = 0.22, gain = 0.07): void {
    this.blip(freq, dur, "sine", gain);
  }

  /**
   * Play frequencies once. Returns false if a one-shot sequence is already running.
   * Independent of the soft chime loop.
   */
  playSequence(
    freqs: readonly number[],
    gapSec = 0.2,
    onStep?: (index: number) => void,
  ): boolean {
    if (!this.enabled || freqs.length === 0) {
      return false;
    }
    if (this.sequenceTimer !== null) {
      return false;
    }
    let i = 0;
    const step = () => {
      if (i >= freqs.length) {
        this.sequenceTimer = null;
        return;
      }
      const f = freqs[i]!;
      onStep?.(i);
      this.note(f, Math.min(0.28, gapSec + 0.05));
      i += 1;
      this.sequenceTimer = window.setTimeout(step, gapSec * 1000);
    };
    step();
    return true;
  }

  isChimeLooping(): boolean {
    return this.looping;
  }

  /**
   * Soft looping arpeggio. `getPhrase` is polled at the start of each pass
   * so the pattern can follow the live arrangement. Quieter / slower than 奏でる.
   */
  startChimeLoop(
    getPhrase: () => { freqs: readonly number[]; ids: readonly number[] } | null,
    opts?: {
      gapSec?: number;
      pauseSec?: number;
      noteDur?: number;
      gain?: number;
      onStep?: (index: number, bodyId: number) => void;
    },
  ): void {
    this.stopChimeLoop();
    if (!this.enabled) {
      return;
    }
    const gapSec = opts?.gapSec ?? 0.4;
    const pauseSec = opts?.pauseSec ?? 1.6;
    const noteDur = opts?.noteDur ?? 0.34;
    const gain = opts?.gain ?? 0.07;
    this.looping = true;

    const runPass = () => {
      if (!this.looping) {
        return;
      }
      const phrase = getPhrase();
      if (!phrase || phrase.freqs.length === 0) {
        this.loopTimer = window.setTimeout(runPass, pauseSec * 1000);
        return;
      }
      const freqs = phrase.freqs;
      const ids = phrase.ids;
      let i = 0;
      const step = () => {
        if (!this.looping) {
          return;
        }
        if (i >= freqs.length) {
          this.loopTimer = window.setTimeout(runPass, pauseSec * 1000);
          return;
        }
        const id = ids[i];
        if (id !== undefined) {
          opts?.onStep?.(i, id);
        }
        this.note(freqs[i]!, noteDur, gain);
        i += 1;
        this.loopTimer = window.setTimeout(step, gapSec * 1000);
      };
      step();
    };
    runPass();
  }

  stopChimeLoop(): void {
    this.looping = false;
    if (this.loopTimer !== null) {
      window.clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
  }

  result(ok: boolean): void {
    if (ok) {
      this.blip(330, 0.25, "sine", 0.06);
      this.blip(495, 0.4, "sine", 0.05);
    } else {
      this.blip(110, 0.5, "triangle", 0.07);
    }
  }

  /** Soft drone while the system feels balanced. */
  setAmbient(on: boolean): void {
    if (!this.enabled) {
      this.stopAmbient();
      return;
    }
    const ctx = this.ensure();
    if (on) {
      if (this.droneOsc) {
        return;
      }
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 55;
      g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(0.018, ctx.currentTime + 1.5);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start();
      this.droneOsc = osc;
      this.droneGain = g;
    } else {
      this.stopAmbient();
    }
  }

  private stopAmbient(): void {
    const ctx = this.ctx;
    if (this.droneGain && ctx) {
      try {
        this.droneGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
      } catch {
        /* ignore */
      }
    }
    const osc = this.droneOsc;
    const gain = this.droneGain;
    this.droneOsc = null;
    this.droneGain = null;
    if (osc && ctx) {
      window.setTimeout(() => {
        try {
          osc.stop();
          osc.disconnect();
          gain?.disconnect();
        } catch {
          /* ignore */
        }
      }, 900);
    }
  }
}
