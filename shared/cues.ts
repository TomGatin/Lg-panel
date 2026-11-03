import { eveningDeaths, getBearGrowlStatus, getNightSteps, NightStepId, turnLabel } from './rules'
import { Cue, CueEffects, GameState, Player, ScreenView, ShowState, SfxId, Winner } from './types'

// Without it, a step with no look of its own would stay in the previous role's colors.
const NIGHT_LIGHT = { kind: 'scene', name: 'night' } as const
// The debate's look is the plain daylight; `dawn` would replay its sunrise from dark.
const DAY_LIGHT = { kind: 'scene', name: 'debate' } as const

const STEP_EFFECTS: Partial<Record<NightStepId, CueEffects>> = {
  cupidon: { sfx: 'cupid', light: { kind: 'scene', name: 'cupid' } },
  // The lovers wake up in the same pink, over the same music.
  amoureux: { keepSound: true },
  deux_soeurs: { light: NIGHT_LIGHT },
  enfant_sauvage: { light: NIGHT_LIGHT },
  chien_loup: { light: NIGHT_LIGHT },
  renard: { light: { kind: 'scene', name: 'fox' } },
  salvateur: { light: { kind: 'scene', name: 'salvateur' } },
  voyante: { light: { kind: 'scene', name: 'seer' } },
  loups_garous: { sfx: 'wolves', light: { kind: 'scene', name: 'wolves' } },
  grand_mechant_loup: { sfx: 'wolves', light: { kind: 'scene', name: 'wolves' } },
  loup_blanc: { sfx: 'wolves', light: { kind: 'scene', name: 'loup-blanc' } },
  sorciere: { sfx: 'witch', light: { kind: 'scene', name: 'witch' } },
  joueur_de_flute: { sfx: 'flute', light: { kind: 'scene', name: 'flute' } },
  charmes_reveil: { sfx: 'flute' }
}

/** Scenes the cues call: they must exist under these ids in stagehand, which only accepts slugs. */
export const LIGHT_SCENES = ['night', 'dawn', 'debate', 'vote', 'salvateur', 'seer', 'fox', 'wolves', 'loup-blanc', 'witch', 'flute', 'cupid', 'death', 'victory-village', 'victory-wolves', 'solo', 'full']

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
  // Announced once, in the turn the captain was named (election or succession).
  const named = game.players.find(p => p.isCaptain && p.isAlive)
  const captain: Cue | undefined = named && game.captainRound === turnLabel(game)
    ? { id: `captain-${game.captainRound}-${named.id}`, kind: 'captain', title: `Capitaine : ${named.name}`, ready: true,
        effects: { screen: 'captain', sfx: 'announcement', light: game.cycle === 'day' ? DAY_LIGHT : undefined } }
    : undefined

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
    if (captain) cues.push(captain)
  } else {
    cues.push({ id: `d${n}-daybreak`, kind: 'daybreak', title: 'Lever du jour', ready: true,
      effects: { sfx: 'rooster', ambience: 'day', light: { kind: 'scene', name: 'dawn' }, screen: 'day' } })
    if (game.dawnDeathIds.length === 0) {
      // A night without victims is good news.
      cues.push({ id: `d${n}-reveal`, kind: 'reveal', title: 'Le village se réveille sans perte', ready: true,
        effects: { screen: 'reveal', reveal: [], sfx: 'announcement', light: DAY_LIGHT } })
    }
    // One victim at a time, at the pace of the narration: the screen adds each name under the previous ones.
    game.dawnDeathIds.forEach((id, i) => {
      const p = game.players.find(x => x.id === id)
      cues.push({ id: `d${n}-reveal-${id}`, kind: 'reveal', title: `Révélation : ${p?.name ?? id}`, ready: true, playerId: id,
        // A hunter shot at dawn would otherwise replace the night's victims on the screen.
        effects: { screen: 'reveal', reveal: game.dawnDeathIds.slice(0, i + 1), sfx: 'bell', light: DEATH_LIGHT } })
    })
    const bear = getBearGrowlStatus(game.players)
    // A page every morning while the tamer lives: the MJ must know whether to growl, and silence is news too.
    if (bear && !game.villagePowersDisabled) {
      cues.push(bear.growls
        ? { id: `d${n}-bear`, kind: 'bear', title: 'L\'ours grogne', ready: true, effects: { sfx: 'bear', light: DAY_LIGHT } }
        : { id: `d${n}-bear`, kind: 'bear', title: 'L\'ours reste silencieux', ready: true, effects: { light: DAY_LIGHT } })
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
      return { id: `d${n}-death-${p.id}`, kind: 'death', ready: true, playerId: p.id,
        title: `${shot ? 'Tir du Chasseur' : 'Élimination'} : ${p.name}`,
        effects: { screen: 'reveal', sfx: shot ? 'gunshot' : 'bell', light: shot ? { kind: 'strobe' } : DEATH_LIGHT } }
    }
    // In the order they died, so a second vote falls between the two condemned.
    const order = game.dayDeathIds ?? []
    const rank = (p: Player) => (order.includes(p.id) ? order.indexOf(p.id) : order.length)
    const evening = eveningDeaths(game).sort((a, b) => rank(a) - rank(b))
    // A Hunter found dead at dawn shoots before the debate: his shot belongs to the morning.
    const diedToday = game.players.filter(p => !p.isAlive && p.deathRound === `Jour ${n}`)
    cues.push(...diedToday.filter(p => !evening.includes(p)).map(deathCue))
    // The village must have a captain before it debates: the election is a page of its own (reached with « Valider »,
    // so it never covers the page before it), then the announcement, which the show waits on until someone is elected.
    // A dawn successor goes through the same two steps; a captain named after a death is announced once it is revealed.
    const electedHere = named !== undefined && game.captainRound === turnLabel(game) && !game.captainAfterVote
    if (game.phase === 'playing' && (!named || electedHere)) {
      cues.push({ id: `d${n}-election`, kind: 'election', title: 'Élection du Capitaine', ready: true, effects: { light: DAY_LIGHT } })
      cues.push({ id: `d${n}-captain`, kind: 'captain', title: named ? `Capitaine : ${named.name}` : 'Annonce du Capitaine',
        ready: named !== undefined, blocking: true, effects: { screen: 'captain', sfx: 'announcement', light: DAY_LIGHT } })
    } else if (captain && !game.captainAfterVote) {
      cues.push({ ...captain, id: `d${n}-captain` })
    }
    // A game decided at dawn goes straight to the victory.
    if (game.phase !== 'game_over' || evening.length > 0) {
      cues.push({ id: `d${n}-debate`, kind: 'debate', title: 'Débat', ready: true, effects: { screen: 'debate', light: { kind: 'scene', name: 'debate' } } })
      // The MJ may open the vote before anyone is accused: accusations can come at the vote itself.
      cues.push({ id: `d${n}-vote`, kind: 'vote', title: 'Vote du village', ready: true, effects: { screen: 'vote', light: { kind: 'scene', name: 'vote' } } })
    }
    const secondAt = game.secondVoteAt
    if (secondAt === undefined) {
      cues.push(...evening.map(deathCue))
    } else {
      cues.push(...evening.filter(p => rank(p) < secondAt).map(deathCue))
      cues.push({ id: `d${n}-vote2`, kind: 'vote', title: 'Second vote (Juge Bègue)', ready: true, effects: { screen: 'vote', light: { kind: 'scene', name: 'vote' } } })
      cues.push(...evening.filter(p => rank(p) >= secondAt).map(deathCue))
    }
    if (captain && game.captainAfterVote) cues.push(captain)
  }

  if (game.phase === 'game_over') {
    cues.push({ id: 'victory', kind: 'victory', title: 'Fin de partie', ready: true,
      effects: { screen: 'victory', ambience: 'none', light: { kind: 'scene', name: victoryScene(game.winner) }, sfx: victorySfx(game.winner) } })
  }
  return cues
}

const isSoloWin = (winner: Winner | undefined) =>
  winner === 'loup_blanc' || winner === 'joueur_de_flute' || winner === 'ange' || winner === 'amoureux'

// With nobody left alive there is no winner to celebrate: the room stays in plain daylight.
function victoryScene(winner: Winner | undefined): string {
  if (isSoloWin(winner)) return 'solo'
  if (winner === 'village') return 'victory-village'
  return winner === 'loups' ? 'victory-wolves' : DAY_LIGHT.name
}

// Wolves howl over their own wins; lone winners and lovers share one sting; the rest gets the village bells.
function victorySfx(winner: Winner | undefined): SfxId {
  if (isSoloWin(winner)) return 'solo'
  return winner === 'loups' ? 'victory_wolves' : 'victory_village'
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

/** Whether the MJ moving between two night steps ends the sound of the step they left. */
export function stepChangeCutsSound(cues: Cue[], before: NightStepId | undefined, after: NightStepId | undefined): boolean {
  if (before === undefined || before === after) return false
  const i = cues.findIndex(c => c.stepId === after)
  // Only when moving forward: an undo landing on the step must not carry over another step's sound.
  return !(cues[i]?.effects.keepSound && cues[i - 1]?.stepId === before)
}

export function isCueDone(cue: Cue, show: ShowState): boolean {
  return show.firedCueIds.includes(cue.id) || show.skippedCueIds.includes(cue.id)
}

/**
 * The cue GO will fire: the first ready one with effects after the last cue played or skipped.
 * Cues before that point are behind the show, even if they were never played,
 * except a captain named after his announcement's place went by: it comes first.
 */
export function nextCue(cues: Cue[], show: ShowState): Cue | undefined {
  let from = 0
  cues.forEach((c, i) => { if (isCueDone(c, show)) from = i + 1 })
  const lateCaptain = cues.slice(0, from).find(c => c.kind === 'captain' && c.ready && !isCueDone(c, show))
  if (lateCaptain) return lateCaptain
  const next = cues.slice(from).find(c => (c.ready && hasEffects(c)) || c.blocking)
  return next?.ready ? next : undefined
}

/** A step the show waits on before going further (the captain's election), if it is the next one. */
export function blockingCue(cues: Cue[], show: ShowState): Cue | undefined {
  let from = 0
  cues.forEach((c, i) => { if (isCueDone(c, show)) from = i + 1 })
  const next = cues.slice(from).find(c => (c.ready && hasEffects(c)) || c.blocking)
  return next && !next.ready ? next : undefined
}

/**
 * The cue the MJ's « Suivant » plays: the whole show, from nightfall to victory.
 * Night steps are not in it: they follow the MJ's validations (automatic mode of the régie).
 */
export function mjNextCue(cues: Cue[], show: ShowState): Cue | undefined {
  const next = nextCue(cues, show)
  return next && next.kind !== 'night_step' ? next : undefined
}

/** The cue on stage now: the last one played that still belongs to this turn. The MJ's day page follows it. */
export function currentCue(cues: Cue[], show: ShowState): Cue | undefined {
  for (let i = show.firedCueIds.length - 1; i >= 0; i--) {
    const cue = cues.find(c => c.id === show.firedCueIds[i])
    if (cue) return cue
  }
  return undefined
}

/** The moments of the day the MJ walks through, one page each. */
export function dayCues(cues: Cue[]): Cue[] {
  return cues.filter(c => c.kind !== 'night_step' && c.kind !== 'nightfall' && hasEffects(c))
}

/** A cue the show has moved past without playing it. */
export function isCueBehind(cue: Cue, cues: Cue[], show: ShowState): boolean {
  if (cue.passed) return true
  if (cue.kind === 'captain') return false
  const lastDone = cues.reduce((acc, c, i) => (isCueDone(c, show) ? i : acc), -1)
  return cues.indexOf(cue) < lastDone && !isCueDone(cue, show)
}

export function describeEffects(e: CueEffects): string {
  const parts: string[] = []
  if (e.keepSound) parts.push('Le son continue')
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
  victory_wolves: 'Meute',
  cupid: 'Cupidon',
  solo: 'Victoire solo'
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
