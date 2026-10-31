import { Cue, GameAction, GameState, LightStatus, PublicView, ShowCommand, ShowState, SfxId } from './types'

export type ClientRole = 'mj' | 'regie' | 'public'

export type ClientMessage =
  | { t: 'action'; id: string; action: GameAction }
  | { t: 'undo'; id: string }
  | { t: 'redo'; id: string }
  | { t: 'show'; id: string; command: ShowCommand }
  | { t: 'audioReady'; ready: boolean }

export type AckedMessage = Exclude<ClientMessage, { t: 'audioReady' }>

export interface StaffSnapshot {
  game: GameState
  show: ShowState
  cues: Cue[]
  canUndo: boolean
  canRedo: boolean
  lightStatus: LightStatus
  lightMissing: string[]
  connected: Record<ClientRole, number>
  publicAudio: boolean
}

export type ServerMessage =
  /** `serverNow` lets clients correct their clock so timers agree across devices. */
  | { t: 'staff'; version: number; serverNow: number; snapshot: StaffSnapshot }
  | { t: 'public'; version: number; serverNow: number; view: PublicView }
  | { t: 'ack'; id: string; ok: true }
  | { t: 'ack'; id: string; ok: false; error: string }
  | { t: 'audio'; sfx: SfxId | null }
  | { t: 'denied'; reason: string }

export const WS_PATH = '/ws'
