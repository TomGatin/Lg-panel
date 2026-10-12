import React, { useState } from 'react'
import { useGame } from '../context/GameContext'
import { ROLES_BEST_OF } from '../data/roles'
import { getBearGrowlStatus, getRustySwordTarget, isPlayerWerewolf } from '../utils/gameHelpers'
import { Volume2 } from 'lucide-react'

export const VillageCircle: React.FC = () => {
  const {
    state,
    togglePlayerLife,
    togglePlayerLover,
    togglePlayerCharmed,
    setPlayerInfected,
    setPlayerCaptain,
    setWildChildModel,
    setDogWolfChoice,
    setFoxLostPower
  } = useGame()

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'circle' | 'list'>('circle')

  const bearStatus = getBearGrowlStatus(state.players)
  const rustyStatus = getRustySwordTarget(state.players)

  const selectedPlayer = state.players.find(p => p.id === selectedPlayerId)
  const hasInfectFather = state.players.some(p => p.roleId === 'infect_pere_des_loups')
  const hasCupidon = state.players.some(p => p.roleId === 'cupidon') || state.players.some(p => p.isLover)
  const hasFlute = state.players.some(p => p.roleId === 'joueur_de_flute') || state.players.some(p => p.isCharmed)

  const total = state.players.length
  const radius = 175
  const center = 220

  return (
    <div className="bg-ink-900 border border-ink-800 rounded-lg p-5 shadow-2xl space-y-4">
      {/* Header with View Toggle */}
      <div className="flex items-center justify-between border-b border-ink-800 pb-3">
        <div>
          <h3 className="font-serif font-bold text-sm tracking-wider uppercase text-parchment-200">
            La Table du Village
          </h3>
          <p className="text-[11px] text-parchment-600 font-reading italic">
            Disposition circulaire des villageois autour de l'âtre
          </p>
        </div>

        <div className="flex items-center gap-1 bg-ink-950 p-1 rounded border border-ink-800 text-xs">
          <button
            onClick={() => setViewMode('circle')}
            className={`px-2.5 py-1 rounded font-serif text-[11px] transition-all ${
              viewMode === 'circle'
                ? 'bg-ink-800 text-parchment-100 border border-ink-700 shadow-sm'
                : 'text-parchment-600 hover:text-parchment-300'
            }`}
          >
            Table Ronde
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-2.5 py-1 rounded font-serif text-[11px] transition-all ${
              viewMode === 'list'
                ? 'bg-ink-800 text-parchment-100 border border-ink-700 shadow-sm'
                : 'text-parchment-600 hover:text-parchment-300'
            }`}
          >
            Registre
          </button>
        </div>
      </div>

      {/* Bear Alert Badge */}
      {bearStatus.hasBear && bearStatus.isBearAlive && (
        <div className={`p-3 rounded border text-xs flex items-center justify-between ${
          bearStatus.growls
            ? 'bg-oxblood-950/80 border-bronze-500/80 text-parchment-200'
            : 'bg-ink-950 border-ink-800 text-parchment-400'
        }`}>
          <div>
            <div className="font-serif font-bold tracking-wider text-bronze-400 uppercase text-[11px]">
              Montreur d'Ours • {bearStatus.bearPlayer?.name}
            </div>
            <p className="text-[11px] mt-0.5">
              {bearStatus.growls ? (
                <span className="text-amber-300 font-semibold">
                  ⚠️ L'Ours grogne ! Au moins un loup vivant est son voisin direct.
                </span>
              ) : (
                <span>L'Ours est paisible ce matin (voisins innocents).</span>
              )}
            </p>
          </div>

          {bearStatus.isBearAlive && bearStatus.growls && (
            <button
              onClick={() => {}}
              className="px-2.5 py-1 bg-bronze-600 hover:bg-bronze-500 text-ink-950 text-xs font-serif font-bold rounded flex items-center gap-1 shrink-0"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Grogner</span>
            </button>
          )}
        </div>
      )}

      {/* Rusty Sword Knight Alert */}
      {rustyStatus.knight && rustyStatus.isKnightAlive && rustyStatus.targetWolf && (
        <div className="p-2.5 rounded border border-ink-800 bg-ink-950 text-xs text-parchment-300">
          <span className="font-serif font-bold text-bronze-400">Épée Rouillée ({rustyStatus.knight.name}) :</span>{' '}
          Premier loup vivant à sa gauche →{' '}
          <strong className="text-rose-400 font-semibold">{rustyStatus.targetWolf.name}</strong>
        </div>
      )}

      {/* CIRCLE VIEW */}
      {viewMode === 'circle' ? (
        <div className="relative flex justify-center items-center py-4 select-none">
          <svg
            viewBox="0 0 440 440"
            className="w-full max-w-[440px] aspect-square drop-shadow-md overflow-visible"
          >
            {/* Outer and Inner Circle Tracks */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="#202029"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
            <circle
              cx={center}
              cy={center}
              r={radius - 40}
              fill="none"
              stroke="#18181f"
              strokeWidth="1"
            />

            {/* Central Hearth */}
            <circle
              cx={center}
              cy={center}
              r="45"
              fill="#121216"
              stroke="#3a3a49"
              strokeWidth="1.5"
            />
            <text
              x={center}
              y={center - 8}
              textAnchor="middle"
              className="fill-parchment-400 font-serif font-bold text-[11px] tracking-widest"
            >
              L'ÂTRE
            </text>
            <text
              x={center}
              y={center + 10}
              textAnchor="middle"
              className="fill-parchment-600 font-reading italic text-[11px]"
            >
              {state.players.filter(p => p.isAlive).length} vivants
            </text>

            {/* Lines from Bear Tamer to his alive neighbors */}
            {bearStatus.hasBear && bearStatus.isBearAlive && bearStatus.bearPlayer && (() => {
              const bearIdx = state.players.findIndex(p => p.id === bearStatus.bearPlayer?.id)
              if (bearIdx === -1) return null

              const angleBear = (bearIdx / total) * 2 * Math.PI - Math.PI / 2
              const bx = center + radius * Math.cos(angleBear)
              const by = center + radius * Math.sin(angleBear)

              const leftIdx = bearStatus.leftNeighbor ? state.players.findIndex(p => p.id === bearStatus.leftNeighbor?.id) : -1
              const rightIdx = bearStatus.rightNeighbor ? state.players.findIndex(p => p.id === bearStatus.rightNeighbor?.id) : -1

              return (
                <g>
                  {leftIdx !== -1 && (() => {
                    const aL = (leftIdx / total) * 2 * Math.PI - Math.PI / 2
                    const lx = center + radius * Math.cos(aL)
                    const ly = center + radius * Math.sin(aL)
                    return (
                      <line
                        x1={bx}
                        y1={by}
                        x2={lx}
                        y2={ly}
                        stroke={bearStatus.leftIsWolf ? '#dc2626' : '#b88533'}
                        strokeWidth="2.5"
                        strokeDasharray={bearStatus.leftIsWolf ? '0' : '4 2'}
                        opacity="0.8"
                      />
                    )
                  })()}
                  {rightIdx !== -1 && (() => {
                    const aR = (rightIdx / total) * 2 * Math.PI - Math.PI / 2
                    const rx = center + radius * Math.cos(aR)
                    const ry = center + radius * Math.sin(aR)
                    return (
                      <line
                        x1={bx}
                        y1={by}
                        x2={rx}
                        y2={ry}
                        stroke={bearStatus.rightIsWolf ? '#dc2626' : '#b88533'}
                        strokeWidth="2.5"
                        strokeDasharray={bearStatus.rightIsWolf ? '0' : '4 2'}
                        opacity="0.8"
                      />
                    )
                  })()}
                </g>
              )
            })()}

            {/* Player Nodes */}
            {state.players.map((player, idx) => {
              const angle = (idx / total) * 2 * Math.PI - Math.PI / 2
              const x = center + radius * Math.cos(angle)
              const y = center + radius * Math.sin(angle)
              const isSelected = selectedPlayerId === player.id
              const isWolf = isPlayerWerewolf(player, state.players)

              return (
                <g
                  key={player.id}
                  onClick={() => setSelectedPlayerId(isSelected ? null : player.id)}
                  className="cursor-pointer group"
                >
                  {/* Outer glow if selected */}
                  {isSelected && (
                    <circle
                      cx={x}
                      cy={y}
                      r="26"
                      fill="none"
                      stroke="#d4a24c"
                      strokeWidth="2"
                      className="animate-pulse"
                    />
                  )}

                  {/* Seat Base circle */}
                  <circle
                    cx={x}
                    cy={y}
                    r="20"
                    fill={!player.isAlive ? '#121216' : isWolf ? '#2a0808' : '#1c1c24'}
                    stroke={
                      !player.isAlive
                        ? '#3a3a49'
                        : isSelected
                          ? '#d4a24c'
                          : isWolf
                            ? '#781515'
                            : '#484854'
                    }
                    strokeWidth={isSelected ? '2' : '1.5'}
                    className="transition-colors group-hover:stroke-bronze-400"
                  />

                  {/* Seat Number */}
                  <text
                    x={x}
                    y={y + 4}
                    textAnchor="middle"
                    className={`font-mono text-xs font-bold pointer-events-none ${
                      !player.isAlive ? 'fill-ink-600 line-through' : isWolf ? 'fill-rose-300' : 'fill-parchment-200'
                    }`}
                  >
                    {player.seatNumber}
                  </text>

                  {/* Player Name label */}
                  <text
                    x={x}
                    y={y + (y > center ? 30 : -24)}
                    textAnchor="middle"
                    className={`text-[10px] font-sans font-medium pointer-events-none ${
                      !player.isAlive ? 'fill-ink-500 line-through' : 'fill-parchment-100'
                    }`}
                  >
                    {player.name.length > 9 ? player.name.substring(0, 8) + '…' : player.name}
                  </text>

                  {/* Status Badges on circle */}
                  {player.isCaptain && (
                    <circle cx={x + 14} cy={y - 14} r="5" fill="#d4a24c" stroke="#070709" strokeWidth="1" />
                  )}
                  {player.isLover && (
                    <circle cx={x - 14} cy={y - 14} r="5" fill="#ec4899" stroke="#070709" strokeWidth="1" />
                  )}
                  {player.isCharmed && (
                    <circle cx={x - 14} cy={y + 14} r="5" fill="#8b5cf6" stroke="#070709" strokeWidth="1" />
                  )}
                  {player.isInfected && (
                    <circle cx={x + 14} cy={y + 14} r="5" fill="#10b981" stroke="#070709" strokeWidth="1" />
                  )}
                </g>
              )
            })}
          </svg>
        </div>
      ) : (
        /* LIST VIEW */
        <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
          {state.players.map((p) => {
            const role = ROLES_BEST_OF[p.roleId]
            const isWolf = isPlayerWerewolf(p, state.players)
            const isSelected = selectedPlayerId === p.id

            return (
              <div
                key={p.id}
                onClick={() => setSelectedPlayerId(isSelected ? null : p.id)}
                className={`p-2 rounded border cursor-pointer flex items-center justify-between text-xs transition-colors ${
                  isSelected
                    ? 'bg-ink-800 border-bronze-500 text-parchment-100'
                    : !p.isAlive
                      ? 'bg-ink-950/60 border-ink-850 opacity-50 text-ink-500'
                      : isWolf
                        ? 'bg-oxblood-950/40 border-oxblood-900/60 hover:border-oxblood-800'
                        : 'bg-ink-950 border-ink-800 hover:border-ink-750'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-ink-900 border border-ink-750 flex items-center justify-center font-mono text-[10px] text-parchment-400">
                    {p.seatNumber}
                  </span>
                  <span className={`font-medium ${!p.isAlive ? 'line-through text-ink-500' : 'text-parchment-200'}`}>
                    {p.name}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded border ${role.color}`}>
                    {role.name}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {p.isCaptain && <span className="text-[10px] text-bronze-400 font-bold">Capitaine</span>}
                  {p.isLover && <span className="text-[10px] text-pink-400 font-bold">Amoureux</span>}
                  {p.isCharmed && <span className="text-[10px] text-violet-400 font-bold">Envoûté</span>}
                  {p.isInfected && <span className="text-[10px] text-emerald-400 font-bold">Infecté</span>}
                  <span className={`text-[11px] font-sans font-medium px-2 py-0.5 rounded ${
                    p.isAlive ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-oxblood-950 text-rose-400 border border-oxblood-800'
                  }`}>
                    {p.isAlive ? 'Vivant' : 'Éliminé'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Selected Player Inspector Card */}
      {selectedPlayer && (
        <div className="p-4 rounded-lg bg-ink-950 border border-bronze-600/70 shadow-lg text-xs space-y-3">
          <div className="flex items-start justify-between border-b border-ink-800 pb-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-bronze-400 font-bold">Siège #{selectedPlayer.seatNumber}</span>
                <h4 className="font-serif font-bold text-sm text-parchment-100">{selectedPlayer.name}</h4>
                <span className={`px-2 py-0.5 rounded text-[10px] border ${ROLES_BEST_OF[selectedPlayer.roleId].color}`}>
                  {ROLES_BEST_OF[selectedPlayer.roleId].name}
                </span>
              </div>
              <p className="text-[11px] text-parchment-400 font-reading italic mt-0.5">
                {ROLES_BEST_OF[selectedPlayer.roleId].description}
              </p>
            </div>

            <button
              onClick={() => setSelectedPlayerId(null)}
              className="text-ink-500 hover:text-parchment-200 text-sm font-mono"
            >
              ✕
            </button>
          </div>

          {/* Action Row: Life status */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-parchment-400 text-xs">État de survie :</span>

            {selectedPlayer.isAlive ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => togglePlayerLife(selectedPlayer.id, 'vote')}
                  className="px-2 py-1 rounded bg-oxblood-900 hover:bg-oxblood-800 border border-oxblood-700 text-rose-200 font-medium"
                >
                  Condamné au bûcher
                </button>
                <button
                  onClick={() => togglePlayerLife(selectedPlayer.id, 'loups')}
                  className="px-2 py-1 rounded bg-oxblood-900 hover:bg-oxblood-800 border border-oxblood-700 text-rose-200 font-medium"
                >
                  Dévoré par les loups
                </button>
                <button
                  onClick={() => togglePlayerLife(selectedPlayer.id, 'sorciere')}
                  className="px-2 py-1 rounded bg-ink-800 hover:bg-ink-750 border border-ink-700 text-indigo-300 font-medium"
                >
                  Poison sorcière
                </button>
              </div>
            ) : (
              <button
                onClick={() => togglePlayerLife(selectedPlayer.id)}
                className="px-3 py-1 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 font-medium"
              >
                Ressusciter ce joueur
              </button>
            )}
          </div>

          {/* Toggles relevant strictly to present roles */}
          <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-ink-850">
            <button
              onClick={() => setPlayerCaptain(selectedPlayer.id)}
              className={`px-2 py-1 rounded border text-[11px] font-serif transition-colors ${
                selectedPlayer.isCaptain
                  ? 'bg-bronze-900 border-bronze-500 text-bronze-200'
                  : 'bg-ink-900 border-ink-800 text-parchment-400 hover:text-parchment-200'
              }`}
            >
              {selectedPlayer.isCaptain ? '✓ Capitaine' : '+ Capitaine'}
            </button>

            {hasCupidon && (
              <button
                onClick={() => togglePlayerLover(selectedPlayer.id)}
                className={`px-2 py-1 rounded border text-[11px] font-serif transition-colors ${
                  selectedPlayer.isLover
                    ? 'bg-pink-950 border-pink-700 text-pink-300'
                    : 'bg-ink-900 border-ink-800 text-parchment-400 hover:text-parchment-200'
                }`}
              >
                {selectedPlayer.isLover ? '✓ Amoureux' : '+ Amoureux'}
              </button>
            )}

            {hasFlute && (
              <button
                onClick={() => togglePlayerCharmed(selectedPlayer.id)}
                className={`px-2 py-1 rounded border text-[11px] font-serif transition-colors ${
                  selectedPlayer.isCharmed
                    ? 'bg-violet-950 border-violet-700 text-violet-300'
                    : 'bg-ink-900 border-ink-800 text-parchment-400 hover:text-parchment-200'
                }`}
              >
                {selectedPlayer.isCharmed ? '✓ Envoûté' : '+ Envoûté'}
              </button>
            )}

            {hasInfectFather && (
              <button
                onClick={() => setPlayerInfected(selectedPlayer.id, !selectedPlayer.isInfected)}
                className={`px-2 py-1 rounded border text-[11px] font-serif transition-colors ${
                  selectedPlayer.isInfected
                    ? 'bg-emerald-950 border-emerald-700 text-emerald-300'
                    : 'bg-ink-900 border-ink-800 text-parchment-400 hover:text-parchment-200'
                }`}
              >
                {selectedPlayer.isInfected ? '✓ Infecté' : '+ Infecter'}
              </button>
            )}

            {selectedPlayer.roleId === 'enfant_sauvage' && (
              <div className="flex items-center gap-1.5 bg-ink-900 border border-ink-800 px-2 py-1 rounded text-[11px]">
                <span className="text-lime-300 font-serif">Modèle:</span>
                <select
                  value={selectedPlayer.wildChildModelId || ''}
                  onChange={e => setWildChildModel(selectedPlayer.id, e.target.value)}
                  className="bg-transparent text-parchment-200 focus:outline-none"
                >
                  <option value="" className="bg-ink-950">-- Choisir --</option>
                  {state.players.filter(p => p.id !== selectedPlayer.id).map(p => (
                    <option key={p.id} value={p.id} className="bg-ink-950">
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedPlayer.roleId === 'chien_loup' && (
              <div className="flex items-center gap-1.5 bg-ink-900 border border-ink-800 px-2 py-1 rounded text-[11px]">
                <span className="text-parchment-400 font-serif">Allégeance:</span>
                <select
                  value={selectedPlayer.dogWolfChoice || 'village'}
                  onChange={e => setDogWolfChoice(selectedPlayer.id, e.target.value as 'village' | 'loup')}
                  className="bg-transparent text-parchment-200 focus:outline-none"
                >
                  <option value="village" className="bg-ink-950">Village</option>
                  <option value="loup" className="bg-ink-950">Meute des Loups</option>
                </select>
              </div>
            )}

            {selectedPlayer.roleId === 'renard' && (
              <button
                onClick={() => setFoxLostPower(selectedPlayer.id, !selectedPlayer.foxLostPower)}
                className={`px-2 py-1 rounded border text-[11px] font-serif transition-colors ${
                  selectedPlayer.foxLostPower
                    ? 'bg-oxblood-950 border-oxblood-800 text-rose-300'
                    : 'bg-ink-900 border-ink-800 text-parchment-300'
                }`}
              >
                {selectedPlayer.foxLostPower ? 'Flair perdu' : 'Flair actif'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
