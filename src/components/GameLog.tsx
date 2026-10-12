import React from 'react'
import { useGame } from '../context/GameContext'
import { checkVictory } from '../utils/gameHelpers'
import { History, Undo2 } from 'lucide-react'

export const GameLog: React.FC = () => {
  const { state, undoLastDeath } = useGame()

  const victory = checkVictory(state.players)

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Victory Announcement if Game Over */}
      {victory.isOver && (
        <div className="shrink-0 p-4 rounded-lg border border-brass-600/80 bg-stone-900 shadow-xl text-center">
          <div className="text-[10px] font-mono uppercase tracking-widest text-brass-400 mb-1">
            Fin de la Partie
          </div>
          <h3 className="font-serif font-bold text-base text-stone-100 tracking-wide">
            {victory.title?.replace(/[\u{1F300}-\u{1F6FF}]/gu, '')}
          </h3>
          <p className="text-xs text-stone-300 mt-1">
            {victory.description}
          </p>
        </div>
      )}

      {/* Chronicle Log Box */}
      <div className="bg-stone-900 rounded-lg border border-stone-800 p-3.5 shadow-md flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2.5 border-b border-stone-800 pb-2 shrink-0">
          <h3 className="font-serif text-[11px] font-bold uppercase tracking-wider text-stone-300 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-brass-400" />
            <span>Chronique du Village</span>
          </h3>

          <button
            onClick={undoLastDeath}
            title="Annuler la dernière élimination"
            className="text-[10px] font-sans font-medium text-stone-400 hover:text-stone-200 px-2 py-0.5 rounded bg-stone-950 hover:bg-stone-850 border border-stone-800 flex items-center gap-1 transition-colors"
          >
            <Undo2 className="w-3 h-3" />
            <span>Annuler mort</span>
          </button>
        </div>

        {/* Scrollable logs */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-xs">
          {state.logs.length === 0 ? (
            <div className="text-center text-stone-400 italic py-8">
              Aucun événement consigné.
            </div>
          ) : (
            state.logs.map(log => {
              const isDeath = log.type === 'death'
              const isAlert = log.type === 'alert'
              const isPower = log.type === 'power'
              const isTurn = log.type === 'turn'

              return (
                <div
                  key={log.id}
                  className={`p-2 rounded border text-[11px] transition-all ${
                    isDeath
                      ? 'bg-stone-950 border-crimson-900/50 text-rose-300'
                      : isAlert
                        ? 'bg-stone-950 border-brass-700/60 text-brass-300'
                        : isPower
                          ? 'bg-stone-950 border-stone-800 text-stone-200'
                          : isTurn
                            ? 'bg-stone-950 border-stone-750 text-stone-300 font-medium'
                            : 'bg-stone-950 border-stone-850 text-stone-400'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-stone-400 mb-0.5 font-mono">
                    <span className="font-semibold text-stone-400">{log.turnLabel}</span>
                    <span>{log.time}</span>
                  </div>
                  <div className="leading-snug">
                    {/* Clean away emojis if present in old logs */}
                    {log.message.replace(/[\u{1F300}-\u{1F6FF}]/gu, '')}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
