import { timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, Server } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
import { buildCues, mjNextCue, startsDebate, stepChangeCutsSound } from '../shared/cues'
import { projectPublic } from '../shared/project'
import { AckedMessage, ClientMessage, ClientRole, ServerMessage, StaffSnapshot, WS_PATH } from '../shared/protocol'
import { RuleError } from '../shared/reducer'
import { getCurrentNightStep, NightStepId } from '../shared/rules'
import { skyPosition } from '../shared/sky'
import { Cue, ScreenView } from '../shared/types'
import { LightPort } from './light'
import { ShowController } from './show'
import { GameStore } from './store'

const HEARTBEAT_MS = 15_000
const ACK_MEMORY = 500

interface Client {
  ws: WebSocket
  role: ClientRole
  alive: boolean
  audioReady: boolean
}

/**
 * Staff views need the pairing token, from every machine. No exemption for loopback: in dev the
 * Vite proxy makes every phone look like 127.0.0.1, and so would any reverse proxy in front.
 */
export function isTrusted(token: string | null | undefined, expected: string): boolean {
  if (!token || !expected) return false
  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export class Hub {
  private clients = new Set<Client>()
  private version = 0
  private cues: Cue[] = []
  // Phones resend an action after a reconnect: remember recent ids so it is applied once.
  private acks = new Map<string, ServerMessage>()
  private readonly show: ShowController
  private nightStep: NightStepId | undefined
  private nightFalls = false
  private timeUp: ReturnType<typeof setTimeout> | undefined

  constructor(
    private readonly store: GameStore,
    private readonly light: LightPort,
    private readonly token: string,
    private readonly showFactory: (emit: (m: ServerMessage) => void) => ShowController
  ) {
    this.show = this.showFactory(m => this.sendTo(this.show.state.audioOutput, m))
    this.light.onStatusChange(() => this.broadcast())
    this.refresh()
  }

  attach(server: Server): void {
    const wss = new WebSocketServer({ noServer: true })
    server.on('upgrade', (req: IncomingMessage, socket, head) => {
      const url = new URL(req.url ?? '/', 'http://localhost')
      if (url.pathname !== WS_PATH) return
      wss.handleUpgrade(req, socket, head, ws => this.onConnection(ws, url))
    })
    const timer = setInterval(() => {
      for (const c of this.clients) {
        if (!c.alive) {
          c.ws.terminate()
          continue
        }
        c.alive = false
        c.ws.ping()
      }
    }, HEARTBEAT_MS)
    timer.unref()
  }

  private onConnection(ws: WebSocket, url: URL): void {
    const role = url.searchParams.get('role')
    if (role !== 'mj' && role !== 'regie' && role !== 'public') {
      ws.close(4000, 'role')
      return
    }
    if (role !== 'public' && !isTrusted(url.searchParams.get('k'), this.token)) {
      this.send(ws, { t: 'denied', reason: 'Jeton invalide : rescannez le QR code affiché par le serveur.' })
      ws.close(4001, 'token')
      return
    }
    const client: Client = { ws, role, alive: true, audioReady: false }
    this.clients.add(client)
    ws.on('pong', () => { client.alive = true })
    ws.on('close', () => {
      this.clients.delete(client)
      this.broadcast()
    })
    ws.on('message', raw => {
      let msg: ClientMessage
      try {
        msg = JSON.parse(raw.toString()) as ClientMessage
      } catch {
        return
      }
      if (msg.t === 'audioReady') {
        client.audioReady = msg.ready === true
        this.broadcast()
        return
      }
      if (client.role === 'public') return
      this.handle(client, msg)
    })
    this.broadcast()
  }

  private handle(client: Client, msg: AckedMessage): void {
    const known = this.acks.get(msg.id)
    if (known) {
      this.send(client.ws, known)
      return
    }
    let error: string | undefined
    try {
      switch (msg.t) {
        case 'action':
          this.store.dispatch(msg.action)
          // « La nuit tombe » on the MJ's phone brings the night on stage too.
          this.nightFalls = msg.action.type === 'ADVANCE_TO_NIGHT'
          break
        case 'undo':
          if (!this.store.undo()) error = 'Rien à annuler.'
          break
        case 'redo':
          if (!this.store.redo()) error = 'Rien à rétablir.'
          break
        case 'show': {
          // The MJ may only play the next cue of the show; everything else is the régie's.
          const mjAllowed = client.role === 'mj' && msg.command.kind === 'go' && mjNextCue(this.cues, this.show.state) !== undefined
          if (client.role !== 'regie' && !mjAllowed) {
            error = client.role === 'mj' ? 'Rien à lancer pour l\'instant.' : 'Seule la régie pilote le spectacle.'
            break
          }
          const before = this.show.state.screen
          error = this.show.command(msg.command, this.cues)
          if (error === undefined) this.startDebate(before)
          break
        }
      }
    } catch (err) {
      if (!(err instanceof RuleError)) throw err
      error = err.message
    }
    const ack: ServerMessage = error === undefined ? { t: 'ack', id: msg.id, ok: true } : { t: 'ack', id: msg.id, ok: false, error }
    this.remember(msg.id, ack)
    this.send(client.ws, ack)
    if (error === undefined) {
      this.refresh()
      this.broadcast()
    }
  }

  private refresh(): void {
    if (this.store.state.phase === 'setup') this.show.clearCues()
    this.cues = buildCues(this.store.state)
    const game = this.store.state
    const step = game.phase === 'playing' && game.cycle === 'night' ? getCurrentNightStep(game)?.id : undefined
    if (stepChangeCutsSound(this.cues, this.nightStep, step)) this.show.command({ kind: 'stopSfx' }, this.cues)
    this.nightStep = step
    const before = this.show.state.screen
    const nightfall = this.nightFalls ? this.cues.find(c => c.kind === 'nightfall') : undefined
    this.nightFalls = false
    if (nightfall) this.show.command({ kind: 'fire', cueId: nightfall.id }, this.cues)
    this.show.autoFire(this.cues)
    this.startDebate(before)
    this.armTimeUp()
    this.light.sky(skyPosition(this.store.state, this.cues, this.show.state))
  }

  private startDebate(before: ScreenView): void {
    if (startsDebate(before, this.show.state.screen, this.store.state)) this.store.dispatch({ type: 'START_TIMER' })
  }

  // The bell tolls when the debate runs out, wherever the sound goes out.
  private armTimeUp(): void {
    clearTimeout(this.timeUp)
    const { endsAt } = this.store.state.timer
    if (endsAt === null || endsAt <= Date.now()) return
    this.timeUp = setTimeout(() => this.show.command({ kind: 'sfx', id: 'bell' }, this.cues), endsAt - Date.now())
    this.timeUp.unref()
  }

  private remember(id: string, ack: ServerMessage): void {
    this.acks.set(id, ack)
    if (this.acks.size > ACK_MEMORY) {
      const oldest = this.acks.keys().next().value
      if (oldest !== undefined) this.acks.delete(oldest)
    }
  }

  private broadcast(): void {
    this.version++
    const connected: Record<ClientRole, number> = { mj: 0, regie: 0, public: 0 }
    for (const c of this.clients) connected[c.role]++
    const snapshot: StaffSnapshot = {
      game: this.store.state,
      show: this.show.state,
      cues: this.cues,
      canUndo: this.store.canUndo,
      canRedo: this.store.canRedo,
      lightStatus: this.light.status,
      lightMissing: this.light.missing,
      connected,
      publicAudio: [...this.clients].some(c => c.role === 'public' && c.audioReady)
    }
    const serverNow = Date.now()
    const staff: ServerMessage = { t: 'staff', version: this.version, serverNow, snapshot }
    const pub: ServerMessage = { t: 'public', version: this.version, serverNow, view: projectPublic(this.store.state, this.show.state) }
    for (const c of this.clients) this.send(c.ws, c.role === 'public' ? pub : staff)
  }

  private sendTo(role: ClientRole, msg: ServerMessage): void {
    for (const c of this.clients) if (c.role === role) this.send(c.ws, msg)
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  }
}
