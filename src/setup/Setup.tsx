import { ArrowDown, ArrowUp, Plus, Save, Trash2, Users, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { PRESETS, ROLES } from '../../shared/roles'
import { CompositionPreset, RoleId, SetupPlayer } from '../../shared/types'
import { useLive } from '../lib/live'

interface Row {
  name: string
  roleId: RoleId
}

const DRAFT_KEY = 'lg-setup-draft'
const ROLE_IDS = Object.keys(ROLES) as RoleId[]
const WOLF_TEAM = new Set<RoleId>(['loup_garou', 'grand_mechant_loup', 'infect_pere_des_loups'])

function loadDraft(): Row[] {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (raw) return JSON.parse(raw) as Row[]
  } catch {
    // Private mode or corrupted draft: start from the default preset.
  }
  return PRESETS[0].roles.map(roleId => ({ name: '', roleId }))
}

function authQuery(): string {
  try {
    const k = localStorage.getItem('lg-token')
    return k ? `?k=${encodeURIComponent(k)}` : ''
  } catch {
    return ''
  }
}

/** Composition of the table before the game: who sits where with which card. */
export function Setup() {
  const dispatch = useLive(s => s.dispatch)
  const [rows, setRows] = useState<Row[]>(loadDraft)
  const [saved, setSaved] = useState<CompositionPreset[]>([])
  const [presetName, setPresetName] = useState('')

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(rows))
    } catch {
      // Draft persistence is a convenience only.
    }
  }, [rows])

  // Registrants of the evening, fetched in the background and applied only on tap.
  const [members, setMembers] = useState<string[] | null>(null)
  const [membersError, setMembersError] = useState('')
  useEffect(() => {
    fetch(`/api/members${authQuery()}`)
      .then(async r => {
        const body = (await r.json()) as { names?: string[]; error?: string }
        if (!r.ok || !body.names) throw new Error(body.error ?? `HTTP ${r.status}`)
        setMembers(body.names)
      })
      .catch((err: Error) => setMembersError(err.message))
  }, [])

  const refreshPresets = () => {
    fetch('/api/presets').then(r => r.json() as Promise<CompositionPreset[]>).then(setSaved).catch(() => setSaved([]))
  }
  useEffect(refreshPresets, [])

  const counts = useMemo(() => {
    const c = new Map<RoleId, number>()
    rows.forEach(r => c.set(r.roleId, (c.get(r.roleId) ?? 0) + 1))
    return c
  }, [rows])
  const wolves = rows.filter(r => WOLF_TEAM.has(r.roleId)).length
  const warnings: string[] = []
  if (wolves === 0) warnings.push('Aucun loup dans la composition.')
  if (wolves >= rows.length / 2) warnings.push('Les loups sont déjà majoritaires.')
  for (const [roleId, n] of counts) {
    if (n > ROLES[roleId].maxAvailable) warnings.push(`${ROLES[roleId].name} : ${n} exemplaires (${ROLES[roleId].maxAvailable} dans la boîte).`)
  }

  const update = (i: number, patch: Partial<Row>) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const move = (i: number, d: -1 | 1) => setRows(rs => {
    const j = i + d
    if (j < 0 || j >= rs.length) return rs
    const next = [...rs]
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
  })
  const applyPreset = (p: CompositionPreset) =>
    setRows(rs => p.roles.map((roleId, i) => ({ name: rs[i]?.name ?? '', roleId })))

  // One seat per registrant: roles stay on their seat, new seats are villageois.
  const applyMembers = (names: string[]) =>
    setRows(rs => names.map((name, i) => ({ name, roleId: rs[i]?.roleId ?? 'villageois' })))

  const savePreset = () => {
    const name = presetName.trim()
    if (!name) return
    fetch(`/api/presets${authQuery()}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, roles: rows.map(r => r.roleId) })
    }).then(() => { setPresetName(''); refreshPresets() }).catch(() => undefined)
  }
  const deletePreset = (name: string) =>
    fetch(`/api/presets/${encodeURIComponent(name)}${authQuery()}`, { method: 'DELETE' }).then(refreshPresets).catch(() => undefined)

  const start = () => {
    const players: SetupPlayer[] = rows.map((r, i) => ({ name: r.name, roleId: r.roleId, seatNumber: i + 1 }))
    dispatch({ type: 'SETUP_GAME', players })
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 font-sans">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold tracking-wide">Composition du village</h1>
        <p className="text-[15px] text-muted">Dans l'ordre de la table, en tournant dans le sens des aiguilles d'une montre. Le siège 1 est le premier de la liste.</p>
      </header>

      <section className="flex flex-col gap-2">
        <span className="regie-label">Presets</span>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => (
            <button key={p.name} type="button" onClick={() => applyPreset(p)}
              className="min-h-[44px] rounded-md bg-tile px-3 text-[14px] font-semibold">{p.name}</button>
          ))}
          <button type="button" onClick={() => members && applyMembers(members)} disabled={!members}
            title={membersError || undefined}
            className="flex min-h-[44px] items-center gap-2 rounded-md bg-tile px-3 text-[14px] font-semibold disabled:opacity-50">
            <Users size={16} />Inscrits <span className="text-muted">· {members ? members.length : membersError ? '!' : '…'}</span>
          </button>
          {saved.map(p => (
            <span key={p.name} className="flex items-stretch overflow-hidden rounded-md bg-tile">
              <button type="button" onClick={() => applyPreset(p)} className="min-h-[44px] px-3 text-[14px] font-semibold">
                {p.name} <span className="text-muted">· {p.roles.length}</span>
              </button>
              <button type="button" aria-label={`Supprimer le preset ${p.name}`} onClick={() => void deletePreset(p.name)}
                className="px-2 text-muted hover:text-blood-text"><X size={16} /></button>
            </span>
          ))}
        </div>
        {membersError && <p className="text-[13px] text-muted">Inscrits indisponibles : {membersError}</p>}
        <div className="flex gap-2">
          <input value={presetName} onChange={e => setPresetName(e.target.value)} placeholder="Nom du preset à enregistrer"
            aria-label="Nom du preset" className="min-h-[44px] flex-1 rounded-md border border-rule bg-ink px-3 text-[15px]" />
          <button type="button" onClick={savePreset} disabled={!presetName.trim()}
            className="flex min-h-[44px] items-center gap-2 rounded-md bg-tile px-3 text-[14px] font-semibold"><Save size={16} />Enregistrer</button>
        </div>
      </section>

      <section className="flex flex-col gap-1.5">
        <span className="regie-label">Joueurs · {rows.length}</span>
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-1.5 rounded-md bg-panel p-1.5">
            <span className="w-7 text-center font-display text-sm font-bold text-muted">{i + 1}</span>
            <input value={r.name} onChange={e => update(i, { name: e.target.value })} placeholder={`Joueur ${i + 1}`}
              aria-label={`Nom du joueur au siège ${i + 1}`} className="min-h-[44px] min-w-0 flex-1 rounded border border-rule bg-ink px-2 text-[16px]" />
            <select value={r.roleId} onChange={e => update(i, { roleId: e.target.value as RoleId })}
              aria-label={`Rôle du siège ${i + 1}`} className="min-h-[44px] w-[38%] min-w-0 rounded border border-rule bg-ink px-1 text-[15px]">
              {ROLE_IDS.map(id => <option key={id} value={id}>{ROLES[id].name}</option>)}
            </select>
            <div className="flex flex-col">
              <button type="button" aria-label="Monter" onClick={() => move(i, -1)} className="px-1 text-muted"><ArrowUp size={16} /></button>
              <button type="button" aria-label="Descendre" onClick={() => move(i, 1)} className="px-1 text-muted"><ArrowDown size={16} /></button>
            </div>
            <button type="button" aria-label={`Retirer le siège ${i + 1}`} onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}
              className="flex h-11 w-11 items-center justify-center text-muted hover:text-blood-text"><Trash2 size={18} /></button>
          </div>
        ))}
        <button type="button" onClick={() => setRows(rs => [...rs, { name: '', roleId: 'villageois' }])}
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-md bg-tile text-[15px] font-semibold"><Plus size={18} />Ajouter un joueur</button>
      </section>

      {warnings.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-md bg-blood-deep p-3 text-[14px] text-bone">
          {warnings.map(w => <li key={w}>{w}</li>)}
        </ul>
      )}

      <button type="button" onClick={start} disabled={rows.length < 3}
        className="min-h-[56px] rounded-md bg-blood-go font-display text-lg font-bold tracking-wider text-[#FFF6EE]">
        Ouvrir la partie · Nuit 1
      </button>
    </div>
  )
}
