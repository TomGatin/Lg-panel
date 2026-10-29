import { useEffect, useState } from 'react'
import { GameTimer } from '../../shared/types'
import { useLive } from './live'

export function remainingSeconds(timer: GameTimer, now: number): number {
  if (timer.endsAt !== null) return Math.max(0, Math.ceil((timer.endsAt - now) / 1000))
  return timer.pausedRemaining ?? timer.durationSeconds
}

/** Seconds left on the shared timer, read with the server's clock. */
export function useRemaining(timer: GameTimer | undefined): number {
  const offset = useLive(s => s.clockOffset)
  const [now, setNow] = useState(() => Date.now())
  const running = timer?.endsAt !== null && timer !== undefined
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [running])
  return timer ? remainingSeconds(timer, now + offset) : 0
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
