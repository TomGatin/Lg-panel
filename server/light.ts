import { LightCommand, LightStatus } from '../shared/types'

/**
 * Everything lg-panel needs from the lighting side.
 * light-engine's HTTP API is still moving: only HttpLight knows its routes.
 */
export interface LightPort {
  send(command: LightCommand): Promise<void>
  readonly status: LightStatus
  onStatusChange(listener: (status: LightStatus) => void): void
}

const REQUEST_TIMEOUT_MS = 500
const HEALTH_INTERVAL_MS = 5000

export class HttpLight implements LightPort {
  status: LightStatus = 'down'
  private listeners: ((status: LightStatus) => void)[] = []

  constructor(private readonly baseUrl: string) {
    void this.checkHealth()
    setInterval(() => void this.checkHealth(), HEALTH_INTERVAL_MS).unref()
  }

  onStatusChange(listener: (status: LightStatus) => void): void {
    this.listeners.push(listener)
  }

  // Fire-and-forget: a slow or dead light-engine must never block the game.
  async send(command: LightCommand): Promise<void> {
    const [path, body] = this.route(command)
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      })
      this.setStatus(res.ok ? 'ok' : 'down')
    } catch {
      this.setStatus('down')
    }
  }

  private route(command: LightCommand): [string, object | undefined] {
    switch (command.kind) {
      case 'scene': return [`/api/scenes/${encodeURIComponent(command.name)}`, undefined]
      case 'target': return ['/api/target', { seatId: command.seat, color: command.color }]
      case 'strobe': return ['/api/strobe', undefined]
      case 'blackout': return ['/api/blackout', undefined]
      case 'full': return ['/api/scenes/full', undefined]
    }
  }

  private async checkHealth(): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/api/status`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
      this.setStatus(res.ok ? 'ok' : 'down')
    } catch {
      this.setStatus('down')
    }
  }

  private setStatus(status: LightStatus): void {
    if (status === this.status) return
    this.status = status
    this.listeners.forEach(l => l(status))
  }
}

/** Used when no LIGHT_ENGINE_URL is set: logs what would have been sent. */
export class FakeLight implements LightPort {
  readonly status: LightStatus = 'fake'

  onStatusChange(): void {}

  async send(command: LightCommand): Promise<void> {
    console.log('[lumière simulée]', JSON.stringify(command))
  }
}
