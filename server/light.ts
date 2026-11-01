import { LIGHT_SCENES } from '../shared/cues'
import { LightCommand, LightStatus } from '../shared/types'

/**
 * Everything lg-panel needs from the lighting side.
 * stagehand's HTTP API is still moving: only StagehandLight knows its routes.
 */
export interface LightPort {
  send(command: LightCommand): Promise<void>
  readonly status: LightStatus
  /** Scenes or effects the cues need that the lighting side does not have. */
  readonly missing: string[]
  onStatusChange(listener: (status: LightStatus) => void): void
}

const REQUEST_TIMEOUT_MS = 500
const HEALTH_INTERVAL_MS = 5000
const STROBE_EFFECT = 'lightning'

export class StagehandLight implements LightPort {
  status: LightStatus = 'down'
  missing: string[] = []
  private listeners: ((status: LightStatus) => void)[] = []
  private readonly baseUrl: string
  private readonly roomPath: string

  constructor(baseUrl: string, private readonly token: string, roomId: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.roomPath = `/api/rooms/${encodeURIComponent(roomId)}`
    void this.checkHealth()
    setInterval(() => void this.checkHealth(), HEALTH_INTERVAL_MS).unref()
  }

  onStatusChange(listener: (status: LightStatus) => void): void {
    this.listeners.push(listener)
  }

  // Fire-and-forget: a slow or dead stagehand must never block the game.
  async send(command: LightCommand): Promise<void> {
    try {
      const res = await this.request(this.route(command), 'POST')
      // A scene that was never created is a content problem, not an outage.
      if (res.status === 404) console.error('[lumière] introuvable dans stagehand :', JSON.stringify(command))
      else this.setStatus(res.ok ? 'ok' : 'down')
    } catch {
      this.setStatus('down')
    }
  }

  private route(command: LightCommand): string {
    switch (command.kind) {
      case 'scene': return `${this.roomPath}/scenes/${encodeURIComponent(command.name)}/go`
      case 'full': return `${this.roomPath}/scenes/full/go`
      case 'strobe': return `${this.roomPath}/effects/${STROBE_EFFECT}/fire`
      case 'blackout': return '/api/dmx/blackout'
    }
  }

  private request(path: string, method = 'GET'): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { authorization: `Bearer ${this.token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
  }

  // /api/health is public: only an authenticated read of the room proves token and room are right.
  private async checkHealth(): Promise<void> {
    try {
      const res = await this.request(this.roomPath)
      const room = res.ok ? await res.json() as { active: boolean } : undefined
      if (!room?.active) return this.setStatus('down')
      await this.checkContent()
      this.setStatus('ok')
    } catch {
      this.setStatus('down')
    }
  }

  private async checkContent(): Promise<void> {
    const [scenes, effects] = await Promise.all([
      this.request(`${this.roomPath}/scenes`),
      this.request(`${this.roomPath}/effects`)
    ])
    if (!scenes.ok || !effects.ok) throw new Error('stagehand content unavailable')
    const sceneIds = (await scenes.json() as { id: string }[]).map(s => s.id)
    const strobe = (await effects.json() as StagehandEffect[]).find(e => e.id === STROBE_EFFECT)
    // Only a one-shot lightning re-fires: any other effect toggles, and a second strobe would stop the first.
    const strobeOk = strobe?.generator === 'lightning' && !strobe.params.auto
    const missing = [...LIGHT_SCENES.filter(name => !sceneIds.includes(name)), ...(strobeOk ? [] : [`effet ${STROBE_EFFECT} (sans répétition)`])]
    if (missing.join() === this.missing.join()) return
    this.missing = missing
    this.notify()
  }

  private setStatus(status: LightStatus): void {
    if (status === this.status) return
    this.status = status
    this.notify()
  }

  private notify(): void {
    this.listeners.forEach(l => l(this.status))
  }
}

interface StagehandEffect {
  id: string
  generator: string
  params: { auto?: boolean }
}

/** Used when stagehand is not configured: logs what would have been sent. */
export class FakeLight implements LightPort {
  readonly status: LightStatus = 'fake'
  readonly missing: string[] = []

  onStatusChange(): void {}

  async send(command: LightCommand): Promise<void> {
    console.log('[lumière simulée]', JSON.stringify(command))
  }
}
