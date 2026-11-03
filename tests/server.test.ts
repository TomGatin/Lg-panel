import { mkdtempSync, readdirSync, readFileSync, appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { blockingCue, buildCues, currentCue, LIGHT_SCENES, mjNextCue, nextCue, SFX_LABELS, startsDebate, stepChangeCutsSound } from '../shared/cues'
import { projectPublic } from '../shared/project'
import { buildReviewEvents } from '../shared/review'
import { LightCommand, SfxId, ShowState } from '../shared/types'
import { isTrusted } from '../server/hub'
import { FakeLight } from '../server/light'
import { ShowController } from '../server/show'
import { GameStore } from '../server/store'
import { Hub } from '../server/hub'
import { AckedMessage } from '../shared/protocol'
import { Game } from './helpers'

const show = (screen: ShowState['screen']): ShowState =>
  ({ firedCueIds: [], skippedCueIds: [], screen, ambience: 'none', autoKinds: [], audioOutput: 'public', volumes: { master: 0.8, ambience: 0.5 }, villageScreen: false })

describe('public projection', () => {
  it('never leaks living roles, lovers, infection or night targets', () => {
    const g = new Game(['infect_pere_des_loups', 'voyante', 'cupidon', 'villageois', 'villageois', 'villageois'], ['Ana', 'Bea', 'Cid', 'Dan', 'Eve', 'Fay'])
    g.do({ type: 'TOGGLE_LOVER', playerId: g.id(4) }, { type: 'TOGGLE_LOVER', playerId: g.id(5) },
      { type: 'SET_NIGHT_TARGET', key: 'seerTargetId', playerId: g.id(1) },
      { type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: g.id(6) }, { type: 'SET_INFECT_VICTIM', infect: true })
    for (const screen of ['night', 'day', 'reveal', 'debate', 'vote', 'victory', 'village', 'captain'] as const) {
      const json = JSON.stringify(projectPublic(g.state, { ...show(screen), villageScreen: true }))
      for (const secret of ['Infect', 'Voyante', 'Cupidon', 'Lover', 'Infected', 'Charm', 'p1', 'seer']) {
        expect(json).not.toContain(secret)
      }
    }
  })

  it('reveals the role of the dead on the reveal screen only', () => {
    const g = new Game(['loup_garou', 'voyante', 'villageois', 'villageois'], ['Ana', 'Bea', 'Cid', 'Dan'])
    g.do({ type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: g.id(2) }).dawn()
    expect(projectPublic(g.state, show('reveal')).lastDeaths).toEqual([{ seat: 2, name: 'Bea', roleId: 'voyante', roleName: 'Voyante' }])
    expect(projectPublic(g.state, show('day')).lastDeaths).toEqual([])
  })
})

describe('reveal', () => {
  it('keeps the night victims on the morning reveal after the hunter shot', () => {
    const g = new Game(['loup_garou', 'chasseur', 'villageois', 'villageois', 'villageois', 'loup_garou'], ['Ana', 'Bea', 'Cid', 'Dan', 'Eve', 'Fay'])
    g.do({ type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: g.id(2) }).dawn()
    g.do({ type: 'EXECUTE_HUNTER_SHOT', targetPlayerId: g.id(3) })
    const ctl = new ShowController(undefined, new FakeLight(), () => undefined)
    ctl.command({ kind: 'fire', cueId: `d1-reveal-${g.id(2)}` }, buildCues(g.state))
    const view = projectPublic(g.state, ctl.state)
    expect(view.lastDeaths.map(d => d.name)).toEqual(['Bea'])
    expect(view.deathMoment).toBe('dawn')
    ctl.command({ kind: 'fire', cueId: `d1-death-${g.id(3)}` }, buildCues(g.state))
    expect(projectPublic(g.state, ctl.state).lastDeaths.map(d => d.name)).toEqual(['Cid'])
  })

  it('turns every card face up on the victory screen only', () => {
    const g = new Game(['loup_garou', 'villageois', 'villageois'], ['Ana', 'Bea', 'Cid'])
    expect(projectPublic(g.state, show('victory')).finalReveal).toBeUndefined()
    g.do({ type: 'TOGGLE_LOVER', playerId: g.id(1) }, { type: 'TOGGLE_LOVER', playerId: g.id(3) })
    g.do({ type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: g.id(2) }).dawn()
    expect(g.state.phase).toBe('game_over')
    expect(projectPublic(g.state, show('victory')).finalReveal?.map(c => [c.roleName, c.tags])).toEqual([
      ['Loup-Garou', ['amoureux']], ['Simple Villageois', []], ['Simple Villageois', ['amoureux']]])
  })
})

describe('village screen', () => {
  it('shows the table with the roles of the dead only, and nothing while disabled', () => {
    const g = new Game(['loup_garou', 'voyante', 'villageois', 'villageois'], ['Ana', 'Bea', 'Cid', 'Dan'])
    g.do({ type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: g.id(2) }).dawn()
    g.do({ type: 'ASSIGN_CAPTAIN', playerId: g.id(3) })
    const village = projectPublic(g.state, { ...show('village'), villageScreen: true }).village
    expect(village?.map(s => s.roleName)).toEqual([undefined, 'Voyante', undefined, undefined])
    expect(village?.find(s => s.captain)?.name).toBe('Cid')
    expect(projectPublic(g.state, show('village')).village).toBeUndefined()
  })

  it('refuses the village screen until the régie allows it', () => {
    const ctl = new ShowController(undefined, new FakeLight(), () => undefined)
    expect(ctl.command({ kind: 'screen', view: 'village' }, [])).toBeDefined()
    ctl.command({ kind: 'villageScreen', on: true }, [])
    expect(ctl.command({ kind: 'screen', view: 'village' }, [])).toBeUndefined()
    ctl.command({ kind: 'villageScreen', on: false }, [])
    expect(ctl.state.screen).toBe('blackout')
  })

  it('counts the composition without seats', () => {
    const g = new Game(['loup_garou', 'villageois', 'loup_garou', 'voyante'])
    expect(projectPublic(g.state, show('composition')).composition).toEqual([
      { roleName: 'Loup-Garou', count: 2 }, { roleName: 'Voyante', count: 1 }, { roleName: 'Simple Villageois', count: 1 }])
  })
})

describe('cues', () => {
  it('starts the debate clock when the debate goes up, once', () => {
    const g = new Game(['loup_garou', 'villageois', 'villageois', 'villageois'])
    expect(startsDebate('night', 'debate', g.state)).toBe(false)
    g.dawn()
    expect(startsDebate('reveal', 'debate', g.state)).toBe(true)
    expect(startsDebate('debate', 'debate', g.state)).toBe(false)
    g.do({ type: 'START_TIMER' }, { type: 'PAUSE_TIMER' })
    expect(startsDebate('vote', 'debate', g.state)).toBe(false)
  })

  it('announces a newly elected captain once', () => {
    const g = new Game(['loup_garou', 'villageois', 'villageois', 'villageois'])
    g.dawn().do({ type: 'ASSIGN_CAPTAIN', playerId: g.id(3) })
    expect(buildCues(g.state).find(c => c.kind === 'captain')?.effects).toMatchObject({ screen: 'captain', sfx: 'announcement' })
    g.do({ type: 'ADVANCE_TO_NIGHT' }).dawn()
    expect(buildCues(g.state).some(c => c.kind === 'captain')).toBe(false)
  })

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
    g.do({ type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: g.id(2) }).dawn().do({ type: 'ASSIGN_CAPTAIN', playerId: g.id(3) })
    const cues = buildCues(g.state)
    expect(nextCue(cues, show('day'))?.kind).toBe('daybreak')
    const jumped = { ...show('reveal'), firedCueIds: [`d1-reveal-${g.id(2)}`] }
    expect(nextCue(cues, jumped)?.kind).toBe('election')
  })

  it('growls at dawn only when a wolf sits next to the tamer, and says so when it does not', () => {
    const g = new Game(['loup_garou', 'montreur_ours', 'villageois', 'villageois', 'villageois'])
    g.do({ type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: g.id(4) }).dawn()
    expect(buildCues(g.state).find(c => c.kind === 'bear')?.effects.sfx).toBe('bear')
    const calm = new Game(['loup_garou', 'villageois', 'montreur_ours', 'villageois', 'villageois'])
    calm.do({ type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: calm.id(4) }).dawn()
    // A silent bear still gets its page, without a sound.
    expect(buildCues(calm.state).find(c => c.kind === 'bear')).toMatchObject({ title: 'L\'ours reste silencieux', effects: { light: { name: 'debate' } } })
    expect(buildCues(calm.state).find(c => c.kind === 'bear')?.effects.sfx).toBeUndefined()
  })

  it('caws on the player the corbeau marked', () => {
    const g = new Game(['loup_garou', 'corbeau', 'villageois', 'villageois', 'villageois'])
    g.do({ type: 'SET_NIGHT_TARGET', key: 'corbeauTargetId', playerId: g.id(4) }).dawn()
    expect(buildCues(g.state).find(c => c.kind === 'crow')?.effects).toEqual({ sfx: 'crow' })
  })

  it('plays the death effect for the whole room, never on a seat', () => {
    const calm = new Game(['loup_garou', 'villageois', 'villageois', 'villageois'])
    calm.dawn()
    expect(buildCues(calm.state).find(c => c.kind === 'reveal')?.effects.light).toEqual({ kind: 'scene', name: 'debate' })
    const g = new Game(['loup_garou', 'chasseur', 'villageois', 'villageois', 'villageois', 'villageois', 'loup_garou'])
    g.do({ type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: g.id(3) }).dawn()
    expect(buildCues(g.state).find(c => c.kind === 'reveal')?.effects.light).toEqual({ kind: 'scene', name: 'death' })
    g.do({ type: 'ELIMINATE_BY_VOTE', playerId: g.id(2) }, { type: 'EXECUTE_HUNTER_SHOT', targetPlayerId: g.id(4) })
    const deaths = buildCues(g.state).filter(c => c.kind === 'death')
    expect(deaths.map(c => c.effects.light)).toEqual([{ kind: 'scene', name: 'death' }, { kind: 'strobe' }])
  })

  it('lets the MJ step through the whole day, waiting on the vote and the elimination', () => {
    const g = new Game(['loup_garou', 'corbeau', 'villageois', 'villageois', 'villageois', 'villageois'])
    g.do({ type: 'SET_NIGHT_TARGET', key: 'corbeauTargetId', playerId: g.id(4) },
      { type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: g.id(3) }).dawn()
    const ctl = new ShowController(undefined, new FakeLight(), () => undefined)
    const played: string[] = []
    const stepThrough = () => {
      for (let cue = mjNextCue(buildCues(g.state), ctl.state); cue; cue = mjNextCue(buildCues(g.state), ctl.state)) {
        played.push(cue.kind)
        ctl.command({ kind: 'go' }, buildCues(g.state))
      }
    }
    stepThrough()
    // The debate waits for the captain.
    expect(played).toEqual(['daybreak', 'reveal', 'crow', 'election'])
    expect(blockingCue(buildCues(g.state), ctl.state)?.title).toBe('Annonce du Capitaine')
    g.do({ type: 'ASSIGN_CAPTAIN', playerId: g.id(5) })
    stepThrough()
    expect(played.slice(4)).toEqual(['captain', 'debate', 'vote'])
    g.do({ type: 'ELIMINATE_BY_VOTE', playerId: g.id(4) })
    stepThrough()
    expect(played.slice(7)).toEqual(['death'])
  })

  it('reveals the night victims one at a time, adding each name to the screen', () => {
    const g = new Game(['loup_garou', 'sorciere', 'villageois', 'villageois', 'villageois', 'villageois', 'villageois'], ['Ana', 'Bea', 'Cid', 'Dan', 'Eve', 'Fay', 'Gus'])
    g.do({ type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: g.id(3) },
      { type: 'SET_NIGHT_TARGET', key: 'witchKillTargetId', playerId: g.id(4) }).dawn()
    const reveals = buildCues(g.state).filter(c => c.kind === 'reveal')
    expect(reveals.map(c => c.playerId)).toEqual(g.state.dawnDeathIds)
    expect(reveals).toHaveLength(2)
    const ctl = new ShowController(undefined, new FakeLight(), () => undefined)
    const names = () => projectPublic(g.state, ctl.state).lastDeaths.map(d => d.name)
    ctl.command({ kind: 'go' }, buildCues(g.state))
    ctl.command({ kind: 'go' }, buildCues(g.state))
    expect(names()).toHaveLength(1)
    ctl.command({ kind: 'go' }, buildCues(g.state))
    expect(names().sort()).toEqual(['Cid', 'Dan'])
  })

  it('announces a captain elected in the morning before the debate, and a successor after the death', () => {
    const g = new Game(['loup_garou', 'villageois', 'villageois', 'villageois', 'villageois', 'villageois'])
    g.dawn().do({ type: 'ASSIGN_CAPTAIN', playerId: g.id(3) })
    let kinds = buildCues(g.state).map(c => c.kind)
    expect(kinds.indexOf('captain')).toBeLessThan(kinds.indexOf('debate'))
    g.do({ type: 'ELIMINATE_BY_VOTE', playerId: g.id(3) }, { type: 'ASSIGN_CAPTAIN_SUCCESSOR', newCaptainId: g.id(4) })
    kinds = buildCues(g.state).map(c => c.kind)
    expect(kinds.slice(-2)).toEqual(['death', 'captain'])
  })

  it('asks for a captain only while there is none', () => {
    const g = new Game(['loup_garou', 'villageois', 'villageois', 'villageois', 'villageois'])
    g.dawn()
    expect(buildCues(g.state).find(c => c.kind === 'captain')).toMatchObject({ blocking: true, ready: false })
    g.do({ type: 'ASSIGN_CAPTAIN', playerId: g.id(3) }, { type: 'ADVANCE_TO_NIGHT' }).dawn()
    expect(buildCues(g.state).some(c => c.kind === 'captain')).toBe(false)
  })

  it('puts the Juge Bègue\'s second vote between the two condemned', () => {
    const g = new Game(['loup_garou', 'juge_begue', 'villageois', 'villageois', 'villageois', 'villageois', 'villageois'])
    g.dawn().do({ type: 'ELIMINATE_BY_VOTE', playerId: g.id(3) }, { type: 'JUDGE_SECOND_VOTE' }, { type: 'ELIMINATE_BY_VOTE', playerId: g.id(4) })
    expect(buildCues(g.state).slice(-3).map(c => c.id)).toEqual([`d1-death-${g.id(3)}`, 'd1-vote2', `d1-death-${g.id(4)}`])
  })

  it('goes straight from the dawn reveal to the victory when the game ends at dawn', () => {
    const g = new Game(['loup_garou', 'villageois', 'villageois'])
    g.do({ type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: g.id(2) }).dawn()
    expect(buildCues(g.state).map(c => c.kind)).toEqual(['daybreak', 'reveal', 'victory'])
  })

  it('holds the first rite until the night has fallen on screen', () => {
    const g = new Game(['loup_garou', 'voyante', 'villageois', 'villageois'])
    const ctl = new ShowController(undefined, new FakeLight(), () => undefined)
    expect(ctl.autoFire(buildCues(g.state))).toBe(false)
    ctl.command({ kind: 'go' }, buildCues(g.state))
    expect(ctl.state.firedCueIds).toEqual(['n1-nightfall'])
    expect(ctl.autoFire(buildCues(g.state))).toBe(true)
  })

  it('plays a dawn Hunter\'s shot in the morning, before the debate', () => {
    const g = new Game(['loup_garou', 'chasseur', 'villageois', 'villageois', 'villageois', 'villageois', 'villageois', 'loup_garou'])
    g.do({ type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: g.id(2) }).dawn()
    g.do({ type: 'EXECUTE_HUNTER_SHOT', targetPlayerId: g.id(3) })
    const kinds = buildCues(g.state).map(c => c.kind)
    expect(kinds.indexOf('death')).toBeLessThan(kinds.indexOf('debate'))
  })

  it('ends on the pack for a wolf win', () => {
    const g = new Game(['loup_garou', 'villageois', 'villageois'])
    g.do({ type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: g.id(2) }).dawn()
    expect(g.state.winner).toBe('loups')
    expect(buildCues(g.state).find(c => c.kind === 'victory')?.effects.sfx).toBe('victory_wolves')
    expect(buildCues({ ...g.state, winner: 'amoureux' }).find(c => c.kind === 'victory')?.effects).toMatchObject({ sfx: 'solo', light: { name: 'solo' } })
    expect(buildCues({ ...g.state, winner: undefined }).find(c => c.kind === 'victory')?.effects.light).toEqual({ kind: 'scene', name: 'debate' })
  })
})

describe('MJ alone', () => {
  it('brings the night on stage at the start and when the MJ lets it fall, and lets the MJ play the day', () => {
    const store = new GameStore()
    let ctl: ShowController | undefined
    const hub = new Hub(store, new FakeLight(), 'k', () => (ctl = new ShowController(undefined, new FakeLight(), () => undefined)))
    const mj = { ws: { readyState: 3 }, role: 'mj', alive: true, audioReady: false }
    let n = 0
    // Distributes over the union, so each message keeps its own fields.
    type Msg = AckedMessage extends infer M ? (M extends AckedMessage ? Omit<M, 'id'> : never) : never
    const send = (msg: Msg) =>
      (hub as unknown as { handle: (c: unknown, m: unknown) => void }).handle(mj, { ...msg, id: `m${++n}` })
    send({ t: 'action', action: { type: 'SETUP_GAME', players: ['loup_garou', 'villageois', 'villageois', 'villageois', 'villageois']
      .map((roleId, i) => ({ roleId: roleId as 'villageois', seatNumber: i + 1, name: `J${i + 1}` })) } })
    expect(ctl?.state.screen).toBe('night')
    expect(ctl?.state.firedCueIds).toContain('n1-nightfall')
    send({ t: 'action', action: { type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: 'p2' } })
    send({ t: 'action', action: { type: 'ADVANCE_TO_DAY' } })
    // The day breaks by itself; the MJ validates the reveal, then moves to the debate and the vote.
    expect(ctl?.state.screen).toBe('day')
    send({ t: 'action', action: { type: 'ASSIGN_CAPTAIN', playerId: 'p4' } })
    for (let i = 0; i < 5; i++) send({ t: 'show', command: { kind: 'go' } })
    expect(ctl?.state.screen).toBe('vote')
    send({ t: 'action', action: { type: 'ACCUSE', playerId: 'p3' } })
    send({ t: 'action', action: { type: 'ELIMINATE_BY_VOTE', playerId: 'p3' } })
    // The condemned is revealed as soon as the MJ validates the vote.
    expect(ctl?.state.screen).toBe('reveal')
    expect(ctl?.state.revealIds).toBeUndefined()
    expect(currentCue(buildCues(store.state), ctl!.state)?.id).toBe('d1-death-p3')
    send({ t: 'action', action: { type: 'ADVANCE_TO_NIGHT' } })
    expect(ctl?.state.screen).toBe('night')
    expect(ctl?.state.firedCueIds).toContain('n2-nightfall')
  })
})

describe('rewind', () => {
  const setup = () => {
    const store = new GameStore()
    let ctl: ShowController | undefined
    const hub = new Hub(store, new FakeLight(), 'k', () => (ctl = new ShowController(undefined, new FakeLight(), () => undefined)))
    let n = 0
    const send = (role: 'mj' | 'regie', msg: object) =>
      (hub as unknown as { handle: (c: unknown, m: unknown) => void }).handle({ ws: { readyState: 3 }, role, alive: true, audioReady: false }, { ...msg, id: `m${++n}` })
    const act = (action: object) => send('mj', { t: 'action', action })
    act({ type: 'SETUP_GAME', players: ['loup_garou', 'villageois', 'villageois', 'villageois', 'villageois', 'villageois']
      .map((roleId, i) => ({ roleId, seatNumber: i + 1, name: `J${i + 1}` })) })
    act({ type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: 'p2' })
    act({ type: 'ADVANCE_TO_DAY' })
    act({ type: 'ASSIGN_CAPTAIN', playerId: 'p3' })
    return { store, show: () => ctl!, send, act }
  }

  it('lets the MJ pick the public screen, not the sound', () => {
    const { send, show } = setup()
    send('mj', { t: 'show', command: { kind: 'screen', view: 'composition' } })
    expect(show().state.screen).toBe('composition')
    send('mj', { t: 'show', command: { kind: 'villageScreen', on: true } })
    send('mj', { t: 'show', command: { kind: 'screen', view: 'village' } })
    expect(show().state.screen).toBe('village')
    send('mj', { t: 'show', command: { kind: 'ambience', id: 'night' } })
    expect(show().state.ambience).not.toBe('night')
  })

  it('takes back steps of the day with the undo arrow, in order with game actions, putting the screen back', () => {
    const { send, show, act, store } = setup()
    for (let i = 0; i < 4; i++) send('mj', { t: 'show', command: { kind: 'go' } })
    expect(show().state.screen).toBe('debate')
    act({ type: 'ACCUSE', playerId: 'p4' })
    // First the accusation, then the debate step, then the captain's announcement.
    send('mj', { t: 'undo' })
    expect(store.state.vote.accusedIds).toEqual([])
    expect(show().state.screen).toBe('debate')
    send('mj', { t: 'undo' })
    expect(show().state.screen).toBe('captain')
    // Back on the election page: the screen goes back to what it showed before the announcement.
    send('mj', { t: 'undo' })
    expect(show().state).toMatchObject({ screen: 'reveal', revealIds: ['p2'] })
    // Redo walks forward the same way.
    send('mj', { t: 'redo' })
    expect(show().state.screen).toBe('captain')
    send('mj', { t: 'redo' })
    send('mj', { t: 'redo' })
    expect(show().state.screen).toBe('debate')
    expect(store.state.vote.accusedIds).toEqual(['p4'])
  })

  it('plays an undone elimination again when it is redone, even after a manual screen change', () => {
    const { send, show, act, store } = setup()
    for (let i = 0; i < 5; i++) send('mj', { t: 'show', command: { kind: 'go' } })
    act({ type: 'ACCUSE', playerId: 'p4' })
    act({ type: 'ELIMINATE_BY_VOTE', playerId: 'p4' })
    expect(show().state.screen).toBe('reveal')
    send('mj', { t: 'undo' })
    // The condemned lives again: the stage goes back to the vote.
    expect(store.state.players.find(p => p.id === 'p4')?.isAlive).toBe(true)
    expect(show().state.screen).toBe('vote')
    send('regie', { t: 'show', command: { kind: 'screen', view: 'village' } })
    send('mj', { t: 'redo' })
    send('mj', { t: 'show', command: { kind: 'go' } })
    expect(show().state.screen).toBe('reveal')
    expect(show().state.firedCueIds.filter(id => id === 'd1-death-p4')).toHaveLength(1)
  })
})

describe('sound of an event', () => {
  const g = new Game(['loup_garou', 'cupidon', 'voyante', 'villageois'])
  const cues = buildCues(g.state)

  it('ends when the next cue is fired', () => {
    const played: (SfxId | null)[] = []
    const ctl = new ShowController(undefined, new FakeLight(), sfx => played.push(sfx))
    ctl.command({ kind: 'fire', cueId: 'n1-cupidon' }, cues)
    ctl.command({ kind: 'fire', cueId: 'n1-loups_garous' }, cues)
    expect(played).toEqual([null, 'cupid', null, 'wolves'])
  })

  it('ends when the MJ changes step, except from Cupidon to the lovers', () => {
    expect(stepChangeCutsSound(cues, 'cupidon', 'amoureux')).toBe(false)
    expect(stepChangeCutsSound(cues, 'amoureux', 'voyante')).toBe(true)
    expect(stepChangeCutsSound(cues, 'voyante', 'amoureux')).toBe(true)
    expect(stepChangeCutsSound(cues, 'sorciere', undefined)).toBe(true)
    expect(stepChangeCutsSound(cues, undefined, 'cupidon')).toBe(false)
  })
})

describe('show review', () => {
  const events = buildReviewEvents()

  it('plays every sound and scene of the edition', () => {
    const sfx = new Set(events.flatMap(e => e.effects.sfx ?? []))
    expect(Object.keys(SFX_LABELS).filter(id => !sfx.has(id as SfxId))).toEqual(['crow'])
    const scenes = new Set(events.flatMap(e => (e.effects.light?.kind === 'scene' ? e.effects.light.name : [])))
    expect(LIGHT_SCENES.filter(name => !scenes.has(name))).toEqual(['salvateur', 'full'])
  })

  it('lists each event once, with steps that have no effect yet', () => {
    expect(new Set(events.map(e => e.id)).size).toBe(events.length)
    expect(events.find(e => e.title === 'Les Amoureux')?.effects).toEqual({ keepSound: true })
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

  it('archives the previous game when a new one starts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lg-'))
    const file = join(dir, 'session.jsonl')
    const players = [
      { name: 'A', roleId: 'loup_garou' as const, seatNumber: 1 },
      { name: 'B', roleId: 'villageois' as const, seatNumber: 2 },
      { name: 'C', roleId: 'villageois' as const, seatNumber: 3 }
    ]
    let t = 5_000
    const store = new GameStore(file, () => (t += 1000))
    store.dispatch({ type: 'SETUP_GAME', players })
    store.dispatch({ type: 'ADVANCE_TO_DAY' })
    store.dispatch({ type: 'RESET_GAME' })
    store.dispatch({ type: 'SETUP_GAME', players })
    expect(readdirSync(join(dir, 'games'))).toHaveLength(1)
    expect(store.undo()).toBe(true)
    expect(store.state.phase).toBe('setup')
    expect(store.undo()).toBe(false)
    store.redo()
    const reloaded = new GameStore(file)
    expect(reloaded.state).toEqual(store.state)
  })
})

describe('show sound', () => {
  it('gives the screen its ambience and volumes only while it is the sound output', () => {
    const g = new Game(['loup_garou', 'villageois', 'villageois'], ['Ana', 'Bea', 'Cid'])
    const state: ShowState = { ...show('night'), ambience: 'night' }
    expect(projectPublic(g.state, state).audio).toEqual({ ambience: 'night', volumes: { master: 0.8, ambience: 0.5 } })
    expect(projectPublic(g.state, { ...state, audioOutput: 'regie' }).audio).toBeUndefined()
  })

  it('tests the lights with full on, then black', () => {
    vi.useFakeTimers()
    const sent: LightCommand[] = []
    const light = new FakeLight()
    light.send = async command => { sent.push(command) }
    new ShowController(undefined, light, () => undefined).command({ kind: 'testLights' }, [])
    expect(sent).toEqual([{ kind: 'full' }])
    vi.advanceTimersByTime(2000)
    expect(sent).toEqual([{ kind: 'full' }, { kind: 'blackout' }])
    vi.useRealTimers()
  })

  it('lets a light command cancel the end of a test', () => {
    vi.useFakeTimers()
    const sent: LightCommand[] = []
    const light = new FakeLight()
    light.send = async command => { sent.push(command) }
    const ctl = new ShowController(undefined, light, () => undefined)
    ctl.command({ kind: 'testLights' }, [])
    ctl.command({ kind: 'light', command: { kind: 'scene', name: 'night' } }, [])
    vi.advanceTimersByTime(2000)
    expect(sent).toEqual([{ kind: 'full' }, { kind: 'scene', name: 'night' }])
    vi.useRealTimers()
  })

  it('emits one-shot effects, cuts them, and clamps volumes', () => {
    const played: (SfxId | null)[] = []
    const ctl = new ShowController(undefined, new FakeLight(), sfx => played.push(sfx))
    ctl.command({ kind: 'sfx', id: 'wolves' }, [])
    ctl.command({ kind: 'stopSfx' }, [])
    ctl.command({ kind: 'volume', master: 3 }, [])
    ctl.command({ kind: 'audioOutput', target: 'regie' }, [])
    expect(played).toEqual(['wolves', null])
    expect(ctl.state.volumes).toEqual({ master: 1, ambience: 0.5 })
    expect(ctl.state.audioOutput).toBe('regie')
  })
})

describe('pairing token', () => {
  it('is required from every address, loopback included', () => {
    expect(isTrusted('abc123', 'abc123')).toBe(true)
    expect(isTrusted('abc124', 'abc123')).toBe(false)
    expect(isTrusted('abc', 'abc123')).toBe(false)
    expect(isTrusted(null, 'abc123')).toBe(false)
    expect(isTrusted(undefined, 'abc123')).toBe(false)
    expect(isTrusted('', '')).toBe(false)
  })
})
