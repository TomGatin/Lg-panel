import { getBearGrowlStatus, getNightSteps, NightStepId, turnLabel } from './rules'
import { Cue, CueEffects, GameState, Player, ScreenView, ShowState, SfxId, Winner } from './types'

const STEP_EFFECTS: Partial<Record<NightStepId, CueEffects>> = {
  salvateur: { light: { kind: 'scene', name: 'salvateur' } },
  voyante: { light: { kind: 'scene', name: 'voyante' } },
  loups_garous: { sfx: 'wolves', light: { kind: 'scene', name: 'loups' } },
  grand_mechant_loup: { light: { kind: 'scene', name: 'loups' } },
  loup_blanc: { light: { kind: 'scene', name: 'loup_blanc' } },
  sorciere: { sfx: 'witch', light: { kind: 'scene', name: 'sorciere' } },
  joueur_de_flute: { sfx: 'flute', light: { kind: 'scene', name: 'flute' } }
}

// Lights never single out a player: deaths get one effect for the whole room.
const DEATH_LIGHT = { kind: 'scene', name: 'death' } as const

/**
 * The régie's cue list for the current cycle, derived from the game.
 * A cue becomes ready when the MJ reaches its moment; the operator still decides when to fire it.
 */
export function buildCues(game: GameState): Cue[] {
  if (game.phase === 'setup') return []
  const n = game.roundNumber
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
    cues.push({ id: `d${n}-reveal`, kind: 'reveal', ready: true,
      title: game.dawnDeathIds.length > 0 ? 'Révélation des morts' : 'Le village se réveille sans perte',
      effects: {
        screen: 'reveal',
        // A hunter shot at dawn would otherwise replace the night's victims on the screen.
        reveal: game.dawnDeathIds,
        // The bell tolls for the dead; a night without victims is good news.
        sfx: game.dawnDeathIds.length > 0 ? 'bell' : 'announcement',
        light: game.dawnDeathIds.length > 0 ? DEATH_LIGHT : undefined
      } })
    const bear = getBearGrowlStatus(game.players)
    if (bear?.growls && bear.bear && !game.villagePowersDisabled) {
      cues.push({ id: `d${n}-bear`, kind: 'bear', title: 'L\'ours grogne', ready: true,
        effects: { sfx: 'bear' } })
    }
    const accusedId = Object.keys(game.vote.corbeauBonus)[0]
    if (accusedId) {
      cues.push({ id: `d${n}-crow`, kind: 'crow', title: 'Le Corbeau a désigné', ready: true, effects: { sfx: 'crow' } })
    }
    // A landmark in the running order only: the shot itself has its own cue.
    if (game.pendingHunterShotPlayerId) {
      cues.push({ id: `hunter-${game.pendingHunterShotPlayerId}`, kind: 'hunter', title: 'Le Chasseur se lève', ready: true, effects: {} })
    }
    const deathCue = (p: Player): Cue => {
      const shot = p.deathReason === 'chasseur'
      return { id: `d${n}-death-${p.id}`, kind: 'death', ready: true,
        title: `${shot ? 'Tir du Chasseur' : 'Élimination'} : ${p.name}`,
        effects: { screen: 'reveal', sfx: shot ? 'gunshot' : 'bell', light: shot ? { kind: 'strobe' } : DEATH_LIGHT } }
    }
    const diedToday = game.players.filter(p => !p.isAlive && p.deathRound === `Jour ${n}`)
    // A Hunter found dead at dawn shoots before the debate: his shot belongs to the morning.
    const hunterAtDawn = game.players.some(p => p.roleId === 'chasseur' && game.dawnDeathIds.includes(p.id))
    const morningShot = (p: Player) => hunterAtDawn && p.deathReason === 'chasseur'
    cues.push(...diedToday.filter(morningShot).map(deathCue))
    cues.push({ id: `d${n}-debate`, kind: 'debate', title: 'Débat', ready: true, effects: { screen: 'debate' } })
    cues.push({ id: `d${n}-vote`, kind: 'vote', title: 'Vote du village', ready: game.vote.accusedIds.length > 0,
      effects: { screen: 'vote' } })
    cues.push(...diedToday.filter(p => !morningShot(p)).map(deathCue))
  }

  // Announced once, in the turn the captain was named (election or succession).
  const captain = game.players.find(p => p.isCaptain && p.isAlive)
  if (captain && game.captainRound === turnLabel(game)) {
    cues.push({ id: `captain-${game.captainRound}-${captain.id}`, kind: 'captain', title: `Capitaine : ${captain.name}`, ready: true,
      effects: { screen: 'captain', sfx: 'announcement' } })
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

/** The debate clock starts by itself when the projector switches to the debate, unless it already ran today. */
export function startsDebate(prev: ScreenView, next: ScreenView, game: GameState): boolean {
  return prev !== 'debate' && next === 'debate' && game.phase === 'playing' && game.cycle === 'day' &&
    game.timer.endsAt === null && game.timer.pausedRemaining === null
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

/**
 * The cue the MJ's « Suivant » plays: the opening of the day, up to and including the debate.
 * Past that point (vote, eliminations, victory), the régie keeps the hand.
 */
export function mjNextCue(cues: Cue[], show: ShowState): Cue | undefined {
  const next = nextCue(cues, show)
  const debate = cues.findIndex(c => c.kind === 'debate')
  return next && debate !== -1 && cues.indexOf(next) <= debate ? next : undefined
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
  announcement: 'Annonce',
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
  blackout: 'Noir',
  village: 'Village',
  composition: 'Composition',
  captain: 'Capitaine',
  test: 'Mire'
}
