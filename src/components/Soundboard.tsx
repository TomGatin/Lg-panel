import React, { useState } from 'react'
import { soundboard } from '../utils/audio'
import { Volume2, Crosshair, Music, Sun, Flame, Moon } from 'lucide-react'

export const Soundboard: React.FC = () => {
  const [activeSound, setActiveSound] = useState<string | null>(null)

  const play = (name: string, fn: () => void) => {
    setActiveSound(name)
    try {
      fn()
    } catch (e) {
      console.error(e)
    }
    setTimeout(() => {
      setActiveSound(prev => prev === name ? null : prev)
    }, 1200)
  }

  const buttons = [
    { id: 'night', label: 'Nuit', icon: Moon, fn: () => soundboard.playNight() },
    { id: 'wolf', label: 'Hurlement', icon: Volume2, fn: () => soundboard.playWolfHowl() },
    { id: 'bear', label: 'Ours', icon: Flame, fn: () => soundboard.playBearGrowl() },
    { id: 'rooster', label: 'Aube', icon: Sun, fn: () => soundboard.playRoosterCrow() },
    { id: 'flute', label: 'Flûte', icon: Music, fn: () => soundboard.playFluteTune() },
    { id: 'gun', label: 'Fusil', icon: Crosshair, fn: () => soundboard.playGunshot() },
  ]

  return (
    <div className="bg-stone-900 rounded-lg border border-stone-800 p-3.5 shadow-md">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-[11px] font-serif font-bold uppercase tracking-wider text-stone-300 flex items-center gap-1.5">
          <Volume2 className="w-3.5 h-3.5 text-brass-400" />
          <span>Effets d'Ambiance</span>
        </h3>
        <span className="text-[10px] text-stone-400 tracking-wider uppercase font-mono">Audio Web</span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        {buttons.map(b => {
          const Icon = b.icon
          const isActive = activeSound === b.id
          return (
            <button
              key={b.id}
              onClick={() => play(b.id, b.fn)}
              className={`flex flex-col items-center justify-center p-2 rounded border transition-all text-xs ${
                isActive
                  ? 'bg-brass-900/60 border-brass-500 text-brass-200 shadow-inner'
                  : 'bg-stone-950 border-stone-800 text-stone-300 hover:text-stone-100 hover:border-stone-700 hover:bg-stone-850'
              }`}
            >
              <Icon className={`w-4 h-4 mb-1 ${isActive ? 'text-brass-400' : 'text-stone-400'}`} />
              <span className="truncate max-w-full text-[10px] font-medium tracking-tight">{b.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
