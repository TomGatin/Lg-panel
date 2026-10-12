import React, { useState } from 'react'
import { useGame } from '../context/GameContext'
import { getNightSteps, getFoxResult, isPlayerWerewolf } from '../utils/gameHelpers'
import { ROLES_BEST_OF } from '../data/roles'
import { Sun, ArrowRight, ArrowLeft } from 'lucide-react'

export const NightGuide: React.FC = () => {
  const { state, setNightData, completeNightStep, advanceToDay, togglePlayerCharmed, togglePlayerLover, setWildChildModel } = useGame()

  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  const [inspectedPlayerId, setInspectedPlayerId] = useState<string | null>(null)
  const [foxTargetId, setFoxTargetId] = useState<string | null>(null)

  const steps = getNightSteps(state.roundNumber, state.players)
  const alivePlayers = state.players.filter(p => p.isAlive)

  // Ensure index in bounds
  const activeIdx = Math.min(currentStepIdx, Math.max(0, steps.length - 1))
  const step = steps[activeIdx]

  // Role presence checks for strict logic
  const hasInfectFather = state.players.some(p => p.roleId === 'infect_pere_des_loups' && p.isAlive)

  // Current targets
  const wolfVictim = state.players.find(p => p.id === state.night.wolfVictimId)
  const gmlVictim = state.players.find(p => p.id === state.night.gmlVictimId)
  const witchVictim = state.players.find(p => p.id === state.night.witchKillTargetId)
  const whiteWolfVictim = state.players.find(p => p.id === state.night.whiteWolfTargetId)

  const foxResult = foxTargetId ? getFoxResult(foxTargetId, state.players) : null

  if (!step || steps.length === 0) {
    return (
      <div className="bg-ink-900 border border-ink-800 rounded-lg p-6 text-center space-y-3">
        <h3 className="font-serif font-bold text-parchment-200">Aucun appel nocturne requis</h3>
        <p className="text-xs text-parchment-400">Tous les rôles actifs de cette nuit dorment déjà.</p>
        <button
          onClick={advanceToDay}
          className="px-4 py-2 bg-bronze-700 hover:bg-bronze-600 text-ink-950 font-serif font-bold text-xs uppercase tracking-wider rounded"
        >
          Passer au Jour
        </button>
      </div>
    )
  }

  const isLastStep = activeIdx === steps.length - 1

  return (
    <div className="bg-ink-900 border border-ink-800 rounded-lg p-5 shadow-2xl space-y-4">
      {/* Chapter Navigation Stepper */}
      <div className="flex items-center justify-between border-b border-ink-800 pb-3">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-bronze-400">
            Rituel de Nuit • Acte {state.roundNumber}
          </span>
          <h2 className="font-serif font-bold text-base text-parchment-100 tracking-wide">
            Appel #{activeIdx + 1} : {step.title}
          </h2>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-parchment-500 font-mono text-[11px]">
            {activeIdx + 1} / {steps.length}
          </span>
        </div>
      </div>

      {/* Steps Pill Track */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1.5 scrollbar-thin">
        {steps.map((s, i) => {
          const isDone = !!state.night.completedSteps[s.id]
          const isCurrent = i === activeIdx
          return (
            <button
              key={s.id}
              onClick={() => setCurrentStepIdx(i)}
              className={`px-2.5 py-1 rounded text-[11px] font-serif shrink-0 transition-all ${
                isCurrent
                  ? 'bg-bronze-900/90 border border-bronze-500 text-parchment-100 font-bold shadow-sm'
                  : isDone
                    ? 'bg-ink-950 border border-ink-800 text-parchment-500 line-through'
                    : 'bg-ink-950 border border-ink-850 text-parchment-400 hover:text-parchment-200'
              }`}
            >
              {i + 1}. {s.title}
            </button>
          )
        })}
      </div>

      {/* Main Theatrical Stage */}
      <div className="bg-ink-950 rounded-lg border border-ink-800 p-5 space-y-4">
        {(() => {
          let p = []
          if (step.id === 'amoureux') p = state.players.filter(x => x.isLover && x.isAlive)
          else if (step.id === 'loups_garous') p = state.players.filter(x => isPlayerWerewolf(x, state.players) && x.isAlive)
          else if (step.id === 'charmes_reveil') p = state.players.filter(x => x.isCharmed && x.isAlive)
          else p = state.players.filter(x => x.roleId === step.id && x.isAlive)
          
          if (p.length > 0) {
            return (
              <div className="text-sm font-reading text-bronze-300 font-semibold italic mb-3">
                Appelés : {p.map(x => x.name).join(', ')}
              </div>
            )
          }
          return null
        })()}

        {/* Step-Specific Controls */}
        <div className="text-xs">
          {/* Enfant Sauvage */}
          {step.id === 'enfant_sauvage' && (
            <div className="space-y-2">
              <span className="text-parchment-300 font-medium block">
                Sélectionnez le Modèle de l'Enfant Sauvage :
              </span>
              <select
                value={state.players.find(p => p.roleId === 'enfant_sauvage')?.wildChildModelId || ''}
                onChange={e => {
                  const child = state.players.find(p => p.roleId === 'enfant_sauvage')
                  if (child) {
                    setWildChildModel(child.id, e.target.value)
                  }
                }}
                className="w-full py-1.5 px-2.5 rounded border bg-ink-900 border-ink-800 text-parchment-300"
              >
                <option value="">-- Choisir un modèle --</option>
                {state.players.filter(p => p.roleId !== 'enfant_sauvage').map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
          {/* Cupidon */}
          {step.id === 'cupidon' && (
            <div className="space-y-2">
              <span className="text-parchment-300 font-medium block">
                Désignez 2 joueurs pour être amoureux :
              </span>
              <div className="flex flex-wrap gap-1.5">
                {alivePlayers.map(p => {
                  const isLover = p.isLover
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePlayerLover(p.id)}
                      className={`px-2.5 py-1 rounded border text-xs transition-colors ${
                        isLover
                          ? 'bg-rose-950 border-rose-600 text-rose-200 font-semibold'
                          : 'bg-ink-900 border-ink-800 text-parchment-300 hover:border-ink-700'
                      }`}
                    >
                      {isLover ? '♥ ' : ''}{p.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 1. Voyante */}
          {step.id === 'voyante' && (
            <div className="space-y-2">
              <span className="text-parchment-300 font-medium block">
                Sélectionnez le joueur interrogé par la Voyante :
              </span>
              <div className="flex flex-wrap gap-1.5">
                {alivePlayers.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setInspectedPlayerId(p.id)}
                    className={`px-2.5 py-1 rounded border text-xs transition-colors ${
                      inspectedPlayerId === p.id
                        ? 'bg-purple-950 border-purple-500 text-purple-200 font-bold'
                        : 'bg-ink-900 border-ink-800 text-parchment-300 hover:border-ink-700'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              {inspectedPlayerId && (() => {
                const inspected = state.players.find(p => p.id === inspectedPlayerId)
                if (!inspected) return null
                const role = ROLES_BEST_OF[inspected.roleId]
                return (
                  <div className="p-3 rounded bg-ink-900 border border-purple-800/80 text-purple-200 flex items-center justify-between mt-3">
                    <span>Âme sondée pour <strong>{inspected.name}</strong> :</span>
                    <span className={`px-2.5 py-0.5 rounded font-serif font-bold text-xs border ${role.color}`}>
                      {role.name}
                    </span>
                  </div>
                )
              })()}
            </div>
          )}

          {/* 2. Renard */}
          {step.id === 'renard' && (
            <div className="space-y-2">
              <span className="text-parchment-300 font-medium block">
                Joueur central désigné par le Renard :
              </span>
              <div className="flex flex-wrap gap-1.5">
                {alivePlayers.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setFoxTargetId(p.id)}
                    className={`px-2.5 py-1 rounded border text-xs transition-colors ${
                      foxTargetId === p.id
                        ? 'bg-orange-950 border-orange-500 text-orange-200 font-bold'
                        : 'bg-ink-900 border-ink-800 text-parchment-300 hover:border-ink-700'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              {foxResult && (
                <div className={`p-3 rounded border mt-3 ${
                  foxResult.hasWolf
                    ? 'bg-oxblood-950 border-oxblood-700 text-rose-200'
                    : 'bg-emerald-950 border-emerald-800 text-emerald-200'
                }`}>
                  <div className="font-semibold text-xs">
                    {foxResult.hasWolf
                      ? `Flair positif : au moins un loup se cache dans le trio (${foxResult.leftNeighbor?.name}, ${foxResult.target.name}, ${foxResult.rightNeighbor?.name}). Le Renard garde son pouvoir.`
                      : `Flair négatif : aucun loup dans le trio (${foxResult.leftNeighbor?.name}, ${foxResult.target.name}, ${foxResult.rightNeighbor?.name}). Le Renard perd son flair pour le restant de la partie.`}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. Loups-Garous */}
          {step.id === 'loups_garous' && (
            <div className="space-y-3">
              <div>
                <span className="text-parchment-300 font-medium block mb-1.5">
                  Désigner la proie de la Meute :
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {alivePlayers.map(p => {
                    const isTarget = state.night.wolfVictimId === p.id
                    return (
                      <button
                        key={p.id}
                        onClick={() => setNightData('wolfVictimId', isTarget ? undefined : p.id)}
                        className={`px-2.5 py-1 rounded border text-xs transition-colors ${
                          isTarget
                            ? 'bg-oxblood-950 border-oxblood-600 text-rose-200 font-bold'
                            : 'bg-ink-900 border-ink-800 text-parchment-300 hover:border-ink-700'
                        }`}
                      >
                        {p.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Infection OPTION: STRICTLY ONLY IF INFECT FATHER IS IN GAME AND ALIVE */}
              {hasInfectFather && state.night.wolfVictimId && !state.night.infectionUsedThisGame && (
                <div className="p-3 rounded bg-ink-900 border border-emerald-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-emerald-300 font-medium block">
                      Infect Père des Loups en vie
                    </span>
                    <span className="text-[11px] text-parchment-500">
                      Souhaite-t-il infecter la victime au lieu de la dévorer ?
                    </span>
                  </div>

                  <button
                    onClick={() => setNightData('infectedVictimId', state.night.infectedVictimId ? undefined : state.night.wolfVictimId)}
                    className={`px-3 py-1 rounded text-xs font-serif font-semibold border transition-colors ${
                      state.night.infectedVictimId
                        ? 'bg-emerald-800 border-emerald-500 text-white'
                        : 'bg-ink-950 border-emerald-800 text-emerald-400'
                    }`}
                  >
                    {state.night.infectedVictimId ? 'Infection Active' : 'Infecter la Proie'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 4. Grand Méchant Loup */}
          {step.id === 'grand_mechant_loup' && (
            <div className="space-y-2">
              <span className="text-parchment-300 font-medium block">
                Seconde victime du Grand Méchant Loup :
              </span>
              <div className="flex flex-wrap gap-1.5">
                {alivePlayers.filter(p => p.id !== state.night.wolfVictimId).map(p => {
                  const isTarget = state.night.gmlVictimId === p.id
                  return (
                    <button
                      key={p.id}
                      onClick={() => setNightData('gmlVictimId', isTarget ? undefined : p.id)}
                      className={`px-2.5 py-1 rounded border text-xs transition-colors ${
                        isTarget
                          ? 'bg-oxblood-950 border-oxblood-600 text-rose-200 font-bold'
                          : 'bg-ink-900 border-ink-800 text-parchment-300 hover:border-ink-700'
                      }`}
                    >
                      {p.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 5. Loup Blanc */}
          {step.id === 'loup_blanc' && (
            <div className="space-y-2">
              <span className="text-parchment-300 font-medium block">
                Loup à éliminer en traître (optionnel) :
              </span>
              <div className="flex flex-wrap gap-1.5">
                {alivePlayers.filter(p => isPlayerWerewolf(p, state.players) && p.roleId !== 'loup_blanc').map(p => {
                  const isTarget = state.night.whiteWolfTargetId === p.id
                  return (
                    <button
                      key={p.id}
                      onClick={() => setNightData('whiteWolfTargetId', isTarget ? undefined : p.id)}
                      className={`px-2.5 py-1 rounded border text-xs transition-colors ${
                        isTarget
                          ? 'bg-ink-800 border-parchment-300 text-parchment-100 font-bold'
                          : 'bg-ink-900 border-ink-800 text-parchment-300 hover:border-ink-700'
                      }`}
                    >
                      {p.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 6. Sorcière */}
          {step.id === 'sorciere' && (
            <div className="space-y-3">
              <div className="p-2.5 rounded bg-ink-900 border border-ink-800 text-parchment-300">
                Victime des loups :{' '}
                {wolfVictim ? (
                  <strong className="text-rose-300">{wolfVictim.name}</strong>
                ) : (
                  <span className="text-parchment-500 italic">Aucune victime cette nuit</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={state.night.witchHealUsed || !wolfVictim}
                  onClick={() => setNightData('witchSavedVictim', !state.night.witchSavedVictim)}
                  className={`flex-1 py-1.5 px-3 rounded text-xs font-serif font-semibold border transition-colors ${
                    state.night.witchSavedVictim
                      ? 'bg-emerald-900 border-emerald-500 text-white'
                      : state.night.witchHealUsed
                        ? 'bg-ink-900 border-ink-850 text-parchment-600 cursor-not-allowed'
                        : 'bg-ink-900 border-emerald-800 text-emerald-300 hover:bg-emerald-950'
                  }`}
                >
                  {state.night.witchSavedVictim
                    ? '✓ Potion de Vie (Activée)'
                    : state.night.witchHealUsed
                      ? 'Potion de Vie Épuisée'
                      : 'Sauver la Victime'}
                </button>

                <div className="flex-1">
                  <select
                    disabled={state.night.witchKillUsed}
                    value={state.night.witchKillTargetId || ''}
                    onChange={e => setNightData('witchKillTargetId', e.target.value || undefined)}
                    className={`w-full py-1.5 px-2.5 rounded text-xs border bg-ink-900 ${
                      state.night.witchKillTargetId
                        ? 'border-indigo-600 text-indigo-300'
                        : state.night.witchKillUsed
                          ? 'border-ink-850 text-parchment-600 cursor-not-allowed'
                          : 'border-ink-800 text-parchment-300'
                    }`}
                  >
                    <option value="">
                      {state.night.witchKillUsed ? 'Potion de Mort Épuisée' : 'Potion de Mort (choisir cible)'}
                    </option>
                    {alivePlayers.filter(p => p.id !== state.night.wolfVictimId && p.id !== state.night.gmlVictimId).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 7. Joueur de Flûte */}
          {step.id === 'joueur_de_flute' && (
            <div className="space-y-2">
              <span className="text-parchment-300 font-medium block">
                Sélectionnez 2 âmes à envoûter :
              </span>
              <div className="flex flex-wrap gap-1.5">
                {alivePlayers.filter(p => p.roleId !== 'joueur_de_flute').map(p => {
                  const isCharmedAlready = p.isCharmed
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        togglePlayerCharmed(p.id)
                        const newCharmed = isCharmedAlready
                          ? state.night.charmedTonightIds.filter(id => id !== p.id)
                          : [...state.night.charmedTonightIds, p.id]
                        setNightData('charmedTonightIds', newCharmed)
                      }}
                      className={`px-2.5 py-1 rounded border text-xs transition-colors ${
                        isCharmedAlready
                          ? 'bg-violet-950 border-violet-600 text-violet-200 font-semibold'
                          : 'bg-ink-900 border-ink-800 text-parchment-300 hover:border-ink-700'
                      }`}
                    >
                      {isCharmedAlready ? '♪ ' : ''}{p.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stepper Navigation Buttons */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          disabled={activeIdx === 0}
          onClick={() => setCurrentStepIdx(prev => Math.max(0, prev - 1))}
          className="px-3 py-1.5 rounded border border-ink-800 bg-ink-950 text-parchment-400 hover:text-parchment-200 disabled:opacity-30 disabled:hover:text-parchment-400 text-xs font-serif flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Appel Précédent</span>
        </button>

        {!isLastStep ? (
          <button
            onClick={() => {
              completeNightStep(step.id)
              setCurrentStepIdx(prev => prev + 1)
            }}
            className="px-4 py-2 rounded bg-ink-800 hover:bg-ink-750 border border-ink-700 text-parchment-100 font-serif font-bold text-xs uppercase tracking-wider flex items-center gap-2"
          >
            <span>Confirmer & Appel Suivant</span>
            <ArrowRight className="w-3.5 h-3.5 text-bronze-400" />
          </button>
        ) : (
          <button
            onClick={() => {
              completeNightStep(step.id)
              advanceToDay()
            }}
            className="px-5 py-2.5 rounded bg-bronze-700 hover:bg-bronze-600 text-ink-950 font-serif font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-md"
          >
            <Sun className="w-4 h-4 fill-current" />
            <span>Fin de la Nuit • Proclamer l'Aube</span>
          </button>
        )}
      </div>

      {/* Night Casualty Briefing */}
      <div className="p-3.5 rounded bg-ink-950 border border-ink-850 text-xs space-y-1 text-parchment-400">
        <div className="font-serif font-bold text-bronze-400 text-[11px] uppercase tracking-wider mb-1">
          Bilan Nocturne
        </div>
        <div>
          Victime des Loups :{' '}
          {wolfVictim ? (
            state.night.infectedVictimId === wolfVictim.id ? (
              <strong className="text-emerald-400">{wolfVictim.name} (Infecté)</strong>
            ) : state.night.witchSavedVictim ? (
              <strong className="text-emerald-400">{wolfVictim.name} (Sauvé par la sorcière)</strong>
            ) : (
              <strong className="text-rose-400">{wolfVictim.name} (Mort)</strong>
            )
          ) : (
            <span className="text-parchment-600 italic">Aucune</span>
          )}
        </div>
        {gmlVictim && <div>Grand Méchant Loup : <strong className="text-rose-400">{gmlVictim.name} (Mort)</strong></div>}
        {witchVictim && <div>Poison Sorcière : <strong className="text-indigo-300">{witchVictim.name} (Mort)</strong></div>}
        {whiteWolfVictim && <div>Loup Blanc : <strong className="text-parchment-200">{whiteWolfVictim.name} (Mort)</strong></div>}
      </div>
    </div>
  )
}
