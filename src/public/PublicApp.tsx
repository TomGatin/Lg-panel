import { useEffect } from 'react'
import { reportAudioReady, useLive } from '../lib/live'
import { useShowAudio } from '../lib/useShowAudio'
import { Loading } from '../ui/Feedback'
import { useWakeLock } from '../ui/useWakeLock'
import { Screen } from './screens'

/** TV browsers lag behind: prefixed API, sometimes no promise, sometimes nothing at all. */
function enterFullscreen() {
  const doc = document as Document & { webkitFullscreenElement?: Element }
  if (doc.fullscreenElement || doc.webkitFullscreenElement) return
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void }
  try {
    const result = el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen?.()
    if (result) result.catch(() => undefined)
  } catch {
    // Not allowed here: the browser's own full-screen mode is the fallback.
  }
}

export function PublicApp() {
  const view = useLive(s => s.view)
  const audio = useShowAudio(view?.audio)
  const { unlock } = audio
  useWakeLock()
  useEffect(() => reportAudioReady(audio.ready), [audio.ready])
  useEffect(() => { void unlock() }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.keyCode !== 13) return
      enterFullscreen()
      void unlock()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  if (!view) return <Loading label="Connexion à la partie…" />
  return (
    <div className="fixed left-0 top-0 h-full w-full cursor-none overflow-hidden bg-ink text-bone [container-type:size]"
      onClick={() => { enterFullscreen(); void unlock() }}>
      <div key={`${view.screen}-${view.roundNumber}-${view.cycle}`} className="h-full animate-[fadein_1.2s_ease-out]">
        <Screen view={view} />
      </div>
      {view.audio && !audio.ready && (
        <span className="absolute bottom-[3vmin] right-[4vmin] font-display text-[2vmin] uppercase tracking-[0.2em] text-faint">
          Appuyez sur OK pour activer le son
        </span>
      )}
    </div>
  )
}
