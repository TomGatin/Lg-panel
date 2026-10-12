import React from 'react'
import { useGame } from '../context/GameContext'
import { RotateCcw } from 'lucide-react'
import { isPlayerWerewolf } from '../utils/gameHelpers'

export const Header: React.FC = () => {
  const { state, resetToSetup } = useGame()

  if (state.phase === 'setup') return null

  const alivePlayers = state.players.filter(p => p.isAlive)
  const aliveWolves = alivePlayers.filter(p => isPlayerWerewolf(p, state.players))
  const aliveVillagers = alivePlayers.filter(p => !isPlayerWerewolf(p, state.players))
  const charmedCount = alivePlayers.filter(p => p.isCharmed).length

  return (
    <header className="bg-stone-900 border-b border-stone-800 px-6 py-3.5 sticky top-0 z-40 shadow-xl">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-6 flex-wrap">
        {/* Masthead */}
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-md bg-stone-950 border border-brass-700/60 flex items-center justify-center text-brass-400 font-serif font-black text-sm shadow-inner">
            TG
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif font-extrabold text-sm sm:text-base text-stone-100 tracking-wider">
                THIERCELIEUX
              </h1>
              <span className="text-[10px] uppercase tracking-widest font-sans font-bold px-2 py-0.5 rounded bg-brass-900/60 text-brass-300 border border-brass-700/50">
                Best Of
              </span>
            </div>
            <p className="text-[11px] text-stone-400 font-sans tracking-wide">
              Registre du Meneur de Jeu
            </p>
          </div>
        </div>

        {/* Tactical Counters & Reset */}
        <div className="flex items-center gap-5">
          <div className="hidden md:flex items-center gap-4 text-xs font-sans">
            <div className="text-stone-300">
              <span className="text-stone-400">Vivants :</span>{' '}
              <strong className="text-stone-100 font-semibold">{alivePlayers.length}</strong>
              <span className="text-stone-400">/{state.players.length}</span>
            </div>

            <div className="h-3 w-px bg-stone-800" />

            <div className="text-rose-300">
              <span className="text-stone-400">Meute :</span>{' '}
              <strong className="font-semibold">{aliveWolves.length}</strong>
            </div>

            <div className="h-3 w-px bg-stone-800" />

            <div className="text-stone-300">
              <span className="text-stone-400">Village :</span>{' '}
              <strong className="font-semibold">{aliveVillagers.length}</strong>
            </div>

            {charmedCount > 0 && (
              <>
                <div className="h-3 w-px bg-stone-800" />
                <div className="text-violet-300">
                  <span className="text-stone-400">Envoûtés :</span>{' '}
                  <strong className="font-semibold">{charmedCount}</strong>
                </div>
              </>
            )}
          </div>

          <button
            onClick={resetToSetup}
            title="Réinitialiser la partie"
            className="p-2 rounded-md text-stone-400 hover:text-stone-200 hover:bg-stone-800 border border-transparent hover:border-stone-700 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
