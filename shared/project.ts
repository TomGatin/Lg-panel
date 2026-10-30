import { ROLES } from './roles'
import { checkVictory } from './rules'
import { GameState, Player, PublicView, RoleId, ShowState } from './types'

/**
 * What the projector receives. Only fields listed here leave the server for /public:
 * no roles of living players (except the revealed Idiot), no lovers, no infection, no charm, no night targets.
 */
export function projectPublic(game: GameState, show: ShowState): PublicView {
  const byId = new Map(game.players.map(p => [p.id, p]))
  const shownIds = show.revealIds ?? game.lastDeathIds
  const deathIds = show.screen === 'reveal' ? shownIds : []
  const victory = game.phase === 'game_over' && show.screen === 'victory' ? checkVictory(game) : null
  const captain = game.players.find(p => p.isCaptain && p.isAlive)
  return {
    phase: game.phase,
    cycle: game.cycle,
    roundNumber: game.roundNumber,
    screen: show.screen,
    aliveCount: game.players.filter(p => p.isAlive).length,
    timer: { ...game.timer },
    accused: game.vote.accusedIds.flatMap(id => {
      const p = byId.get(id)
      return p ? [{ seat: p.seatNumber, name: p.name, votes: game.vote.votes[id] ?? 0 }] : []
    }),
    // A dead player's card is turned face up, so their role is public.
    lastDeaths: deathIds.flatMap(id => {
      const p = byId.get(id)
      return p && !p.isAlive ? [{ seat: p.seatNumber, name: p.name, roleId: p.roleId, roleName: ROLES[p.roleId].name }] : []
    }),
    deathMoment: game.cycle === 'day' && shownIds.some(id => !game.dawnDeathIds.includes(id)) ? 'day' : 'dawn',
    victory: victory ? { title: victory.title, description: victory.description } : undefined,
    captain: captain?.name,
    village: show.screen === 'village' && show.villageScreen
      ? game.players.map(p => ({ seat: p.seatNumber, name: p.name, alive: p.isAlive, captain: p.isCaptain && p.isAlive,
          roleName: p.isAlive && !p.idiotRevealed ? undefined : ROLES[p.roleId].name }))
      : undefined,
    finalReveal: game.phase === 'game_over' && show.screen === 'victory'
      ? game.players.map(p => ({ seat: p.seatNumber, name: p.name, alive: p.isAlive, captain: p.isCaptain && p.isAlive,
          roleName: ROLES[p.roleId].name, tags: finalTags(p) }))
      : undefined,
    composition: show.screen === 'composition' ? countRoles(game.composition) : undefined,
    audio: show.audioOutput === 'public' ? { ambience: show.ambience, volumes: { ...show.volumes } } : undefined
  }
}

// Secrets that only make sense once the game is over.
function finalTags(p: Player): string[] {
  return [p.isLover && 'amoureux', p.isInfected && 'infecté', p.isCharmed && 'charmé']
    .filter((t): t is string => typeof t === 'string')
}

// Counts only, in the order of the role list, so the seats stay secret.
function countRoles(roles: RoleId[]): { roleName: string; count: number }[] {
  return (Object.keys(ROLES) as RoleId[]).flatMap(id => {
    const count = roles.filter(r => r === id).length
    return count > 0 ? [{ roleName: ROLES[id].name, count }] : []
  })
}
