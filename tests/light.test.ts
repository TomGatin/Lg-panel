import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildCues, LIGHT_SCENES } from '../shared/cues'
import { getNightSteps } from '../shared/rules'
import { arcPoint, PanTilt, skyPosition } from '../shared/sky'
import { GameState, LightCommand, LightStatus, ShowState } from '../shared/types'
import { LightPort, StagehandLight } from '../server/light'
import { ShowController } from '../server/show'
import { Game } from './helpers'

const BASE = 'http://stagehand'
const STROBE = { id: 'lightning', generator: 'lightning', params: { auto: false } }

const at = (fixtureId: string, pan: number, tilt: number) => ({ fixtureId, pan, tilt })
const TARGETS = [
  { id: 'moon', positions: [at('m1', 0, 0)] },
  { id: 'sun', positions: [at('m2', 0, 0)] },
  { id: 'moon-start', positions: [at('m1', 1000, 500), at('m2', 3000, 500)] },
  { id: 'moon-zenith', positions: [at('m1', 2000, 900), at('m2', 4000, 900)] },
  { id: 'moon-end', positions: [at('m1', 3000, 500), at('m2', 5000, 500)] },
  { id: 'sun-start', positions: [at('m2', 100, 100)] },
  { id: 'sun-zenith', positions: [at('m2', 200, 200)] },
  { id: 'sun-end', positions: [at('m2', 300, 100)] }
]

/** A stagehand answering each path; anything else is a 404. */
function stagehand(overrides: Record<string, () => Response | Promise<Response>> = {}) {
  const calls: { url: string; method: string; auth: string | null }[] = []
  const routes: Record<string, () => Response | Promise<Response>> = {
    '/api/rooms/salle': () => Response.json({ id: 'salle', active: true }),
    '/api/rooms/salle/scenes': () => Response.json(LIGHT_SCENES.map(id => ({ id }))),
    '/api/rooms/salle/effects': () => Response.json([STROBE]),
    '/api/rooms/salle/targets': () => Response.json(TARGETS),
    ...overrides
  }
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    const path = url.slice(BASE.length)
    calls.push({ url: path, method: init.method ?? 'GET', auth: new Headers(init.headers).get('authorization') })
    return routes[path]?.() ?? new Response(null, { status: 404 })
  })
  return calls
}

async function connected(): Promise<StagehandLight> {
  const light = new StagehandLight(`${BASE}/`, 'secret', 'salle')
  await vi.advanceTimersByTimeAsync(0)
  return light
}

describe('StagehandLight', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('maps each command to its route, with the token', async () => {
    const commands: [LightCommand, string][] = [
      [{ kind: 'scene', name: 'loup-blanc' }, '/api/rooms/salle/scenes/loup-blanc/go'],
      [{ kind: 'full' }, '/api/rooms/salle/scenes/full/go'],
      [{ kind: 'strobe' }, '/api/rooms/salle/effects/lightning/fire'],
      [{ kind: 'blackout' }, '/api/dmx/blackout']
    ]
    const calls = stagehand(Object.fromEntries(commands.map(([, path]) => [path, () => new Response(null, { status: 204 })])))
    const light = await connected()
    for (const [command, path] of commands) {
      await light.send(command)
      expect(calls.at(-1)).toEqual({ url: path, method: 'POST', auth: 'Bearer secret' })
    }
    expect(light.status).toBe('ok')
  })

  it('only uses slugs as scene ids', () => {
    for (const name of LIGHT_SCENES) expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('is down on a bad token, an inactive room, or no answer', async () => {
    stagehand({ '/api/rooms/salle': () => new Response(null, { status: 401 }) })
    expect((await connected()).status).toBe('down')
    stagehand({ '/api/rooms/salle': () => Response.json({ active: false }) })
    expect((await connected()).status).toBe('down')
    stagehand({ '/api/rooms/salle': () => Promise.reject(new Error('timeout')) })
    expect((await connected()).status).toBe('down')
  })

  it('goes down on a 401 or 409, but not on a scene that does not exist', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    stagehand({
      '/api/rooms/salle/effects/lightning/fire': () => new Response(null, { status: 409 }),
      '/api/dmx/blackout': () => new Response(null, { status: 401 })
    })
    const light = await connected()
    await light.send({ kind: 'scene', name: 'nope' })
    expect(light.status).toBe('ok')
    await light.send({ kind: 'strobe' })
    expect(light.status).toBe('down')
    await vi.advanceTimersByTimeAsync(5000)
    expect(light.status).toBe('ok')
    await light.send({ kind: 'blackout' })
    expect(light.status).toBe('down')
  })

  it('lists missing scenes and a strobe that would toggle', async () => {
    stagehand({
      '/api/rooms/salle/scenes': () => Response.json(LIGHT_SCENES.filter(id => id !== 'death').map(id => ({ id }))),
      '/api/rooms/salle/effects': () => Response.json([{ ...STROBE, generator: 'static' }])
    })
    const light = await connected()
    expect(light.status).toBe('ok')
    expect(light.missing).toEqual(['death', 'effet lightning (sans répétition)'])
  })

  it('tells listeners when the missing list changes', async () => {
    let scenes = LIGHT_SCENES.map(id => ({ id }))
    stagehand({ '/api/rooms/salle/scenes': () => Response.json(scenes) })
    const light = await connected()
    const seen: string[][] = []
    light.onStatusChange(() => seen.push(light.missing))
    scenes = scenes.filter(s => s.id !== 'dawn')
    await vi.advanceTimersByTimeAsync(5000)
    await vi.advanceTimersByTimeAsync(5000)
    expect(seen).toEqual([['dawn']])
  })
})

describe('the sky', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const puts = (calls: ReturnType<typeof stagehand>) => calls.filter(c => c.method === 'PUT').map(c => c.url)
  const moonPut = (fixture: string) => `/api/rooms/salle/targets/moon/positions/${fixture}`

  function recordingBodies() {
    const bodies: { url: string; pan: number; tilt: number }[] = []
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      const path = url.slice(BASE.length)
      if (init.method === 'PUT') bodies.push({ url: path, ...(JSON.parse(init.body as string) as PanTilt) })
      if (path.endsWith('/targets')) return Response.json(TARGETS)
      if (path.endsWith('/scenes')) return Response.json(LIGHT_SCENES.map(id => ({ id })))
      if (path.endsWith('/effects')) return Response.json([STROBE])
      if (path === '/api/rooms/salle') return Response.json({ active: true })
      return new Response(null, { status: 200 })
    })
    return bodies
  }

  it('places a body at once the first time, on both moon heads', async () => {
    const bodies = recordingBodies()
    const light = await connected()
    light.sky({ body: 'moon', progress: 0.5 })
    await vi.advanceTimersByTimeAsync(0)
    expect(bodies).toEqual([
      { url: moonPut('m1'), pan: 2000, tilt: 900 },
      { url: moonPut('m2'), pan: 4000, tilt: 900 }
    ])
  })

  it('glides the sun along the arc over 2 s and ends exactly on the step', async () => {
    const bodies = recordingBodies()
    const light = await connected()
    light.sky({ body: 'sun', progress: 0 })
    await vi.advanceTimersByTimeAsync(0)
    bodies.length = 0
    light.sky({ body: 'sun', progress: 1 })
    await vi.advanceTimersByTimeAsync(1000)
    expect(bodies.length).toBeLessThan(20)
    await vi.advanceTimersByTimeAsync(1000)
    expect(bodies).toHaveLength(20)
    expect(bodies.at(-1)).toMatchObject({ pan: 300, tilt: 100 })
    // Halfway along it passes over the zenith, not in a straight line.
    expect(Math.max(...bodies.map(b => b.tilt))).toBeGreaterThan(190)
  })

  it('sends the moon in one slowed order, then gives the heads their speed back', async () => {
    const calls = stagehand({ '/api/rooms/salle/playback/head-speed': () => new Response(null, { status: 204 }) })
    const light = await connected()
    light.sky({ body: 'moon', progress: 0 })
    await vi.advanceTimersByTimeAsync(0)
    calls.length = 0
    light.sky({ body: 'moon', progress: 1 })
    await vi.advanceTimersByTimeAsync(0)
    expect(puts(calls)).toEqual(['/api/rooms/salle/playback/head-speed', moonPut('m1'), moonPut('m2')])
    await vi.advanceTimersByTimeAsync(5000)
    expect(puts(calls).at(-1)).toBe('/api/rooms/salle/playback/head-speed')
    expect(puts(calls)).toHaveLength(4)
  })

  it('does not send the same position twice, and only moves the sun head by day', async () => {
    const calls = stagehand()
    const light = await connected()
    light.sky({ body: 'sun', progress: 0 })
    await vi.advanceTimersByTimeAsync(0)
    light.sky({ body: 'sun', progress: 0 })
    await vi.advanceTimersByTimeAsync(0)
    expect(puts(calls)).toEqual(['/api/rooms/salle/targets/sun/positions/m2'])
  })

  it('puts the body back after an outage', async () => {
    const bodies = recordingBodies()
    const light = await connected()
    light.sky({ body: 'moon', progress: 0 })
    await vi.advanceTimersByTimeAsync(0)
    vi.stubGlobal('fetch', async () => { throw new Error('down') })
    await vi.advanceTimersByTimeAsync(5000)
    expect(light.status).toBe('down')
    bodies.length = 0
    const after = recordingBodies()
    await vi.advanceTimersByTimeAsync(5000)
    expect(light.status).toBe('ok')
    expect(after).toHaveLength(2)
  })

  it('flags an uncalibrated arc', async () => {
    stagehand({ '/api/rooms/salle/targets': () => Response.json(TARGETS.filter(t => t.id !== 'sun-zenith')) })
    expect((await connected()).missing).toEqual(['cible sun-zenith'])
  })
})

describe('skyPosition', () => {
  const show = (firedCueIds: string[] = []): ShowState =>
    ({ firedCueIds, skippedCueIds: [], screen: 'night', ambience: 'none', autoKinds: [], audioOutput: 'public', volumes: { master: 1, ambience: 1 }, villageScreen: false })

  it('advances the moon with each validated night step', () => {
    const g = new Game(['loup_garou', 'voyante', 'sorciere', 'villageois'])
    const steps = getNightSteps(g.state)
    expect(skyPosition(g.state, buildCues(g.state), show())).toEqual({ body: 'moon', progress: 0 })
    const state = structuredClone(g.state)
    state.night.completedSteps[steps[0].id] = true
    expect(skyPosition(state, buildCues(state), show())).toEqual({ body: 'moon', progress: 1 / steps.length })
    for (const s of steps) state.night.completedSteps[s.id] = true
    expect(skyPosition(state, buildCues(state), show())?.progress).toBe(1)
  })

  it('moves the sun with the cues of the day', () => {
    const g = new Game(['loup_garou', 'voyante', 'villageois', 'villageois'])
    g.dawn()
    const n = g.state.roundNumber
    const cues = buildCues(g.state)
    expect(skyPosition(g.state, cues, show([`d${n}-daybreak`]))).toEqual({ body: 'sun', progress: 0 })
    expect(skyPosition(g.state, cues, show([`d${n}-daybreak`, `d${n}-debate`]))?.progress).toBeCloseTo(2 / 3)
    expect(skyPosition(g.state, cues, show([`d${n}-vote`]))?.progress).toBe(1)
  })

  it('stays put outside the game', () => {
    expect(skyPosition({ phase: 'setup' } as GameState, [], show())).toBeNull()
  })
})

describe('arcPoint', () => {
  const a = { pan: 0, tilt: 0 }, b = { pan: 100, tilt: 50 }, c = { pan: 200, tilt: 0 }
  it('goes through the three calibrated points', () => {
    expect(arcPoint(a, b, c, 0)).toEqual(a)
    expect(arcPoint(a, b, c, 0.5)).toEqual(b)
    expect(arcPoint(a, b, c, 1)).toEqual(c)
  })
  it('stays within DMX values when the curve overshoots', () => {
    expect(arcPoint({ pan: 65535, tilt: 0 }, { pan: 65535, tilt: 0 }, { pan: 0, tilt: 0 }, 0.25).pan).toBe(65535)
  })
})

describe('bringing the look back', () => {
  class ManualLight implements LightPort {
    status: LightStatus = 'ok'
    missing: string[] = []
    sky(): void {}
    sent: LightCommand[] = []
    private listener: (status: LightStatus) => void = () => undefined
    onStatusChange(listener: (status: LightStatus) => void): void { this.listener = listener }
    async send(command: LightCommand): Promise<void> { this.sent.push(command) }
    set(status: LightStatus): void {
      this.status = status
      this.listener(status)
    }
  }

  it('sends the last look again after an outage, never a strobe', () => {
    const light = new ManualLight()
    const ctl = new ShowController(undefined, light, () => undefined)
    ctl.command({ kind: 'light', command: { kind: 'scene', name: 'night' } }, [])
    ctl.command({ kind: 'light', command: { kind: 'strobe' } }, [])
    light.sent = []
    light.set('ok')
    expect(light.sent).toEqual([])
    light.set('down')
    light.set('ok')
    expect(light.sent).toEqual([{ kind: 'scene', name: 'night' }])
  })

  it('sends nothing when no look was set', () => {
    const light = new ManualLight()
    new ShowController(undefined, light, () => undefined)
    light.set('down')
    light.set('ok')
    expect(light.sent).toEqual([])
  })
})
