import { AmbienceId, SfxId } from '../../shared/types'

// Optional higher quality loops dropped in public/audio/ win over the bundled samples.
const AMBIENCE_SOURCES: Record<Exclude<AmbienceId, 'none'>, string[]> = {
  night: ['/audio/ambience-night.mp3', '/night.wav'],
  day: ['/audio/ambience-day.mp3']
}

const SFX_FILES: Partial<Record<SfxId, { url: string; gain: number }>> = {
  wolves: { url: '/wolves.wav', gain: 0.9 },
  bear: { url: '/bear.wav', gain: 1 },
  rooster: { url: '/morning.wav', gain: 0.8 },
  swoosh: { url: '/swoosh.wav', gain: 0.8 }
}

const FADE_SECONDS = 2.5

/** Sound engine of the régie PC: one-shot effects plus a looping ambience that crossfades day/night. */
export class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private ambienceBus: GainNode | null = null
  private buffers = new Map<string, Promise<AudioBuffer | null>>()
  private loop: { source: AudioBufferSourceNode; gain: GainNode; id: AmbienceId } | null = null

  get unlocked(): boolean {
    return this.ctx?.state === 'running'
  }

  /** Browsers only allow audio after a user gesture: call from a click. */
  async unlock(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.connect(this.ctx.destination)
      this.ambienceBus = this.ctx.createGain()
      this.ambienceBus.gain.value = 0.5
      this.ambienceBus.connect(this.master)
    }
    await this.ctx.resume()
  }

  setMasterVolume(v: number): void {
    if (this.master) this.master.gain.value = v
  }

  setAmbienceVolume(v: number): void {
    if (this.ambienceBus) this.ambienceBus.gain.value = v
  }

  async playSfx(id: SfxId): Promise<void> {
    const ctx = this.ctx
    const out = this.master
    if (!ctx || !out) return
    const file = SFX_FILES[id]
    if (file) {
      const buffer = await this.load(file.url)
      if (!buffer) return
      const source = ctx.createBufferSource()
      const gain = ctx.createGain()
      source.buffer = buffer
      gain.gain.value = file.gain
      source.connect(gain).connect(out)
      source.start()
      return
    }
    if (id === 'gunshot') this.gunshot(ctx, out)
    else if (id === 'bell') this.bell(ctx, out)
    else if (id === 'flute') this.flute(ctx, out)
    else if (id === 'drum') this.drum(ctx, out)
  }

  async setAmbience(id: AmbienceId): Promise<void> {
    const ctx = this.ctx
    const bus = this.ambienceBus
    if (!ctx || !bus || this.loop?.id === id) return
    const now = ctx.currentTime
    const old = this.loop
    if (old) {
      old.gain.gain.setValueAtTime(old.gain.gain.value, now)
      old.gain.gain.linearRampToValueAtTime(0, now + FADE_SECONDS)
      old.source.stop(now + FADE_SECONDS)
      this.loop = null
    }
    if (id === 'none') return
    let buffer: AudioBuffer | null = null
    for (const url of AMBIENCE_SOURCES[id]) {
      buffer = await this.load(url)
      if (buffer) break
    }
    if (!buffer) return
    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    source.buffer = buffer
    source.loop = true
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(1, ctx.currentTime + FADE_SECONDS)
    source.connect(gain).connect(bus)
    source.start()
    this.loop = { source, gain, id }
  }

  private load(url: string): Promise<AudioBuffer | null> {
    const ctx = this.ctx
    if (!ctx) return Promise.resolve(null)
    let pending = this.buffers.get(url)
    if (!pending) {
      pending = fetch(url)
        .then(res => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(String(res.status)))))
        .then(data => ctx.decodeAudioData(data))
        .catch(() => null)
      this.buffers.set(url, pending)
    }
    return pending
  }

  private noise(ctx: AudioContext, seconds: number): AudioBufferSourceNode {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const source = ctx.createBufferSource()
    source.buffer = buffer
    return source
  }

  private gunshot(ctx: AudioContext, out: AudioNode): void {
    const now = ctx.currentTime
    const noise = this.noise(ctx, 1.2)
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(2400, now)
    filter.frequency.exponentialRampToValueAtTime(300, now + 0.8)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.6, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9)
    const punch = ctx.createOscillator()
    const punchGain = ctx.createGain()
    punch.frequency.setValueAtTime(150, now)
    punch.frequency.exponentialRampToValueAtTime(35, now + 0.3)
    punchGain.gain.setValueAtTime(0.4, now)
    punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
    noise.connect(filter).connect(gain).connect(out)
    punch.connect(punchGain).connect(out)
    noise.start(now)
    punch.start(now)
    noise.stop(now + 1)
    punch.stop(now + 0.4)
  }

  // Church bell: inharmonic partials with long decays, struck three times.
  private bell(ctx: AudioContext, out: AudioNode): void {
    const partials = [[0.5, 0.25], [1, 0.35], [1.19, 0.15], [1.5, 0.12], [2, 0.1], [2.74, 0.06]]
    for (let strike = 0; strike < 3; strike++) {
      const t = ctx.currentTime + strike * 2.2
      for (const [ratio, level] of partials) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.frequency.value = 220 * ratio
        gain.gain.setValueAtTime(0.0001, t)
        gain.gain.exponentialRampToValueAtTime(level, t + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 4 / ratio + 1)
        osc.connect(gain).connect(out)
        osc.start(t)
        osc.stop(t + 5.5)
      }
    }
  }

  private flute(ctx: AudioContext, out: AudioNode): void {
    const now = ctx.currentTime
    const notes = [[440, 0, 0.4], [523.25, 0.35, 0.4], [587.33, 0.7, 0.45], [659.25, 1.1, 0.5], [783.99, 1.55, 0.7], [587.33, 2.2, 1.2]]
    for (const [freq, start, dur] of notes) {
      const osc = ctx.createOscillator()
      const vibrato = ctx.createOscillator()
      const depth = ctx.createGain()
      const gain = ctx.createGain()
      osc.frequency.setValueAtTime(freq, now + start)
      vibrato.frequency.value = 5
      depth.gain.value = 4.5
      vibrato.connect(depth).connect(osc.frequency)
      gain.gain.setValueAtTime(0.001, now + start)
      gain.gain.linearRampToValueAtTime(0.2, now + start + 0.08)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur)
      osc.connect(gain).connect(out)
      vibrato.start(now + start)
      osc.start(now + start)
      vibrato.stop(now + start + dur)
      osc.stop(now + start + dur)
    }
  }

  // Slow war-drum roll for the hunter's last stand.
  private drum(ctx: AudioContext, out: AudioNode): void {
    for (let i = 0; i < 6; i++) {
      const t = ctx.currentTime + i * 0.45
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.setValueAtTime(110, t)
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.25)
      gain.gain.setValueAtTime(0.7, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
      osc.connect(gain).connect(out)
      osc.start(t)
      osc.stop(t + 0.45)
    }
  }
}

export const audioEngine = new AudioEngine()
