import { existsSync, readFileSync } from 'node:fs'
import { tableNames } from '../shared/members'

const LNB_URL = 'https://lnb.bde-teknantes.fr'
const DEFAULT_EVENT = 'Soirée Loup-Garou et Among Us'

interface LnbConfig {
  apiKey?: string
  event?: string
}

export interface Members {
  event: string
  names: string[]
}

/** Registrants of the evening on the BDE site, shortened for the table. The key stays on the server. */
export class LnbMembers {
  constructor(private readonly configFile: string) {}

  private config(): LnbConfig {
    const file: LnbConfig = existsSync(this.configFile) ? (JSON.parse(readFileSync(this.configFile, 'utf8')) as LnbConfig) : {}
    return { apiKey: process.env.LNB_API_KEY ?? file.apiKey, event: process.env.LNB_EVENT ?? file.event ?? DEFAULT_EVENT }
  }

  async fetch(): Promise<Members> {
    const { apiKey, event } = this.config()
    if (!apiKey) throw new Error('Clé LNB absente (data/lnb.json ou LNB_API_KEY).')
    const get = async <T>(path: string): Promise<T> => {
      const res = await fetch(`${LNB_URL}${path}`, { headers: { authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(8000) })
      if (!res.ok) throw new Error(`LNB ${path} : HTTP ${res.status}`)
      return (await res.json()) as T
    }

    const events = await get<{ items: { id: string; name: string; cancelled: boolean }[] }>('/api/events')
    const match = events.items.find(e => e.name === event && !e.cancelled)
    if (!match) throw new Error(`Événement « ${event} » introuvable.`)
    const regs = await get<{ items: { name: string; status: string }[] }>(`/api/admin/events/${match.id}/registrations`)
    return { event: match.name, names: tableNames(regs.items.filter(r => r.status === 'registered').map(r => r.name)) }
  }
}
