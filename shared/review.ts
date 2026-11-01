import { buildCues } from './cues'
import { initialGameState, reduce } from './reducer'
import { EDITION_ROLES } from './roles'
import { Cue, CueEffects, CueKind, DeathReason, GameState, RoleId, Winner } from './types'

export interface ReviewEvent {
  id: string
  group: string
  title: string
  effects: CueEffects
}

const WINS: [Winner | undefined, string][] = [
  ['village', 'Village'],
  ['loups', 'Loups-Garous'],
  ['loup_blanc', 'Loup-Garou Blanc'],
  ['joueur_de_flute', 'Joueur de Flûte'],
  ['ange', 'Ange'],
  ['amoureux', 'Amoureux'],
  [undefined, 'Égalité, tout le monde est mort']
]

function sampleGame(): GameState {
  // The tamer sits next to a wolf so the bear growls; the sisters only wake up as a pair.
  const others = EDITION_ROLES.filter(r => r !== 'loup_garou' && r !== 'montreur_ours')
  const roles: RoleId[] = ['loup_garou', 'montreur_ours', ...others, 'deux_soeurs']
  return reduce(initialGameState, {
    type: 'SETUP_GAME',
    players: roles.map((roleId, i) => ({ roleId, seatNumber: i + 1, name: `J${i + 1}` }))
  }, { now: 0, seq: 1 })
}

/**
 * Every moment of a game that can have an effect, in playing order.
 * Sampled from the real cue list on made-up games, so what is reviewed is what a game plays.
 */
export function buildReviewEvents(): ReviewEvent[] {
  const night = sampleGame()
  const day: GameState = { ...night, cycle: 'day' }
  const villager = night.players.find(p => p.roleId === 'villageois')!
  const dead = (reason: DeathReason, round: string): GameState => ({
    ...day,
    players: day.players.map(p => (p.id === villager.id ? { ...p, isAlive: false, deathReason: reason, deathRound: round } : p))
  })
  const cueOf = (game: GameState, kind: CueKind): Cue => buildCues(game).find(c => c.kind === kind)!
  const event = (id: string, group: string, cue: Cue, title = cue.title): ReviewEvent => ({ id, group, title, effects: cue.effects })

  const steps = buildCues(night).map(c => event(c.id, 'Nuit 1', c))
  const whiteWolf = buildCues({ ...night, roundNumber: 2 }).find(c => c.stepId === 'loup_blanc')!
  const afterBigWolf = steps.findIndex(e => e.id === 'n1-grand_mechant_loup') + 1
  steps.splice(afterBigWolf, 0, event('white-wolf', 'Nuit 1', whiteWolf, `${whiteWolf.title} (nuits paires)`))

  const morning = { ...dead('loups', 'Nuit 1'), dawnDeathIds: [villager.id] }
  return [
    ...steps,
    event('daybreak', 'Jour', cueOf(day, 'daybreak')),
    event('reveal-deaths', 'Jour', cueOf(morning, 'reveal')),
    event('reveal-none', 'Jour', cueOf(day, 'reveal')),
    event('bear', 'Jour', cueOf(day, 'bear')),
    event('hunter', 'Jour', cueOf({ ...day, pendingHunterShotPlayerId: villager.id }, 'hunter')),
    event('shot', 'Jour', cueOf(dead('chasseur', 'Jour 1'), 'death'), 'Tir du Chasseur'),
    event('debate', 'Jour', cueOf(day, 'debate')),
    event('vote', 'Jour', cueOf(day, 'vote')),
    event('elimination', 'Jour', cueOf(dead('vote', 'Jour 1'), 'death'), 'Élimination, ou mort de chagrin'),
    event('captain', 'Jour', cueOf({
      ...day,
      captainRound: 'Jour 1',
      players: day.players.map(p => (p.id === villager.id ? { ...p, isCaptain: true } : p))
    }, 'captain'), 'Capitaine élu'),
    ...WINS.map(([winner, title]) =>
      event(`win-${winner ?? 'none'}`, 'Fin de partie', cueOf({ ...night, phase: 'game_over', winner }, 'victory'), title))
  ]
}
