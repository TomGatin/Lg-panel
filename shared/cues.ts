import { getBearGrowlStatus, getNightSteps, NightStepId } from './rules'
import { Cue, CueEffects, GameState, ShowState, SfxId, Winner } from './types'

const STEP_EFFECTS: Partial<Record<NightStepId, CueEffects>> = {
  salvateur: { light: { kind: 'scene', name: 'salvateur' } },
  voyante: { light: { kind: 'scene', name: 'voyante' } },
  loups_garous: { sfx: 'wolves', light: { kind: 'scene', name: 'loups' } },
  grand_mechant_loup: { light: { kind: 'scene', name: 'loups' } },
  loup_blanc: { light: { kind: 'scene', name: 'loup_blanc' } },
  sorciere: { sfx: 'witch', light: { kind: 'scene', name: 'sorciere' } },
  joueur_de_flute: { sfx: 'flute', light: { kind: 'scene', name: 'flute' } }
}

const TARGET_COLOR = 'red'
const HUNTER_COLOR = 'amber'

/**
 * The régie's cue list for the current cycle, derived from the game.
 * A cue becomes ready when the MJ reaches its moment; the operator still decides when to fire it.
 */
export function buildCues(game: GameState): Cue[] {
  if (game.phase === 'setup') return []
  const n = game.roundNumber
  const seatOf = (id: string) => game.players.find(p => p.id === id)?.seatNumber
  const cues: Cue[] = []

  if (game.cycle === 'night') {
    cues.push({ id: `n${n}-nightfall`, kind: 'nightfall', title: 'Tombée de la nuit', ready: true,
      effects: { ambience: 'night', light: { kind: 'scene', name: 'night' }, screen: 'night' } })
    // A step cue is only playable while the MJ is on that step: once validated, its moment has passed.
    let previousDone = true
    for (const step of getNightSteps(game)) {
      const done = game.night.completedSteps[step.id] === true
      cues.push({ id: `n${n}-${step.id}`, kind: 'night_step', title: step.title, stepId: step.id,
        ready: previousDone && !done, passed: done, effects: STEP_EFFECTS[step.id] ?? {} })
      previousDone = previousDone && done
    }
  } else {
    cues.push({ id: `d${n}-daybreak`, kind: 'daybreak', title: 'Lever du jour', ready: true,
      effects: { sfx: 'rooster', ambience: 'day', light: { kind: 'scene', name: 'day' }, screen: 'day' } })
    const firstDeathSeat = game.dawnDeathIds.length > 0 ? seatOf(game.dawnDeathIds[0]) : undefined
    cues.push({ id: `d${n}-reveal`, kind: 'reveal', ready: true,
      title: game.dawnDeathIds.length > 0 ? 'Révélation des morts' : 'Le village se réveille sans perte',
      effects: {
        screen: 'reveal',
        sfx: game.dawnDeathIds.length > 0 ? 'bell' : undefined,
        light: firstDeathSeat !== undefined ? { kind: 'target', seat: firstDeathSeat, color: TARGET_COLOR } : undefined
      } })
    const bear = getBearGrowlStatus(game.players)
    if (bear?.growls && bear.bear && !game.villagePowersDisabled) {
      cues.push({ id: `d${n}-bear`, kind: 'bear', title: 'L\'ours grogne', ready: true,
        effects: { sfx: 'bear', light: { kind: 'target', seat: bear.bear.seatNumber, color: HUNTER_COLOR } } })
    }
    const accusedId = Object.keys(game.vote.corbeauBonus)[0]
    if (accusedId) {
      const seat = seatOf(accusedId)
      cues.push({ id: `d${n}-crow`, kind: 'crow', title: 'Le Corbeau a désigné', ready: true,
        effects: { sfx: 'crow', light: seat !== undefined ? { kind: 'target', seat, color: TARGET_COLOR } : undefined } })
    }
    if (game.pendingHunterShotPlayerId) {
      const seat = seatOf(game.pendingHunterShotPlayerId)
      cues.push({ id: `hunter-${game.pendingHunterShotPlayerId}`, kind: 'hunter', title: 'Le Chasseur se lève', ready: true,
        effects: { light: seat !== undefined ? { kind: 'target', seat, color: HUNTER_COLOR } : undefined } })
    }
    cues.push({ id: `d${n}-debate`, kind: 'debate', title: 'Débat', ready: true, effects: { screen: 'debate' } })
    cues.push({ id: `d${n}-vote`, kind: 'vote', title: 'Vote du village', ready: game.vote.accusedIds.length > 0,
      effects: { screen: 'vote' } })
    for (const p of game.players) {
      if (p.isAlive || p.deathRound !== `Jour ${n}`) continue
      const shot = p.deathReason === 'chasseur'
      cues.push({ id: `d${n}-death-${p.id}`, kind: 'death', ready: true,
        title: `${shot ? 'Tir du Chasseur' : 'Élimination'} : ${p.name}`,
        effects: { screen: 'reveal', sfx: shot ? 'gunshot' : 'bell',
          light: shot ? { kind: 'strobe' } : { kind: 'target', seat: p.seatNumber, color: TARGET_COLOR } } })
    }
  }

  if (game.phase === 'game_over') {
    cues.push({ id: 'victory', kind: 'victory', title: 'Fin de partie', ready: true,
      effects: { screen: 'victory', ambience: 'none', light: { kind: 'scene', name: 'victory' }, sfx: victorySfx(game.winner) } })
  }
  return cues
}

// Wolves howl over their own wins; every other camp gets the village bells.
function victorySfx(winner: Winner | undefined): SfxId {
  return winner === 'loups' || winner === 'loup_blanc' ? 'victory_wolves' : 'victory_village'
}

export function hasEffects(cue: Cue): boolean {
  const e = cue.effects
  return e.sfx !== undefined || e.ambience !== undefined || e.light !== undefined || e.screen !== undefined
}

export function isCueDone(cue: Cue, show: ShowState): boolean {
  return show.firedCueIds.includes(cue.id) || show.skippedCueIds.includes(cue.id)
}

/**
 * The cue GO will fire: the first ready one with effects after the last cue played or skipped.
 * Cues before that point are behind the show, even if they were never played.
 */
export function nextCue(cues: Cue[], show: ShowState): Cue | undefined {
  let from = 0
  cues.forEach((c, i) => { if (isCueDone(c, show)) from = i + 1 })
  return cues.slice(from).find(c => c.ready && hasEffects(c))
}

/** A cue the show has moved past without playing it. */
export function isCueBehind(cue: Cue, cues: Cue[], show: ShowState): boolean {
  if (cue.passed) return true
  const lastDone = cues.reduce((acc, c, i) => (isCueDone(c, show) ? i : acc), -1)
  return cues.indexOf(cue) < lastDone && !isCueDone(cue, show)
}

export function describeEffects(e: CueEffects): string {
  const parts: string[] = []
  if (e.sfx) parts.push(`Son : ${SFX_LABELS[e.sfx]}`)
  if (e.ambience) parts.push(e.ambience === 'none' ? 'Ambiance coupée' : `Ambiance ${e.ambience === 'night' ? 'nuit' : 'jour'}`)
  if (e.light) parts.push(`Lumière : ${describeLight(e.light)}`)
  if (e.screen) parts.push(`Écran : ${SCREEN_LABELS[e.screen]}`)
  return parts.length > 0 ? parts.join(' · ') : 'Aucun effet'
}

export function describeLight(l: NonNullable<CueEffects['light']>): string {
  switch (l.kind) {
    case 'scene': return `scène ${l.name}`
    case 'target': return `lyres sur le siège ${l.seat}`
    case 'strobe': return 'stroboscope'
    case 'blackout': return 'blackout'
    case 'full': return 'plein feu'
  }
}

export const SFX_LABELS: Record<NonNullable<CueEffects['sfx']>, string> = {
  wolves: 'Hurlement',
  rooster: 'Coq',
  bell: 'Glas',
  gunshot: 'Coup de feu',
  witch: 'Sorcière',
  flute: 'Flûte',
  bear: 'Ours',
  crow: 'Corbeau',
  victory_village: 'Cloches',
  victory_wolves: 'Meute'
}

export const SCREEN_LABELS: Record<NonNullable<CueEffects['screen']>, string> = {
  night: 'Nuit',
  day: 'Jour',
  reveal: 'Révélation',
  debate: 'Débat',
  vote: 'Vote',
  victory: 'Victoire',
  blackout: 'Noir'
}
