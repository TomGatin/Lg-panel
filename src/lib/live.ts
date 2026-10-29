import { create } from 'zustand'
import { ClientMessage, ClientRole, ServerMessage, StaffSnapshot, WS_PATH } from '../../shared/protocol'
import { AmbienceId, GameAction, PublicView, ShowCommand, SfxId } from '../../shared/types'

type Status = 'connecting' | 'open' | 'closed' | 'denied'
type Outgoing = ClientMessage extends infer M ? (M extends ClientMessage ? Omit<M, 'id'> : never) : never

interface LiveState {
  role: ClientRole
  status: Status
  deniedReason?: string
  staff?: StaffSnapshot
  view?: PublicView
  /** serverNow - Date.now(), to read the shared timer with the server's clock. */
  clockOffset: number
  error?: string
  /** Messages not yet acknowledged; resent after a reconnect. */
  pending: number
  dispatch: (action: GameAction) => void
  undo: () => void
  redo: () => void
  show: (command: ShowCommand) => void
  clearError: () => void
}

type AudioListener = (event: { sfx?: SfxId; ambience?: AmbienceId }) => void
type AckListener = (ok: boolean) => void

const TOKEN_KEY = 'lg-token'
const outbox = new Map<string, ClientMessage>()
const audioListeners = new Set<AudioListener>()
const ackListeners = new Set<AckListener>()
let socket: WebSocket | null = null
let retryDelay = 500
let retryTimer: ReturnType<typeof setTimeout> | undefined
let errorTimer: ReturnType<typeof setTimeout> | undefined

function readToken(): string | null {
  const fromUrl = new URLSearchParams(location.search).get('k')
  try {
    if (fromUrl) localStorage.setItem(TOKEN_KEY, fromUrl)
    return fromUrl ?? localStorage.getItem(TOKEN_KEY)
  } catch {
    return fromUrl
  }
}

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export const useLive = create<LiveState>()(set => {
  const send = (msg: Outgoing) => {
    const full = { ...msg, id: newId() } as ClientMessage
    outbox.set(full.id, full)
    set({ pending: outbox.size })
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(full))
  }
  return {
    role: 'public',
    status: 'connecting',
    clockOffset: 0,
    pending: 0,
    dispatch: action => send({ t: 'action', action }),
    undo: () => send({ t: 'undo' }),
    redo: () => send({ t: 'redo' }),
    show: command => send({ t: 'show', command }),
    clearError: () => set({ error: undefined })
  }
})

function handle(msg: ServerMessage): void {
  switch (msg.t) {
    case 'staff':
      useLive.setState({ staff: msg.snapshot, clockOffset: msg.serverNow - Date.now() })
      return
    case 'public':
      useLive.setState({ view: msg.view, clockOffset: msg.serverNow - Date.now() })
      return
    case 'ack':
      outbox.delete(msg.id)
      useLive.setState({ pending: outbox.size })
      ackListeners.forEach(l => l(msg.ok))
      if (!msg.ok) {
        useLive.setState({ error: msg.error })
        clearTimeout(errorTimer)
        errorTimer = setTimeout(() => useLive.setState({ error: undefined }), 4000)
      }
      return
    case 'audio':
      audioListeners.forEach(l => l(msg))
      return
    case 'denied':
      useLive.setState({ status: 'denied', deniedReason: msg.reason })
      return
  }
}

function open(): void {
  clearTimeout(retryTimer)
  const { role, status } = useLive.getState()
  if (status === 'denied') return
  const params = new URLSearchParams({ role })
  const token = readToken()
  if (token) params.set('k', token)
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${WS_PATH}?${params}`)
  socket = ws
  useLive.setState({ status: 'connecting' })
  ws.onopen = () => {
    retryDelay = 500
    useLive.setState({ status: 'open' })
    // Anything sent while offline goes out now; the server ignores ids it already applied.
    for (const msg of outbox.values()) ws.send(JSON.stringify(msg))
  }
  ws.onmessage = e => handle(JSON.parse(String(e.data)) as ServerMessage)
  ws.onclose = () => {
    if (socket !== ws) return
    socket = null
    if (useLive.getState().status === 'denied') return
    useLive.setState({ status: 'closed' })
    retryTimer = setTimeout(open, retryDelay)
    retryDelay = Math.min(retryDelay * 2, 5000)
  }
}

/** Reconnects right away when the phone wakes up or changes network. */
function reconnectNow(): void {
  if (document.visibilityState === 'hidden') return
  if (!socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
    retryDelay = 500
    open()
  }
}

export function connect(role: ClientRole): void {
  useLive.setState({ role })
  open()
  window.addEventListener('online', reconnectNow)
  document.addEventListener('visibilitychange', reconnectNow)
}

export function onAudio(listener: AudioListener): () => void {
  audioListeners.add(listener)
  return () => audioListeners.delete(listener)
}

export function onAck(listener: AckListener): () => void {
  ackListeners.add(listener)
  return () => ackListeners.delete(listener)
}
