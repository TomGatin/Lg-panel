import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import type { Server } from 'node:http'
import { networkInterfaces } from 'node:os'
import { join, resolve } from 'node:path'
import { serve, type HttpBindings } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import qrcode from 'qrcode-terminal'
import { ROLES } from '../shared/roles'
import { CompositionPreset, RoleId } from '../shared/types'
import { Hub, isTrusted } from './hub'
import { FakeLight, LightPort, StagehandLight } from './light'
import { LnbMembers } from './members'
import { ShowController } from './show'
import { GameStore } from './store'

const PORT = Number(process.env.PORT ?? 3000)
const PROD = process.env.NODE_ENV === 'production'
// In dev the phone loads the UI from Vite, which proxies /ws and /api to this server.
const UI_PORT = Number(process.env.UI_PORT ?? (PROD ? PORT : 5173))
const DATA_DIR = resolve(process.env.LG_DATA_DIR ?? 'data')

mkdirSync(DATA_DIR, { recursive: true })

function loadToken(): string {
  const file = join(DATA_DIR, 'token.txt')
  if (existsSync(file)) return readFileSync(file, 'utf8').trim()
  const token = randomBytes(6).toString('base64url')
  writeFileSync(file, token)
  return token
}

function lanAddress(): string {
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address
    }
  }
  return 'localhost'
}

const PRESETS_FILE = join(DATA_DIR, 'presets.json')

function readPresets(): CompositionPreset[] {
  return existsSync(PRESETS_FILE) ? (JSON.parse(readFileSync(PRESETS_FILE, 'utf8')) as CompositionPreset[]) : []
}

function writePresets(presets: CompositionPreset[]): void {
  writeFileSync(`${PRESETS_FILE}.tmp`, JSON.stringify(presets, null, 2))
  renameSync(`${PRESETS_FILE}.tmp`, PRESETS_FILE)
}

function isPreset(value: unknown): value is CompositionPreset {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.name === 'string' && v.name.trim().length > 0 &&
    Array.isArray(v.roles) && v.roles.every(r => typeof r === 'string' && r in ROLES)
}

const token = loadToken()
const members = new LnbMembers(join(DATA_DIR, 'lnb.json'))
const { STAGEHAND_URL, STAGEHAND_TOKEN, STAGEHAND_ROOM } = process.env
const lightsWired = STAGEHAND_URL && STAGEHAND_TOKEN && STAGEHAND_ROOM
const light: LightPort = lightsWired ? new StagehandLight(STAGEHAND_URL, STAGEHAND_TOKEN, STAGEHAND_ROOM) : new FakeLight()
const store = new GameStore(join(DATA_DIR, 'session.jsonl'))
const hub = new Hub(store, light, token,
  emit => new ShowController(join(DATA_DIR, 'show.json'), light, sfx => emit({ t: 'audio', sfx })))

const app = new Hono<{ Bindings: HttpBindings }>()
const trusted = (c: { env: HttpBindings; req: { query: (k: string) => string | undefined } }) =>
  isTrusted(c.env.incoming.socket.remoteAddress, c.req.query('k') ?? null, token)

app.get('/api/health', c => c.json({ ok: true }))

app.get('/api/presets', c => c.json(readPresets()))

app.post('/api/presets', async c => {
  if (!trusted(c)) return c.json({ error: 'Jeton invalide.' }, 403)
  const body: unknown = await c.req.json()
  if (!isPreset(body)) return c.json({ error: 'Composition invalide.' }, 400)
  const preset: CompositionPreset = { name: body.name.trim(), roles: body.roles as RoleId[] }
  writePresets([...readPresets().filter(p => p.name !== preset.name), preset])
  return c.json(preset)
})

app.delete('/api/presets/:name', c => {
  if (!trusted(c)) return c.json({ error: 'Jeton invalide.' }, 403)
  writePresets(readPresets().filter(p => p.name !== c.req.param('name')))
  return c.json({ ok: true })
})

// Sound and card files actually present, so the régie can flag missing ones before the show.
const PUBLIC_DIR = resolve(PROD ? 'dist' : 'public')
const listDir = (dir: string) => (existsSync(join(PUBLIC_DIR, dir)) ? readdirSync(join(PUBLIC_DIR, dir)) : [])
app.get('/api/assets', c => c.json({ audio: listDir('audio'), cards: listDir('cards') }))

app.get('/api/members', async c => {
  if (!trusted(c)) return c.json({ error: 'Jeton invalide.' }, 403)
  try {
    return c.json(await members.fetch())
  } catch (err) {
    return c.json({ error: (err as Error).message }, 502)
  }
})

if (PROD) {
  app.use('/*', serveStatic({ root: './dist' }))
  // The three views are client-side routes of the same page.
  app.get('*', serveStatic({ path: './dist/index.html' }))
}

const server = serve({ fetch: app.fetch, port: PORT, hostname: '0.0.0.0' }, () => {
  const base = `http://${lanAddress()}:${UI_PORT}`
  const mjUrl = `${base}/mj?k=${token}`
  console.log('\n  Thiercelieux — serveur prêt\n')
  console.log(`  MJ (téléphone) : ${mjUrl}`)
  console.log(`  Régie (ce PC)  : http://localhost:${UI_PORT}/regie`)
  console.log(`  Écran public   : http://localhost:${UI_PORT}/public`)
  console.log(`  Lumières       : ${lightsWired ? `${STAGEHAND_URL}, salle ${STAGEHAND_ROOM}` : 'simulées (définir STAGEHAND_URL, STAGEHAND_TOKEN et STAGEHAND_ROOM)'}\n`)
  qrcode.generate(mjUrl, { small: true })
}) as Server

hub.attach(server)
