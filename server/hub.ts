import type { IncomingMessage, Server } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
import { buildCues } from '../shared/cues'
import { projectPublic } from '../shared/project'
import { ClientMessage, ClientRole, ServerMessage, StaffSnapshot, WS_PATH } from '../shared/protocol'
import { RuleError } from '../shared/reducer'
import { Cue } from '../shared/types'
import { LightPort } from './light'
import { ShowController } from './show'
import { GameStore } from './store'

const HEARTBEAT_MS = 15_000
const ACK_MEMORY = 500

interface Client {
  ws: WebSocket
  role: ClientRole
  alive: boolean
}

export function isLoopback(address: string | undefined): boolean {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

/** Staff views need the pairing token, except from the server machine itself (the régie PC). */
export function isTrusted(address: string | undefined, token: string | null, expected: string): boolean {
  return isLoopback(address) || token === expected
}

export class Hub {
  private clients = new Set<Client>()
  private version = 0
  private cues: Cue[] = []
  // Phones resend an action after a reconnect: remember recent ids so it is applied once.
  private acks = new Map<string, ServerMessage>()
  private readonly show: ShowController

  constructor(
    private readonly store: GameStore,
    private readonly light: LightPort,
    private readonly token: string,
    private readonly showFactory: (emit: (m: ServerMessage) => void) => ShowController
  ) {
    this.show = this.showFactory(m => this.sendTo('regie', m))
    this.light.onStatusChange(() => this.broadcast())
    this.refresh()
  }

  attach(server: Server): void {
    const wss = new WebSocketServer({ noServer: true })
    server.on('upgrade', (req: IncomingMessage, socket, head) => {
      const url = new URL(req.url ?? '/', 'http://localhost')
      if (url.pathname !== WS_PATH) return
      wss.handleUpgrade(req, socket, head, ws => this.onConnection(ws, req, url))
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

  private onConnection(ws: WebSocket, req: IncomingMessage, url: URL): void {
    const role = url.searchParams.get('role')
    if (role !== 'mj' && role !== 'regie' && role !== 'public') {
      ws.close(4000, 'role')
      return
    }
    if (role !== 'public' && !isTrusted(req.socket.remoteAddress, url.searchParams.get('k'), this.token)) {
      this.send(ws, { t: 'denied', reason: 'Jeton invalide : rescannez le QR code affiché par le serveur.' })
      ws.close(4001, 'token')
      return
    }
    const client: Client = { ws, role, alive: true }
    this.clients.add(client)
    ws.on('pong', () => { client.alive = true })
    ws.on('close', () => {
      this.clients.delete(client)
      this.broadcast()
    })
    ws.on('message', raw => {
      if (client.role === 'public') return
      let msg: ClientMessage
      try {
        msg = JSON.parse(raw.toString()) as ClientMessage
      } catch {
        return
      }
      this.handle(client, msg)
    })
    this.broadcast()
  }

  private handle(client: Client, msg: ClientMessage): void {
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
          break
        case 'undo':
          if (!this.store.undo()) error = 'Rien à annuler.'
          break
        case 'redo':
          if (!this.store.redo()) error = 'Rien à rétablir.'
          break
        case 'show':
          if (client.role !== 'regie') error = 'Seule la régie pilote le spectacle.'
          else error = this.show.command(msg.command, this.cues)
          break
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
    this.show.autoFire(this.cues)
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
      connected
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
