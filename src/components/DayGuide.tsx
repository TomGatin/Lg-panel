import React, { useState } from 'react'
import { useGame } from '../context/GameContext'
import { getBearGrowlStatus } from '../utils/gameHelpers'
import { Play, Pause, RotateCcw, Volume2, Moon, Skull, ShieldAlert, Crown, Crosshair } from 'lucide-react'

export const DayGuide: React.FC = () => {
  const {
    state,
    startTimer,
    pauseTimer,
    resetTimer,
    setTimerSeconds,
    togglePlayerLife,
    advanceToNight,
    executeHunterShot,
    assignCaptainSuccessor,
    setPlayerCaptain
  } = useGame()

  const [selectedVoteVictimId, setSelectedVoteVictimId] = useState<string>('')

  const alivePlayers = state.players.filter(p => p.isAlive)
  const bearStatus = getBearGrowlStatus(state.players)

  const hunter = state.players.find(p => p.id === state.pendingHunterShotPlayerId)

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleExecuteVote = () => {
    if (!selectedVoteVictimId) return
    if (window.confirm("Confirmer la condamnation de ce joueur au bûcher ?")) togglePlayerLife(selectedVoteVictimId, 'vote')
    setSelectedVoteVictimId('')
  }

  const recentDeaths = state.players.filter(p => !p.isAlive && p.deathRound === `Nuit ${state.roundNumber}`)

  return (
    <div className="bg-ink-900 border border-ink-800 rounded-lg p-5 shadow-2xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-ink-800 pb-3">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-bronze-400">
            Phase Diurne • Conseil du Village
          </span>
          <h2 className="font-serif font-bold text-base text-parchment-100 tracking-wide">
            Jour #{state.roundNumber}
          </h2>
        </div>

        <div className="font-mono text-xs text-parchment-400 bg-ink-950 px-2.5 py-1 rounded border border-ink-800">
          {alivePlayers.length} villageois en vie
        </div>
      </div>

      {/* URGENT INTERVENTION 1: HUNTER SHOT */}
      {hunter && (
        <div className="p-4 rounded-lg bg-oxblood-950 border-2 border-oxblood-600 shadow-xl space-y-2.5 animate-pulse">
          <div className="flex items-center gap-2 text-rose-300 font-serif font-bold text-sm">
            <Crosshair className="w-4 h-4 text-rose-400" />
            <span>Tir Ultime du Chasseur ({hunter.name})</span>
          </div>
          <p className="text-xs text-parchment-300">
            Le Chasseur a été abattu. Dans un dernier souffle, il tire sur un joueur vivant. Qui abat-il ?
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {alivePlayers.map(p => (
              <button
                key={p.id}
                onClick={() => executeHunterShot(p.id)}
                className="px-2.5 py-1 rounded bg-ink-950 hover:bg-oxblood-900 border border-oxblood-700 text-rose-200 text-xs font-serif font-semibold"
              >
                Abattre {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* URGENT INTERVENTION 2: CAPTAIN SUCCESSION */}
      {state.pendingCaptainSuccessor && (
        <div className="p-4 rounded-lg bg-bronze-950/80 border-2 border-bronze-500 shadow-xl space-y-2.5">
          <div className="flex items-center gap-2 text-bronze-300 font-serif font-bold text-sm">
            <Crown className="w-4 h-4 text-bronze-400" />
            <span>Désignation du Nouveau Capitaine</span>
          </div>
          <p className="text-xs text-parchment-300">
            L'ancien Capitaine est mort. Il doit désigner son successeur parmi les survivants :
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {alivePlayers.map(p => (
              <button
                key={p.id}
                onClick={() => assignCaptainSuccessor(p.id)}
                className="px-2.5 py-1 rounded bg-ink-950 hover:bg-bronze-900 border border-bronze-600 text-bronze-200 text-xs font-serif font-semibold"
              >
                Élire {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* VILLAGE POWERS DISABLED WARNING (ANCIEN PENALTY) */}
      {state.villagePowersDisabled && (
        <div className="p-3 rounded bg-ink-950 border border-oxblood-700 text-rose-300 text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
          <span>
            <strong>Malédiction de l'Ancien :</strong> Le village ayant exécuté l'Ancien au bûcher, tous les pouvoirs des villageois sont anéantis.
          </span>
        </div>
      )}

      
      {/* CAPTAIN ELECTION ON DAY 1 */}
      {state.roundNumber === 1 && !state.players.some(p => p.isCaptain) && (
        <div className="p-4 rounded-lg bg-brass-950/40 border border-brass-700/50 space-y-3">
          <div className="flex items-center gap-2 text-brass-400 font-serif font-bold text-sm uppercase tracking-wider">
            <Crown className="w-4 h-4" />
            <span>Élection du Capitaine</span>
          </div>
          <p className="text-xs text-stone-300">
            Le village doit élire son Capitaine. Son vote comptera double (ou tranchera en cas d'égalité).
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {alivePlayers.map(p => (
              <button
                key={p.id}
                onClick={() => setPlayerCaptain(p.id)}
                className="px-3 py-1.5 bg-stone-900 border border-stone-700 hover:border-brass-500 rounded text-xs text-stone-200 transition-colors"
              >
                Élire {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 1. Morning Casualties Report */}
      <div className="bg-ink-950 rounded-lg border border-ink-800 p-4 space-y-2">
        <h3 className="font-serif text-xs font-bold uppercase tracking-wider text-parchment-400 flex items-center gap-1.5">
          <Skull className="w-3.5 h-3.5 text-rose-400" />
          <span>Morts de la Nuit à Proclamer</span>
        </h3>

        {recentDeaths.length > 0 ? (
          <div className="space-y-1">
            {recentDeaths.map(d => (
              <div
                key={d.id}
                className="p-2 rounded bg-ink-900 border border-oxblood-900/60 text-xs flex items-center justify-between"
              >
                <div className="font-medium text-parchment-200">
                  <span className="text-rose-400 font-semibold">{d.name}</span>{' '}
                  <span className="text-parchment-500 font-reading italic">({d.deathReason})</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-emerald-400 font-reading italic">
            Miracle à Thiercelieux : le soleil se lève sans aucun cadavre à déplorer.
          </p>
        )}
      </div>

      {/* 2. Bear Alert (if Bear Tamer is alive) */}
      {bearStatus.hasBear && bearStatus.isBearAlive && (
        <div className={`p-3.5 rounded-lg border text-xs flex items-center justify-between ${
          bearStatus.growls
            ? 'bg-oxblood-950 border-bronze-500/80 text-parchment-200'
            : 'bg-ink-950 border-ink-800 text-parchment-400'
        }`}>
          <div>
            <div className="font-serif font-bold uppercase tracking-wider text-bronze-400 text-[11px] mb-0.5">
              Rappel Montreur d'Ours
            </div>
            <p>
              {bearStatus.growls ? (
                <span className="text-amber-300 font-semibold">
                  L'ours doit grogner avant d'ouvrir les débats (loup voisin détecté).
                </span>
              ) : (
                <span>L'ours reste silencieux (voisins innocents).</span>
              )}
            </p>
          </div>

          {bearStatus.growls && (
            <button
              onClick={() => {}} // Disabled automatic play
              className="px-2.5 py-1 bg-bronze-600 hover:bg-bronze-500 text-ink-950 text-xs font-serif font-bold rounded flex items-center gap-1 shrink-0"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Grogner</span>
            </button>
          )}
        </div>
      )}

      {/* 3. Debates Timer */}
      <div className="bg-ink-950 rounded-lg border border-ink-800 p-6 text-center shadow-inner">
        <div className="flex items-center justify-between mb-1">
          <span className="font-serif text-[11px] font-bold uppercase tracking-wider text-parchment-500">
            Chronomètre de Débat Public
          </span>
          <span className="text-[10px] text-parchment-600 font-mono">Gong automatique à 00:00</span>
        </div>

        {/* Large Classical Figures */}
        <div className={`font-mono font-bold text-6xl tracking-widest my-4 ${
          state.timerRemaining === 0
            ? 'text-rose-500 animate-pulse'
            : state.timerRemaining < 30
              ? 'text-bronze-400'
              : 'text-parchment-100'
        }`}>
          {formatTime(state.timerRemaining)}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {state.isTimerRunning ? (
            <button
              onClick={pauseTimer}
              className="px-5 py-2 rounded bg-ink-800 hover:bg-ink-750 text-bronze-300 border border-ink-700 text-xs font-serif font-bold flex items-center gap-1.5 transition-colors"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Suspendre</span>
            </button>
          ) : (
            <button
              onClick={startTimer}
              className="px-5 py-2 rounded bg-bronze-800 hover:bg-bronze-700 text-parchment-100 border border-bronze-600 text-xs font-serif font-bold flex items-center gap-1.5 transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Lancer le Débat</span>
            </button>
          )}

          <button
            onClick={() => resetTimer()}
            className="p-2 rounded border border-ink-800 bg-ink-900 hover:bg-ink-850 text-parchment-400 hover:text-parchment-200 transition-colors"
            title="Réinitialiser"
          >
            <RotateCcw className="w-4 h-4" />
          </button>


        </div>

        {/* Presets */}
        <div className="flex items-center justify-center gap-1.5 text-xs">
          <span className="text-parchment-500 text-[11px] mr-1 font-reading italic">Durée :</span>
          {[60, 120, 180, 300].map(sec => (
            <button
              key={sec}
              onClick={() => setTimerSeconds(sec)}
              className="px-2.5 py-1 rounded bg-ink-900 hover:bg-ink-800 border border-ink-800 text-parchment-300 text-[11px] font-mono"
            >
              {sec / 60}m
            </button>
          ))}
        </div>
      </div>

      {/* 4. Sentence du Village */}
      <div className="bg-ink-950 rounded-lg border border-ink-800 p-4 space-y-2.5">
        <h3 className="font-serif text-xs font-bold uppercase tracking-wider text-parchment-200">
          Sentence Populaire (Bûcher du Village)
        </h3>
        <p className="text-xs text-parchment-400">
          Désignez le joueur condamné par le vote majoritaire (la voix du Capitaine départage ou compte double) :
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={selectedVoteVictimId}
            onChange={e => setSelectedVoteVictimId(e.target.value)}
            className="flex-1 bg-ink-900 border border-ink-800 rounded px-3 py-2 text-xs text-parchment-100 focus:outline-none focus:border-bronze-600"
          >
            <option value="">-- Sélectionner le condamné --</option>
            {alivePlayers.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} {p.isCaptain ? '(Capitaine)' : ''}
              </option>
            ))}
          </select>

          <button
            disabled={!selectedVoteVictimId}
            onClick={handleExecuteVote}
            className="px-4 py-2 rounded font-serif font-bold text-xs uppercase tracking-wider bg-oxblood-900 hover:bg-oxblood-800 disabled:opacity-40 text-rose-100 border border-oxblood-700 flex items-center gap-1.5 transition-colors shadow"
          >
            <Skull className="w-3.5 h-3.5" />
            <span>Condamner</span>
          </button>
        </div>
      </div>

      {/* Night Transition Button */}
      <button
        onClick={advanceToNight}
        className="w-full py-3 px-4 rounded font-serif font-bold text-xs uppercase tracking-wider bg-ink-800 hover:bg-ink-750 text-parchment-200 border border-ink-700 flex items-center justify-center gap-2 transition-all shadow-md"
      >
        <Moon className="w-4 h-4 text-indigo-400" />
        <span>Crépuscule • Clore la Journée et Endormir Thiercelieux</span>
      </button>
    </div>
  )
}
