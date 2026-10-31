import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LIGHT_SCENES } from '../shared/cues'
import { LightCommand, LightStatus } from '../shared/types'
import { LightPort, StagehandLight } from '../server/light'
import { ShowController } from '../server/show'

const BASE = 'http://stagehand'
const STROBE = { id: 'strobe', generator: 'lightning', params: { auto: false } }

/** A stagehand answering each path; anything else is a 404. */
function stagehand(overrides: Record<string, () => Response | Promise<Response>> = {}) {
  const calls: { url: string; method: string; auth: string | null }[] = []
  const routes: Record<string, () => Response | Promise<Response>> = {
    '/api/rooms/salle': () => Response.json({ id: 'salle', active: true }),
    '/api/rooms/salle/scenes': () => Response.json(LIGHT_SCENES.map(id => ({ id }))),
    '/api/rooms/salle/effects': () => Response.json([STROBE]),
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
      [{ kind: 'strobe' }, '/api/rooms/salle/effects/strobe/fire'],
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
      '/api/rooms/salle/effects/strobe/fire': () => new Response(null, { status: 409 }),
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
    expect(light.missing).toEqual(['death', 'effet strobe (lightning, sans répétition)'])
  })

  it('tells listeners when the missing list changes', async () => {
    let scenes = LIGHT_SCENES.map(id => ({ id }))
    stagehand({ '/api/rooms/salle/scenes': () => Response.json(scenes) })
    const light = await connected()
    const seen: string[][] = []
    light.onStatusChange(() => seen.push(light.missing))
    scenes = scenes.filter(s => s.id !== 'day')
    await vi.advanceTimersByTimeAsync(5000)
    await vi.advanceTimersByTimeAsync(5000)
    expect(seen).toEqual([['day']])
  })
})

describe('bringing the look back', () => {
  class ManualLight implements LightPort {
    status: LightStatus = 'ok'
    missing: string[] = []
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
