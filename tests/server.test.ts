import { mkdtempSync, readFileSync, appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildCues, nextCue } from '../shared/cues'
import { projectPublic } from '../shared/project'
import { ShowState } from '../shared/types'
import { GameStore } from '../server/store'
import { Game } from './helpers'

const show = (screen: ShowState['screen']): ShowState =>
  ({ firedCueIds: [], skippedCueIds: [], screen, ambience: 'none', autoKinds: [] })

describe('public projection', () => {
  it('never leaks living roles, lovers, infection or night targets', () => {
    const g = new Game(['infect_pere_des_loups', 'voyante', 'cupidon', 'villageois', 'villageois', 'villageois'], ['Ana', 'Bea', 'Cid', 'Dan', 'Eve', 'Fay'])
    g.do({ type: 'TOGGLE_LOVER', playerId: g.id(4) }, { type: 'TOGGLE_LOVER', playerId: g.id(5) },
      { type: 'SET_NIGHT_TARGET', key: 'seerTargetId', playerId: g.id(1) },
      { type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: g.id(6) }, { type: 'SET_INFECT_VICTIM', infect: true })
    for (const screen of ['night', 'day', 'reveal', 'debate', 'vote', 'victory'] as const) {
      const json = JSON.stringify(projectPublic(g.state, show(screen)))
      for (const secret of ['Infect', 'Voyante', 'Cupidon', 'Lover', 'Infected', 'Charm', 'p1', 'seer']) {
        expect(json).not.toContain(secret)
      }
    }
  })

  it('reveals the role of the dead on the reveal screen only', () => {
    const g = new Game(['loup_garou', 'voyante', 'villageois', 'villageois'], ['Ana', 'Bea', 'Cid', 'Dan'])
    g.do({ type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: g.id(2) }).dawn()
    expect(projectPublic(g.state, show('reveal')).lastDeaths).toEqual([{ name: 'Bea', roleId: 'voyante', roleName: 'Voyante' }])
    expect(projectPublic(g.state, show('day')).lastDeaths).toEqual([])
  })
})

describe('cues', () => {
  it('arms the wolves cue once the steps before it are validated', () => {
    const g = new Game(['loup_garou', 'voyante', 'villageois', 'villageois'])
    const wolves = () => buildCues(g.state).find(c => c.stepId === 'loups_garous')
    expect(wolves()?.ready).toBe(false)
    g.do({ type: 'COMPLETE_NIGHT_STEP', stepId: 'voyante' })
    expect(wolves()?.ready).toBe(true)
    const played = { ...show('night'), firedCueIds: ['n1-nightfall'] }
    expect(nextCue(buildCues(g.state), played)?.stepId).toBe('loups_garous')
  })

  it('never offers a cue the operator has already jumped past', () => {
    const g = new Game(['loup_garou', 'villageois', 'villageois', 'villageois'])
    g.do({ type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: g.id(2) }).dawn()
    const cues = buildCues(g.state)
    expect(nextCue(cues, show('day'))?.kind).toBe('daybreak')
    const jumped = { ...show('reveal'), firedCueIds: ['d1-reveal'] }
    expect(nextCue(cues, jumped)?.kind).toBe('debate')
  })
})

describe('store', () => {
  it('undoes and redoes without limit', () => {
    const store = new GameStore()
    store.dispatch({ type: 'SETUP_GAME', players: [
      { name: 'A', roleId: 'loup_garou', seatNumber: 1 },
      { name: 'B', roleId: 'villageois', seatNumber: 2 },
      { name: 'C', roleId: 'villageois', seatNumber: 3 },
      { name: 'D', roleId: 'villageois', seatNumber: 4 }
    ] })
    const afterSetup = store.state
    store.dispatch({ type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: 'p2' })
    store.dispatch({ type: 'ADVANCE_TO_DAY' })
    const afterDawn = store.state
    expect(store.undo() && store.undo()).toBe(true)
    expect(store.state).toEqual(afterSetup)
    expect(store.redo() && store.redo()).toBe(true)
    expect(store.state).toEqual(afterDawn)
    expect(store.redo()).toBe(false)
  })

  it('rebuilds the same state from its journal, ignoring a truncated last line', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'lg-')), 'session.jsonl')
    let t = 5_000
    const store = new GameStore(file, () => (t += 1000))
    store.dispatch({ type: 'SETUP_GAME', players: [
      { name: 'A', roleId: 'loup_garou', seatNumber: 1 },
      { name: 'B', roleId: 'chasseur', seatNumber: 2 },
      { name: 'C', roleId: 'villageois', seatNumber: 3 },
      { name: 'D', roleId: 'villageois', seatNumber: 4 }
    ] })
    store.dispatch({ type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: 'p2' })
    store.dispatch({ type: 'ADVANCE_TO_DAY' })
    store.undo()
    store.redo()
    store.dispatch({ type: 'START_TIMER' })
    appendFileSync(file, '{"kind":"act')
    const reloaded = new GameStore(file)
    expect(reloaded.state).toEqual(store.state)
    expect(reloaded.canUndo).toBe(true)
    expect(readFileSync(file, 'utf8').split('\n').length).toBeGreaterThan(5)
  })
})
