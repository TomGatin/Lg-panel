import { useEffect, useState } from 'react'
import { ShowAudio } from '../../shared/types'
import { audioEngine } from './audio'
import { onAudio } from './live'

/**
 * Plays the show's sound on this device while `audio` is set (this device is the chosen output).
 * Ambience and volumes follow the server state, so a reload picks the loop back up once unlocked.
 */
export function useShowAudio(audio: ShowAudio | undefined): { ready: boolean; unlock: () => Promise<void> } {
  const [ready, setReady] = useState(audioEngine.unlocked)
  const active = audio !== undefined
  const ambience = audio?.ambience ?? 'none'
  const master = audio?.volumes.master
  const ambienceVolume = audio?.volumes.ambience

  useEffect(() => audioEngine.onChange(() => setReady(audioEngine.unlocked)), [])

  useEffect(() => {
    if (!active) return
    return onAudio(sfx => (sfx ? void audioEngine.playSfx(sfx) : audioEngine.stopSfx()))
  }, [active])

  useEffect(() => {
    if (ready) void audioEngine.setAmbience(ambience)
  }, [ready, ambience])

  useEffect(() => {
    if (!ready) return
    if (master !== undefined) audioEngine.setMasterVolume(master)
    if (ambienceVolume !== undefined) audioEngine.setAmbienceVolume(ambienceVolume)
  }, [ready, master, ambienceVolume])

  return { ready, unlock: () => audioEngine.unlock().then(() => setReady(audioEngine.unlocked)) }
}
