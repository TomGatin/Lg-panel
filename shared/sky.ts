import { isCueDone } from './cues'
import { getNightSteps } from './rules'
import { Cue, CueKind, GameState, ShowState } from './types'

export type SkyBody = 'moon' | 'sun'

/** Where the moon or the sun is on its arc: 0 rises on the left, 1 sets on the right. */
export interface SkyPosition {
  body: SkyBody
  progress: number
}

export interface PanTilt {
  pan: number
  tilt: number
}

export const SKY_BODIES: SkyBody[] = ['moon', 'sun']

/** How a glide reaches the heads: orders sent over its 2 s, and their speed channel (0 fastest, 255 slowest). */
export interface SkyMotion {
  commands: number
  speed: number
}

// Two heads must stay together, and their motors drift apart when fed many small orders.
export const SKY_MOTION: Record<SkyBody, SkyMotion> = {
  moon: { commands: 1, speed: 200 },
  sun: { commands: 20, speed: 0 }
}

const ARC_POINTS = ['start', 'zenith', 'end'] as const
const SUN_CUES: CueKind[] = ['daybreak', 'reveal', 'debate', 'vote']
const MAX_16 = 65535

/** The stagehand targets an arc is calibrated with, in order. */
export const arcTargets = (body: SkyBody): string[] => ARC_POINTS.map(point => `${body}-${point}`)

/** Derived from the game, so an undo on the MJ's phone moves the moon back too. */
export function skyPosition(game: GameState, cues: Cue[], show: ShowState): SkyPosition | null {
  if (game.phase !== 'playing') return null
  if (game.cycle === 'night') {
    const steps = getNightSteps(game)
    const done = steps.filter(s => game.night.completedSteps[s.id] === true).length
    return { body: 'moon', progress: steps.length > 0 ? done / steps.length : 0 }
  }
  const reached = cues.filter(c => isCueDone(c, show)).map(c => SUN_CUES.indexOf(c.kind))
  return { body: 'sun', progress: Math.max(0, ...reached) / (SUN_CUES.length - 1) }
}

/** The curve through the three calibrated points: t 0 is the start, 0.5 the zenith, 1 the end. */
export function arcPoint(start: PanTilt, zenith: PanTilt, end: PanTilt, t: number): PanTilt {
  const at = (a: number, b: number, c: number) =>
    Math.round(Math.min(MAX_16, Math.max(0, a * (1 - t) * (1 - 2 * t) + b * 4 * t * (1 - t) + c * t * (2 * t - 1))))
  return { pan: at(start.pan, zenith.pan, end.pan), tilt: at(start.tilt, zenith.tilt, end.tilt) }
}
