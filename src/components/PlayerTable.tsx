import React, { useState } from 'react'
import { useGame } from '../context/GameContext'
import { ROLES_BEST_OF } from '../data/roles'
import { Player } from '../types/game'
import { getBearGrowlStatus, getRustySwordTarget, isPlayerWerewolf } from '../utils/gameHelpers'
import { Volume2, Skull, ChevronDown } from 'lucide-react'

export const PlayerTable: React.FC = () => {
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

  const [killingPlayerId, setKillingPlayerId] = useState<string | null>(null)

  const bearStatus = getBearGrowlStatus(state.players)
  const rustyStatus = getRustySwordTarget(state.players)

  const handleKillWithReason = (playerId: string, reason: Player['deathReason']) => {
    togglePlayerLife(playerId, reason)
    setKillingPlayerId(null)
  }

  return (
    <div className="space-y-4">
      {/* Automations Helpers (Bear Tamer & Rusty Sword) */}
      {bearStatus.hasBear && (
        <div className={`p-3.5 rounded-lg border text-xs transition-all ${
          !bearStatus.isBearAlive
            ? 'bg-stone-900 border-stone-800 opacity-60 text-stone-400'
            : bearStatus.growls
              ? 'bg-stone-900 border-brass-600/80 text-stone-200 shadow-md'
              : 'bg-stone-900 border-stone-800 text-stone-300'
        }`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-serif font-bold uppercase tracking-wider text-brass-400">
                  Montreur d'Ours ({bearStatus.bearPlayer?.name})
                </span>
                {bearStatus.isBearAlive && bearStatus.growls && (
                  <span className="px-1.5 py-0.5 rounded bg-brass-900/80 text-brass-300 border border-brass-700/60 text-[10px] font-mono uppercase font-semibold">
                    Grogne
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-300">
                {!bearStatus.isBearAlive ? (
                  <span className="text-stone-400">Le Montreur d'Ours est éliminé.</span>
                ) : bearStatus.growls ? (
                  <span>
                    L'ours sent un loup parmi ses voisins directs ({
                      bearStatus.bearIsInfected
                        ? "l'ours est lui-même infecté"
                        : [
                            bearStatus.leftIsWolf ? bearStatus.leftNeighbor?.name : null,
                            bearStatus.rightIsWolf ? bearStatus.rightNeighbor?.name : null
                          ].filter(Boolean).join(' et ')
                    }).
                  </span>
                ) : (
                  <span className="text-stone-300">
                    L'ours reste paisible ({bearStatus.leftNeighbor?.name} et {bearStatus.rightNeighbor?.name} sont innocents).
                  </span>
                )}
              </p>
            </div>

            {bearStatus.isBearAlive && bearStatus.growls && (
              <button
                onClick={() => {}}
                title="Déclencher le grognement"
                className="px-2.5 py-1.5 rounded bg-brass-700 hover:bg-brass-600 text-stone-950 text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-sm"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Grogner</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Rusty Sword Helper */}
      {rustyStatus.knight && rustyStatus.isKnightAlive && rustyStatus.targetWolf && (
        <div className="p-3 rounded-lg border border-stone-800 bg-stone-900 text-xs text-stone-300">
          <span className="font-serif font-bold text-stone-400">Épée Rouillée :</span>{' '}
          Prochain loup vivant à sa gauche →{' '}
          <strong className="text-rose-300 font-semibold">{rustyStatus.targetWolf.name}</strong>
        </div>
      )}

      {/* Seated Players Roster */}
      <div className="bg-stone-900 rounded-lg border border-stone-800 p-4 shadow-md">
        <div className="flex items-center justify-between mb-3 border-b border-stone-800 pb-2.5">
          <h3 className="font-serif text-xs font-bold uppercase tracking-wider text-stone-300">
            Table des Joueurs ({state.players.length})
          </h3>
          <span className="text-[11px] text-stone-400 font-mono">Ordre des sièges</span>
        </div>

        <div className="space-y-2">
          {state.players.map((player) => {
            const role = ROLES_BEST_OF[player.roleId]
            const isWolfCamp = isPlayerWerewolf(player, state.players)

            return (
              <div
                key={player.id}
                className={`p-2.5 rounded-lg border transition-all ${
                  !player.isAlive
                    ? 'bg-stone-950/40 border-stone-850 opacity-55'
                    : isWolfCamp
                      ? 'bg-stone-950 border-crimson-900/50 hover:border-crimson-800/80'
                      : 'bg-stone-950 border-stone-800 hover:border-stone-700'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Left: Seat & Name & Role */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded bg-stone-900 border border-stone-750 flex items-center justify-center text-[10px] font-mono font-semibold text-stone-400 shrink-0">
                      {player.seatNumber}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium text-sm truncate ${
                          player.isAlive ? 'text-stone-100' : 'text-stone-400 line-through'
                        }`}>
                          {player.name}
                        </span>

                        {/* Text Status Badges */}
                        {player.isCaptain && (
                          <span className="text-[10px] font-sans font-bold uppercase px-1.5 py-0.5 rounded bg-brass-900/60 text-brass-300 border border-brass-700/50">
                            Capitaine
                          </span>
                        )}

                        {player.isLover && (
                          <span className="text-[10px] font-sans font-bold uppercase px-1.5 py-0.5 rounded bg-pink-950/60 text-pink-300 border border-pink-800/50">
                            Amoureux
                          </span>
                        )}

                        {player.isCharmed && (
                          <span className="text-[10px] font-sans font-bold uppercase px-1.5 py-0.5 rounded bg-violet-950/60 text-violet-300 border border-violet-800/50">
                            Envoûté
                          </span>
                        )}

                        {player.isInfected && (
                          <span className="text-[10px] font-sans font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/50">
                            Infecté
                          </span>
                        )}
                      </div>

                      {/* Role indicator */}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[11px] font-sans font-medium px-2 py-0.5 rounded border ${role.color}`}>
                          {role.name}
                        </span>

                        {player.roleId === 'ancien' && (
                          <span className="text-[10px] text-yellow-400 font-mono">
                            [{player.elderLives} vie{player.elderLives > 1 ? 's' : ''}]
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Life State Toggle */}
                  <div className="shrink-0">
                    {player.isAlive ? (
                      <div className="relative">
                        <button
                          onClick={() => setKillingPlayerId(killingPlayerId === player.id ? null : player.id)}
                          className="px-2.5 py-1 rounded text-xs font-sans font-medium bg-stone-900 hover:bg-stone-850 border border-stone-750 text-emerald-400 flex items-center gap-1.5 transition-colors"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>En vie</span>
                          <ChevronDown className="w-3 h-3 text-stone-400" />
                        </button>

                        {/* Clean Dropdown */}
                        {killingPlayerId === player.id && (
                          <div className="absolute right-0 top-full mt-1 z-30 bg-stone-900 border border-stone-700 rounded-lg shadow-2xl p-1.5 w-44 text-xs">
                            <div className="text-[10px] font-mono uppercase text-stone-400 px-2 py-1 border-b border-stone-800 mb-1">
                              Élimination :
                            </div>
                            <button
                              onClick={() => handleKillWithReason(player.id, 'vote')}
                              className="w-full text-left px-2 py-1.5 rounded text-stone-200 hover:bg-stone-800"
                            >
                              Sentence du village
                            </button>
                            <button
                              onClick={() => handleKillWithReason(player.id, 'loups')}
                              className="w-full text-left px-2 py-1.5 rounded text-rose-300 hover:bg-crimson-950/60"
                            >
                              Dévoré par les loups
                            </button>
                            <button
                              onClick={() => handleKillWithReason(player.id, 'sorciere')}
                              className="w-full text-left px-2 py-1.5 rounded text-indigo-300 hover:bg-indigo-950/60"
                            >
                              Poison de la sorcière
                            </button>
                            <button
                              onClick={() => handleKillWithReason(player.id, 'chasseur')}
                              className="w-full text-left px-2 py-1.5 rounded text-amber-300 hover:bg-amber-950/60"
                            >
                              Tir du chasseur
                            </button>
                            <button
                              onClick={() => handleKillWithReason(player.id, 'autre')}
                              className="w-full text-left px-2 py-1.5 rounded text-stone-400 hover:bg-stone-800"
                            >
                              Autre cause
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => togglePlayerLife(player.id)}
                        title="Ressusciter ce joueur"
                        className="px-2.5 py-1 rounded text-xs font-sans font-medium bg-crimson-950/60 hover:bg-crimson-900/70 border border-crimson-800/80 text-rose-300 flex items-center gap-1.5 transition-colors"
                      >
                        <Skull className="w-3 h-3 text-rose-400" />
                        <span>Éliminé</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub-actions toolbar */}
                <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-stone-850 flex-wrap text-xs">
                  <button
                    onClick={() => setPlayerCaptain(player.id)}
                    className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                      player.isCaptain
                        ? 'bg-brass-900/60 border-brass-600 text-brass-300'
                        : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    {player.isCaptain ? '✓ Capitaine' : '+ Capitaine'}
                  </button>

                  <button
                    onClick={() => togglePlayerLover(player.id)}
                    className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                      player.isLover
                        ? 'bg-pink-950/60 border-pink-700 text-pink-300'
                        : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    {player.isLover ? '✓ Amoureux' : '+ Amoureux'}
                  </button>

                  <button
                    onClick={() => togglePlayerCharmed(player.id)}
                    className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                      player.isCharmed
                        ? 'bg-violet-950/60 border-violet-700 text-violet-300'
                        : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    {player.isCharmed ? '✓ Envoûté' : '+ Envoûté'}
                  </button>

                  <button
                    onClick={() => setPlayerInfected(player.id, !player.isInfected)}
                    className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                      player.isInfected
                        ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                        : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    {player.isInfected ? '✓ Infecté' : '+ Infecter'}
                  </button>

                  {player.roleId === 'enfant_sauvage' && (
                    <div className="flex items-center gap-1.5 text-[11px] bg-stone-900 border border-stone-800 px-2 py-0.5 rounded">
                      <span className="text-lime-300">Modèle:</span>
                      <select
                        value={player.wildChildModelId || ''}
                        onChange={e => setWildChildModel(player.id, e.target.value)}
                        className="bg-transparent text-stone-200 focus:outline-none"
                      >
                        <option value="" className="bg-stone-900">-- Choisir --</option>
                        {state.players.filter(p => p.id !== player.id).map(p => (
                          <option key={p.id} value={p.id} className="bg-stone-900">
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {player.roleId === 'chien_loup' && (
                    <div className="flex items-center gap-1.5 text-[11px] bg-stone-900 border border-stone-800 px-2 py-0.5 rounded">
                      <span className="text-stone-400">Allégeance:</span>
                      <select
                        value={player.dogWolfChoice || 'village'}
                        onChange={e => setDogWolfChoice(player.id, e.target.value as 'village' | 'loup')}
                        className="bg-transparent text-stone-200 focus:outline-none"
                      >
                        <option value="village" className="bg-stone-900">Village</option>
                        <option value="loup" className="bg-stone-900">Loup-Garou</option>
                      </select>
                    </div>
                  )}

                  {player.roleId === 'renard' && (
                    <button
                      onClick={() => setFoxLostPower(player.id, !player.foxLostPower)}
                      className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                        player.foxLostPower
                          ? 'bg-crimson-950/60 border-crimson-800 text-rose-300'
                          : 'bg-stone-900 border-stone-800 text-stone-300'
                      }`}
                    >
                      {player.foxLostPower ? 'Flair perdu' : 'Flair actif'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
