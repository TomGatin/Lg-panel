import React from 'react'
import { GameProvider, useGame } from './context/GameContext'
import { Header } from './components/Header'
import { SetupScreen } from './components/SetupScreen'
import { Dashboard } from './components/Dashboard'

const AppContent: React.FC = () => {
  const { state } = useGame()

  return (
    <div className="min-h-screen flex flex-col bg-stone-950 text-stone-200">
      <Header />
      <main className="flex-1">
        {state.phase === 'setup' ? <SetupScreen /> : <Dashboard />}
      </main>
    </div>
  )
}

export function App() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  )
}

export default App
