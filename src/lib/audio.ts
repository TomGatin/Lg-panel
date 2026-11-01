import { AmbienceId, SfxId } from '../../shared/types'

// Every file in public/audio/ is loudness-matched (-16 LUFS effects, -23 LUFS ambiences): no per-file gain.
export const AMBIENCE_FILES: Record<Exclude<AmbienceId, 'none'>, string> = {
  night: '/audio/ambience-night.mp3',
  day: '/audio/ambience-day.mp3'
}

export const SFX_FILES: Record<SfxId, string> = {
  wolves: '/audio/wolves.mp3',
  rooster: '/audio/rooster.mp3',
  bell: '/audio/bell.mp3',
  gunshot: '/audio/gunshot.mp3',
  witch: '/audio/witch.mp3',
  flute: '/audio/flute.mp3',
  bear: '/audio/bear.mp3',
  crow: '/audio/crow.mp3',
  announcement: '/audio/announcement.mp3',
  victory_village: '/audio/victory-village.mp3',
  victory_wolves: '/audio/victory-wolves.mp3',
  cupid: '/audio/cupid.mp3',
  solo: '/audio/solo.mp3'
}

const FADE_SECONDS = 2.5

/** Sound engine of whichever device feeds the speakers: one-shot effects plus a looping ambience that crossfades day/night. */
export class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private ambienceBus: GainNode | null = null
  private buffers = new Map<string, Promise<AudioBuffer | null>>()
  private loop: { source: AudioBufferSourceNode; gain: GainNode; id: AmbienceId } | null = null
  private effects = new Set<{ source: AudioBufferSourceNode; gain: GainNode }>()
  // Last ambience asked for: a slow load must not start a loop that was replaced meanwhile.
  private wanted: AmbienceId = 'none'
  private listeners = new Set<() => void>()

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
      this.ctx.onstatechange = () => this.listeners.forEach(l => l())
      // Decoded ahead so the first press of each effect plays at once instead of after a download.
      for (const url of Object.values(SFX_FILES)) void this.load(url)
    }
    await this.ctx.resume()
  }

  /** Called when the browser starts or suspends the audio output. */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
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
    const buffer = await this.load(SFX_FILES[id])
    if (!buffer) return
    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    source.buffer = buffer
    source.connect(gain).connect(out)
    const effect = { source, gain }
    this.effects.add(effect)
    source.onended = () => this.effects.delete(effect)
    source.start()
  }

  /** Cuts every effect still playing, with a short fade so it does not click. The ambience keeps going. */
  stopSfx(): void {
    const ctx = this.ctx
    if (!ctx) return
    const now = ctx.currentTime
    for (const { source, gain } of this.effects) {
      gain.gain.setValueAtTime(gain.gain.value, now)
      gain.gain.linearRampToValueAtTime(0, now + 0.05)
      source.stop(now + 0.05)
    }
    this.effects.clear()
  }

  async setAmbience(id: AmbienceId): Promise<void> {
    const ctx = this.ctx
    const bus = this.ambienceBus
    if (!ctx || !bus || this.wanted === id) return
    this.wanted = id
    const now = ctx.currentTime
    const old = this.loop
    if (old) {
      old.gain.gain.setValueAtTime(old.gain.gain.value, now)
      old.gain.gain.linearRampToValueAtTime(0, now + FADE_SECONDS)
      old.source.stop(now + FADE_SECONDS)
      this.loop = null
    }
    if (id === 'none') return
    const buffer = await this.load(AMBIENCE_FILES[id])
    if (!buffer || this.wanted !== id) return
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
        .then(res => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(`HTTP ${res.status}`))))
        .then(data => ctx.decodeAudioData(data))
        .catch((err: unknown) => {
          // Not cached: a file fixed or added while the show runs plays on the next press.
          console.warn(`[audio] ${url} illisible :`, err)
          this.buffers.delete(url)
          return null
        })
      this.buffers.set(url, pending)
    }
    return pending
  }
}

export const audioEngine = new AudioEngine()
