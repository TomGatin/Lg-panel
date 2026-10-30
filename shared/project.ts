import { ROLES } from './roles'
import { checkVictory } from './rules'
import { GameState, PublicView, ShowState } from './types'

/**
 * What the projector receives. Only fields listed here leave the server for /public:
 * no roles of living players, no lovers, no infection, no charm, no night targets.
 */
export function projectPublic(game: GameState, show: ShowState): PublicView {
  const byId = new Map(game.players.map(p => [p.id, p]))
  const deathIds = show.screen === 'reveal' ? game.lastDeathIds : []
  const victory = game.phase === 'game_over' && show.screen === 'victory' ? checkVictory(game) : null
  return {
    phase: game.phase,
    cycle: game.cycle,
    roundNumber: game.roundNumber,
    screen: show.screen,
    aliveCount: game.players.filter(p => p.isAlive).length,
    timer: { ...game.timer },
    accused: game.vote.accusedIds.flatMap(id => {
      const p = byId.get(id)
      return p ? [{ name: p.name, votes: game.vote.votes[id] ?? 0 }] : []
    }),
    // A dead player's card is turned face up, so their role is public.
    lastDeaths: deathIds.flatMap(id => {
      const p = byId.get(id)
      return p && !p.isAlive ? [{ name: p.name, roleId: p.roleId, roleName: ROLES[p.roleId].name }] : []
    }),
    deathMoment: game.cycle === 'day' && game.lastDeathIds.some(id => !game.dawnDeathIds.includes(id)) ? 'day' : 'dawn',
    victory: victory ? { title: victory.title, description: victory.description } : undefined,
    audio: show.audioOutput === 'public' ? { ambience: show.ambience, volumes: { ...show.volumes } } : undefined
  }
}
