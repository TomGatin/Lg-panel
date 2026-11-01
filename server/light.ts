import { LIGHT_SCENES } from '../shared/cues'
import { arcPoint, arcTargets, PanTilt, SKY_BODIES, SKY_MOTION, SkyPosition } from '../shared/sky'
import { LightCommand, LightStatus } from '../shared/types'

/**
 * Everything lg-panel needs from the lighting side.
 * stagehand's HTTP API is still moving: only StagehandLight knows its routes.
 */
export interface LightPort {
  send(command: LightCommand): Promise<void>
  /** Moves the moon or the sun along its arc; null leaves it where it is. */
  sky(position: SkyPosition | null): void
  readonly status: LightStatus
  /** Scenes or effects the cues need that the lighting side does not have. */
  readonly missing: string[]
  onStatusChange(listener: (status: LightStatus) => void): void
}

const REQUEST_TIMEOUT_MS = 500
const HEALTH_INTERVAL_MS = 5000
const STROBE_EFFECT = 'lightning'
const GLIDE_MS = 2000
// Long enough for a slowed head to arrive; scenes need fast heads again afterwards.
const SPEED_HOLD_MS = 5000

const smooth = (x: number) => x * x * (3 - 2 * x)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export class StagehandLight implements LightPort {
  status: LightStatus = 'down'
  missing: string[] = []
  private listeners: ((status: LightStatus) => void)[] = []
  private readonly baseUrl: string
  private readonly roomPath: string
  private skyTarget: SkyPosition | undefined
  // Where each body really is, so a glide cut short resumes from there.
  private skyAt = new Map<string, number>()
  private skyRun = 0
  private headSpeed = 0
  private speedReset: ReturnType<typeof setTimeout> | undefined

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

  sky(position: SkyPosition | null): void {
    if (!position) return
    if (position.body === this.skyTarget?.body && position.progress === this.skyTarget.progress) return
    this.skyTarget = position
    void this.moveSky(true)
  }

  // Scenes aiming at the `moon` or `sun` target follow it: moving the target moves the heads.
  private async moveSky(glide: boolean): Promise<void> {
    const position = this.skyTarget
    if (!position) return
    const run = ++this.skyRun
    try {
      const res = await this.request(`${this.roomPath}/targets`)
      if (!res.ok) return
      const heads = arcHeads(await res.json() as StagehandTarget[], arcTargets(position.body))
      const from = this.skyAt.get(position.body)
      const glides = glide && from !== undefined
      const { commands, speed } = SKY_MOTION[position.body]
      const steps = glides ? commands : 1
      clearTimeout(this.speedReset)
      await this.setHeadSpeed(glides ? speed : 0)
      if (this.headSpeed > 0) {
        this.speedReset = setTimeout(() => void this.setHeadSpeed(0).catch(() => undefined), SPEED_HOLD_MS)
        this.speedReset.unref()
      }
      for (let i = 1; i <= steps; i++) {
        if (run !== this.skyRun) return
        const t = from === undefined ? position.progress : from + (position.progress - from) * smooth(i / steps)
        await Promise.all(heads.map(({ fixtureId, arc }) => this.request(
          `${this.roomPath}/targets/${position.body}/positions/${encodeURIComponent(fixtureId)}`,
          'PUT', arcPoint(arc[0], arc[1], arc[2], t))))
        this.skyAt.set(position.body, t)
        if (i < steps) await delay(GLIDE_MS / steps)
      }
    } catch {
      this.setStatus('down')
    }
  }

  private async setHeadSpeed(value: number): Promise<void> {
    if (value === this.headSpeed) return
    await this.request(`${this.roomPath}/playback/head-speed`, 'PUT', { value })
    this.headSpeed = value
  }

  private route(command: LightCommand): string {
    switch (command.kind) {
      case 'scene': return `${this.roomPath}/scenes/${encodeURIComponent(command.name)}/go`
      case 'full': return `${this.roomPath}/scenes/full/go`
      case 'strobe': return `${this.roomPath}/effects/${STROBE_EFFECT}/fire`
      case 'blackout': return '/api/dmx/blackout'
    }
  }

  private request(path: string, method = 'GET', body?: object): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { authorization: `Bearer ${this.token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
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
    const [scenes, effects, targets] = await Promise.all([
      this.request(`${this.roomPath}/scenes`),
      this.request(`${this.roomPath}/effects`),
      this.request(`${this.roomPath}/targets`)
    ])
    if (!scenes.ok || !effects.ok || !targets.ok) throw new Error('stagehand content unavailable')
    const sceneIds = (await scenes.json() as { id: string }[]).map(s => s.id)
    const strobe = (await effects.json() as StagehandEffect[]).find(e => e.id === STROBE_EFFECT)
    // Only a one-shot lightning re-fires: any other effect toggles, and a second strobe would stop the first.
    const strobeOk = strobe?.generator === 'lightning' && !strobe.params.auto
    const targetIds = (await targets.json() as StagehandTarget[]).filter(t => t.positions.length > 0).map(t => t.id)
    const missing = [
      ...LIGHT_SCENES.filter(name => !sceneIds.includes(name)),
      ...(strobeOk ? [] : [`effet ${STROBE_EFFECT} (sans répétition)`]),
      ...SKY_BODIES.flatMap(body => [body, ...arcTargets(body)]).filter(id => !targetIds.includes(id)).map(id => `cible ${id}`)
    ]
    if (missing.join() === this.missing.join()) return
    this.missing = missing
    this.notify()
  }

  private setStatus(status: LightStatus): void {
    if (status === this.status) return
    const recovered = this.status === 'down' && status === 'ok'
    this.status = status
    this.notify()
    if (recovered) void this.moveSky(false)
  }

  private notify(): void {
    this.listeners.forEach(l => l(this.status))
  }
}

interface StagehandTarget {
  id: string
  positions: (PanTilt & { fixtureId: string })[]
}

/** The heads calibrated on all three points of an arc. */
function arcHeads(targets: StagehandTarget[], arc: string[]) {
  const points = arc.map(id => targets.find(t => t.id === id)?.positions ?? [])
  return points[0].flatMap(({ fixtureId }) => {
    const found = points.map(list => list.find(p => p.fixtureId === fixtureId))
    const [a, b, c] = found
    return a && b && c ? [{ fixtureId, arc: [a, b, c] }] : []
  })
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
  private skyLogged = ''

  onStatusChange(): void {}

  sky(position: SkyPosition | null): void {
    const logged = JSON.stringify(position)
    if (!position || logged === this.skyLogged) return
    this.skyLogged = logged
    console.log('[lumière simulée]', logged)
  }

  async send(command: LightCommand): Promise<void> {
    console.log('[lumière simulée]', JSON.stringify(command))
  }
}
