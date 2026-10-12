import React from 'react'
import { useGame } from '../context/GameContext'
import { VillageCircle } from './VillageCircle'
import { NightGuide } from './NightGuide'
import { DayGuide } from './DayGuide'
import { Soundboard } from './Soundboard'
import { GameLog } from './GameLog'

export const Dashboard: React.FC = () => {
  const { state } = useGame()

  return (
    <div className="w-full px-2 sm:px-6 py-4 flex flex-col lg:h-[calc(100vh-60px)] lg:overflow-hidden">
      {/* Soundboard Bar across top for immediate access */}
      <div className="shrink-0 mb-4">
        <Soundboard />
      </div>

      {/* Main Composition */}
      <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:min-h-0 overflow-y-auto lg:overflow-hidden pb-10 lg:pb-0">
        
        {/* Night/Day Guide (Mobile: Top, Desktop: Top-Left) */}
        <div className="order-1 lg:col-span-6 lg:flex lg:flex-col lg:min-h-0 lg:overflow-y-auto custom-scrollbar">
          {state.cycle === 'night' ? <NightGuide /> : <DayGuide />}
        </div>

        {/* Village Circle (Mobile: Middle, Desktop: Right) */}
        <div className="order-2 lg:col-span-6 lg:row-span-2 lg:flex lg:flex-col lg:min-h-0">
          <VillageCircle />
        </div>

        {/* GameLog (Mobile: Bottom, Desktop: Bottom-Left) */}
        <div className="order-3 lg:col-span-6 h-80 lg:h-64 shrink-0 overflow-hidden">
          <GameLog />
        </div>
        
      </div>
    </div>
  )
}
