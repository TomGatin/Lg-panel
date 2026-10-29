import { initialGameState, reduce } from '../shared/reducer'
import { GameAction, GameState, RoleId } from '../shared/types'

/** Runs actions through the reducer with deterministic timestamps. */
export class Game {
  state: GameState = structuredClone(initialGameState)
  private seq = 0
  now = 1_000_000

  constructor(roles: RoleId[], names?: string[]) {
    this.do({
      type: 'SETUP_GAME',
      players: roles.map((roleId, i) => ({ roleId, seatNumber: i + 1, name: names?.[i] ?? `J${i + 1}` }))
    })
  }

  do(...actions: GameAction[]): this {
    for (const action of actions) {
      this.seq++
      this.state = reduce(this.state, action, { now: this.now, seq: this.seq })
    }
    return this
  }

  /** Player id by seat number (ids are `p<seat>`). */
  id(seat: number): string {
    return `p${seat}`
  }

  player(seat: number) {
    const p = this.state.players.find(x => x.seatNumber === seat)
    if (!p) throw new Error(`no seat ${seat}`)
    return p
  }

  /** Validates every remaining night step and moves to day. */
  dawn(): this {
    return this.do({ type: 'ADVANCE_TO_DAY' })
  }
}
