import React, { useState } from 'react'
import { useGame } from '../context/GameContext'
import { RoleId } from '../types/game'
import { ROLES_BEST_OF, PRESETS } from '../data/roles'
import { Plus, Trash2, ArrowUp, ArrowDown, Play, Users, Shuffle, BookOpen } from 'lucide-react'

interface PlayerSetup {
  id: string
  name: string
  roleId: RoleId
}

export const SetupScreen: React.FC = () => {
  const { setupGame } = useGame()

  const [players, setPlayers] = useState<PlayerSetup[]>([
    { id: '1', name: 'Alice', roleId: 'voyante' },
    { id: '2', name: 'Bob', roleId: 'loup_garou' },
    { id: '3', name: 'Charlie', roleId: 'sorciere' },
    { id: '4', name: 'David', roleId: 'loup_garou' },
    { id: '5', name: 'Emma', roleId: 'chasseur' },
    { id: '6', name: 'Fabien', roleId: 'montreur_ours' },
    { id: '7', name: 'Gaëlle', roleId: 'villageois' },
    { id: '8', name: 'Hugo', roleId: 'villageois' },
  ])

  const [newName, setNewName] = useState('')
  const [selectedRoleForNew, setSelectedRoleForNew] = useState<RoleId>('villageois')
  const [batchNames, setBatchNames] = useState('')
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'circle'>('list')

  const addPlayer = () => {
    const name = newName.trim() || `Joueur ${players.length + 1}`
    setPlayers(prev => [
      ...prev,
      { id: Math.random().toString(), name, roleId: selectedRoleForNew }
    ])
    setNewName('')
  }

  const handleBatchAdd = () => {
    const names = batchNames
      .split(/[\n,;]+/)
      .map(n => n.trim())
      .filter(n => n.length > 0)

    if (names.length === 0) return

    const newEntries: PlayerSetup[] = names.map(n => ({
      id: Math.random().toString(),
      name: n,
      roleId: 'villageois'
    }))

    setPlayers(newEntries)
    setBatchNames('')
    setShowBatchModal(false)
  }

  const applyPreset = (presetIndex: number) => {
    const preset = PRESETS[presetIndex]
    const updated = preset.roles.map((rId, idx) => ({
      id: Math.random().toString(),
      name: players[idx]?.name || `Joueur ${idx + 1}`,
      roleId: rId
    }))
    setPlayers(updated)
  }

  const shuffleRoles = () => {
    const roles = [...players.map(p => p.roleId)]
    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[roles[i], roles[j]] = [roles[j], roles[i]]
    }
    setPlayers(prev => prev.map((p, idx) => ({ ...p, roleId: roles[idx] })))
  }

  const movePlayer = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1
    if (targetIdx < 0 || targetIdx >= players.length) return
    const updated = [...players]
    const temp = updated[index]
    updated[index] = updated[targetIdx]
    updated[targetIdx] = temp
    setPlayers(updated)
  }

  const removePlayer = (index: number) => {
    setPlayers(prev => prev.filter((_, i) => i !== index))
  }

  const updatePlayerRole = (index: number, roleId: RoleId) => {
    setPlayers(prev => prev.map((p, i) => i === index ? { ...p, roleId } : p))
  }

  const updatePlayerName = (index: number, name: string) => {
    setPlayers(prev => prev.map((p, i) => i === index ? { ...p, name } : p))
  }

  

  const wolvesCount = players.filter(p => ['loup_garou', 'grand_mechant_loup', 'infect_pere_des_loups', 'loup_blanc'].includes(p.roleId)).length
  const villagersCount = players.filter(p => ROLES_BEST_OF[p.roleId].team === 'village').length
  const neutralsCount = players.length - wolvesCount - villagersCount

  const handleStartGame = () => {
    if (players.length < 4) {
      alert('Veuillez ajouter au moins 4 joueurs pour débuter la partie.')
      return
    }
    setupGame(players.map((p, idx) => ({
      name: p.name,
      roleId: p.roleId,
      seatNumber: idx + 1
    })))
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Masthead */}
      <div className="text-center mb-8 border-b border-stone-800 pb-6">
        <div className="inline-block p-2 rounded-lg bg-stone-900 border border-stone-800 mb-3 shadow-sm">
          <BookOpen className="w-5 h-5 text-brass-400" />
        </div>
        <h1 className="font-serif text-2xl font-bold tracking-wider text-stone-100 uppercase">
          Préparation de la Partie
        </h1>
        <p className="text-stone-400 text-xs mt-1.5 max-w-lg mx-auto font-sans">
          Configurez l'ordre des sièges autour de la table pour activer les calculs d'adjacence du Montreur d'Ours, du Renard et de l'Épée Rouillée.
        </p>
      </div>

      {/* Presets Bar */}
      <div className="bg-stone-900 rounded-lg border border-stone-800 p-4 mb-6 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 border-b border-stone-800/80 pb-2">
          <span className="text-[11px] font-serif font-bold uppercase tracking-wider text-brass-400">
            Compositions Recommandées (Best Of)
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBatchModal(true)}
              className="text-xs font-sans px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-750 text-stone-300 border border-stone-700 transition-colors flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5 text-stone-400" />
              <span>Coller liste de pseudos</span>
            </button>
            <button
              onClick={shuffleRoles}
              className="text-xs font-sans px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-750 text-stone-300 border border-stone-700 transition-colors flex items-center gap-1.5"
              title="Mélanger aléatoirement les rôles"
            >
              <Shuffle className="w-3.5 h-3.5 text-brass-400" />
              <span>Mélanger les cartes</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PRESETS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => applyPreset(idx)}
              className="p-2.5 rounded border border-stone-800 bg-stone-950 hover:border-stone-700 hover:bg-stone-850 text-left transition-all group"
            >
              <div className="font-serif font-bold text-xs text-stone-200 group-hover:text-brass-300">{preset.name}</div>
              <div className="text-[11px] text-stone-400 mt-0.5 font-mono">{preset.playerCount} joueurs</div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Player Roster & Composition */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Players List (2 columns wide) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-stone-900 rounded-lg border border-stone-800 p-4 shadow-md">
            <div className="flex items-center justify-between mb-3 border-b border-stone-800 pb-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-serif font-bold uppercase tracking-wider text-stone-300">
                  Ordre autour de la Table ({players.length} joueurs)
                </h2>
                <span className="text-[10px] text-stone-500 font-mono uppercase">Sens horaire</span>
              </div>
              <div className="flex items-center gap-1 bg-stone-950 p-1 rounded border border-stone-800 text-xs">
                <button
                  onClick={() => setViewMode('circle')}
                  className={`px-2.5 py-1 rounded font-serif text-[11px] transition-all ${
                    viewMode === 'circle'
                      ? 'bg-stone-800 text-stone-100 border border-stone-700 shadow-sm'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  Table Ronde
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-2.5 py-1 rounded font-serif text-[11px] transition-all ${
                    viewMode === 'list'
                      ? 'bg-stone-800 text-stone-100 border border-stone-700 shadow-sm'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  Registre
                </button>
              </div>
            </div>

            {viewMode === 'list' ? (
              <>
                {/* Quick add form */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addPlayer()}
                placeholder="Nom du joueur..."
                className="flex-1 bg-stone-950 border border-stone-800 rounded px-3 py-1.5 text-xs text-stone-100 placeholder-stone-600 focus:outline-none focus:border-stone-600"
              />
              <select
                value={selectedRoleForNew}
                onChange={e => setSelectedRoleForNew(e.target.value as RoleId)}
                className="bg-stone-950 border border-stone-800 rounded px-2.5 py-1.5 text-xs text-stone-200 focus:outline-none"
              >
                {Object.values(ROLES_BEST_OF).map(role => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              <button
                onClick={addPlayer}
                className="px-3.5 py-1.5 bg-stone-800 hover:bg-stone-750 text-stone-200 font-semibold rounded text-xs border border-stone-700 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter</span>
              </button>
            </div>

            {/* List */}
            <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
              {players.map((player, idx) => {
                const role = ROLES_BEST_OF[player.roleId]
                return (
                  <div
                    key={player.id}
                    className="flex items-center gap-2.5 p-2 rounded bg-stone-950 border border-stone-800 hover:border-stone-750 transition-colors"
                  >
                    <span className="w-5 h-5 rounded bg-stone-900 border border-stone-750 flex items-center justify-center text-[10px] font-mono text-stone-400 shrink-0">
                      {idx + 1}
                    </span>

                    <input
                      type="text"
                      value={player.name}
                      onChange={e => updatePlayerName(idx, e.target.value)}
                      className="flex-1 min-w-0 bg-transparent text-xs text-stone-200 focus:bg-stone-900 px-2 py-1 rounded focus:outline-none"
                    />

                    <select
                      value={player.roleId}
                      onChange={e => updatePlayerRole(idx, e.target.value as RoleId)}
                      className={`text-[11px] font-medium py-1 px-2 rounded border bg-stone-900 cursor-pointer ${role.color}`}
                    >
                      {Object.values(ROLES_BEST_OF).map(r => (
                        <option key={r.id} value={r.id} className="bg-stone-900 text-stone-200">
                          {r.name}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => movePlayer(idx, 'up')}
                        disabled={idx === 0}
                        title="Monter"
                        className="p-1 text-stone-400 hover:text-stone-200 disabled:opacity-25"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => movePlayer(idx, 'down')}
                        disabled={idx === players.length - 1}
                        title="Descendre"
                        className="p-1 text-stone-400 hover:text-stone-200 disabled:opacity-25"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => removePlayer(idx)}
                        title="Supprimer"
                        className="p-1 text-stone-400 hover:text-rose-400 ml-1"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )
              })}
            
            </div>
              </>
            ) : (
              <div className="relative flex justify-center items-center py-4 select-none">
                <svg viewBox="0 0 500 500" className="w-full aspect-square max-w-[400px] drop-shadow-xl overflow-visible">
                  <circle cx="250" cy="250" r="160" fill="#121216" stroke="#292934" strokeWidth="4" />
                  {players.length > 0 && players.map((p, i) => {
                    const angle = (i * (360 / players.length) - 90) * (Math.PI / 180);
                    const r = 210;
                    const x = 250 + r * Math.cos(angle);
                    const y = 250 + r * Math.sin(angle);
                    return (
                      <g key={p.id}>
                        <circle cx={x} cy={y} r="25" fill="#18181f" stroke="#292934" strokeWidth="2" />
                        <text x={x} y={y + 6} textAnchor="middle" fontSize="22" fill="white">
                          {ROLES_BEST_OF[p.roleId]?.emoji || '👤'}
                        </text>
                        <text x={x} y={y + 40} textAnchor="middle" fill="#ded5c3" fontSize="14" fontWeight="bold">
                          #{i + 1} {p.name}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Balance & Launch (1 column) */}
        <div className="space-y-4">
          <div className="bg-stone-900 rounded-lg border border-stone-800 p-4 shadow-md">
            <h2 className="text-xs font-serif font-bold uppercase tracking-wider text-brass-400 mb-3 border-b border-stone-800 pb-2">
              Bilan des Forces
            </h2>

            <div className="space-y-2 mb-4 text-xs">
              <div className="flex items-center justify-between p-2 rounded bg-stone-950 border border-stone-800">
                <span className="text-stone-400">Total Joueurs :</span>
                <strong className="text-stone-100 font-mono">{players.length}</strong>
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-stone-950 border border-crimson-900/40 text-rose-300">
                <span>Meute des Loups :</span>
                <strong className="font-mono">{wolvesCount}</strong>
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-stone-950 border border-stone-800 text-stone-300">
                <span>Camp du Village :</span>
                <strong className="font-mono">{villagersCount}</strong>
              </div>

              {neutralsCount > 0 && (
                <div className="flex items-center justify-between p-2 rounded bg-stone-950 border border-violet-900/40 text-violet-300">
                  <span>Solitaires / Rôles Tiers :</span>
                  <strong className="font-mono">{neutralsCount}</strong>
                </div>
              )}
            </div>

            {/* Role List Pills */}
            <div className="mb-5">
              <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider block mb-1.5">
                Rôles sélectionnés :
              </span>
              <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto pr-1">
                {players.map((p, i) => {
                  const role = ROLES_BEST_OF[p.roleId]
                  return (
                    <span
                      key={i}
                      className={`text-[10px] px-1.5 py-0.5 rounded border ${role.color}`}
                    >
                      {role.name}
                    </span>
                  )
                })}
              </div>
            </div>

            
            {/* Launch button */}
            <button
              onClick={handleStartGame}
              className="w-full py-2.5 px-4 rounded-md font-serif font-bold text-xs uppercase tracking-wider bg-brass-500 hover:bg-brass-400 text-white flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Ouvrir la Partie</span>
            </button>
          </div>
        </div>
      </div>

      {/* Batch Names Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-750 rounded-lg max-w-md w-full p-5 shadow-2xl">
            <h3 className="font-serif text-sm font-bold text-stone-100 uppercase tracking-wider mb-1">
              Importer des pseudos
            </h3>
            <p className="text-xs text-stone-400 mb-3">
              Collez vos prénoms ou pseudos (un par ligne ou séparés par des virgules).
            </p>

            <textarea
              rows={6}
              value={batchNames}
              onChange={e => setBatchNames(e.target.value)}
              placeholder="Alice&#10;Bob&#10;Charlie&#10;David&#10;Emma..."
              className="w-full bg-stone-950 border border-stone-800 rounded p-2.5 text-xs text-stone-100 focus:outline-none focus:border-stone-600 mb-3"
            />

            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setShowBatchModal(false)}
                className="px-3 py-1.5 rounded text-stone-400 hover:text-stone-200"
              >
                Annuler
              </button>
              <button
                onClick={handleBatchAdd}
                className="px-3.5 py-1.5 rounded font-semibold bg-stone-800 hover:bg-stone-750 text-stone-200 border border-stone-700"
              >
                Importer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
