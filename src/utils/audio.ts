class SoundboardManager {
  private ctx: AudioContext | null = null
  private buffers: Record<string, AudioBuffer> = {}

  private getContext() {
    if (!this.ctx) {
      const CtxClass = window.AudioContext || (window as any).webkitAudioContext
      this.ctx = new CtxClass()
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
    return this.ctx
  }

  // Helper to load and play a WAV file
  private async playFile(url: string, volume = 1.0) {
    const ctx = this.getContext()
    try {
      if (!this.buffers[url]) {
        const response = await fetch(url)
        const arrayBuffer = await response.arrayBuffer()
        this.buffers[url] = await ctx.decodeAudioData(arrayBuffer)
      }
      
      const source = ctx.createBufferSource()
      source.buffer = this.buffers[url]
      
      const gainNode = ctx.createGain()
      gainNode.gain.value = volume
      
      source.connect(gainNode)
      gainNode.connect(ctx.destination)
      source.start()
    } catch (e) {
      console.error('Erreur lecture son:', url, e)
    }
  }

  // --- Network Sync ---
  private emitSound(soundId: string) {
    // We play it locally first
    this._play(soundId)
    // Then we tell other clients (the PC) to play it too
    // @ts-ignore
    if (import.meta.hot) {
      // @ts-ignore
      import.meta.hot.send('lg:play-sound', { soundId })
    }
  }

  constructor() {
    // Listen for network sounds
    // @ts-ignore
    if (import.meta.hot) {
      // @ts-ignore
      import.meta.hot.on('lg:play-sound', (data: { soundId: string }) => {
        this._play(data.soundId)
      })
    }
  }

  // Internal switch
  private _play(soundId: string) {
    switch (soundId) {
      case 'wolf': this.playFile('/wolves.wav', 0.8); break
      case 'bear': this.playFile('/bear.wav', 1.5); break
      case 'morning': this.playFile('/morning.wav', 0.7); break
      case 'night': this.playFile('/night.wav', 0.8); break
      case 'gun': this._playGunshot(); break
      case 'flute': this._playFluteTune(); break
    }
  }

  // Public methods triggered by UI
  playWolfHowl() { this.emitSound('wolf') }
  playBearGrowl() { this.emitSound('bear') }
  playRoosterCrow() { this.emitSound('morning') }
  playNight() { this.emitSound('night') }
  playGunshot() { this.emitSound('gun') }
  playFluteTune() { this.emitSound('flute') }

  // 🪈 Flûte synthétique
  private _playFluteTune() {
    const ctx = this.getContext()
    const now = ctx.currentTime
    const notes = [
      { freq: 440.0, start: 0.0, dur: 0.4 }, 
      { freq: 523.25, start: 0.35, dur: 0.4 },
      { freq: 587.33, start: 0.7, dur: 0.45 },
      { freq: 659.25, start: 1.1, dur: 0.5 },
      { freq: 783.99, start: 1.55, dur: 0.7 },
      { freq: 587.33, start: 2.2, dur: 1.2 }
    ]
    notes.forEach(n => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const vibrato = ctx.createOscillator()
      const vibratoGain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(n.freq, now + n.start)

      vibrato.frequency.setValueAtTime(5, now + n.start)
      vibratoGain.gain.setValueAtTime(4.5, now + n.start)
      vibrato.connect(osc.frequency)

      gain.gain.setValueAtTime(0.001, now + n.start)
      gain.gain.linearRampToValueAtTime(0.18, now + n.start + 0.08)
      gain.gain.setValueAtTime(0.16, now + n.start + n.dur * 0.6)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur)

      osc.connect(gain)
      gain.connect(ctx.destination)

      vibrato.start(now + n.start)
      osc.start(now + n.start)
      vibrato.stop(now + n.start + n.dur)
      osc.stop(now + n.start + n.dur)
    })
  }

  // 💥 Coup de feu du Chasseur
  private _playGunshot() {
    const ctx = this.getContext()
    const now = ctx.currentTime

    const bufferSize = Math.floor(ctx.sampleRate * 1.2)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1)
    }

    const noise = ctx.createBufferSource()
    noise.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(2400, now)
    filter.frequency.exponentialRampToValueAtTime(300, now + 0.8)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.3, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9)

    const punch = ctx.createOscillator()
    const punchGain = ctx.createGain()
    punch.frequency.setValueAtTime(150, now)
    punch.frequency.exponentialRampToValueAtTime(35, now + 0.3)
    punchGain.gain.setValueAtTime(0.2, now)
    punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)

    punch.connect(punchGain)
    punchGain.connect(ctx.destination)

    noise.start(now)
    punch.start(now)

    noise.stop(now + 1.0)
    punch.stop(now + 0.4)
  }
}

export const soundboard = new SoundboardManager()
