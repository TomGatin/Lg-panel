import { AmbienceId, Cue, GameAction, GameState, LightStatus, PublicView, ShowCommand, ShowState, SfxId } from './types'

export type ClientRole = 'mj' | 'regie' | 'public'

export type ClientMessage =
  | { t: 'action'; id: string; action: GameAction }
  | { t: 'undo'; id: string }
  | { t: 'redo'; id: string }
  | { t: 'show'; id: string; command: ShowCommand }

export interface StaffSnapshot {
  game: GameState
  show: ShowState
  cues: Cue[]
  canUndo: boolean
  canRedo: boolean
  lightStatus: LightStatus
  connected: Record<ClientRole, number>
}

export type ServerMessage =
  /** `serverNow` lets clients correct their clock so timers agree across devices. */
  | { t: 'staff'; version: number; serverNow: number; snapshot: StaffSnapshot }
  | { t: 'public'; version: number; serverNow: number; view: PublicView }
  | { t: 'ack'; id: string; ok: true }
  | { t: 'ack'; id: string; ok: false; error: string }
  /** Sound to play on the régie's speakers. */
  | { t: 'audio'; sfx?: SfxId; ambience?: AmbienceId }
  | { t: 'denied'; reason: string }

export const WS_PATH = '/ws'
