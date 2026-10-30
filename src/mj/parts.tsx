import { Moon, Sun, Undo2, Users, X } from 'lucide-react'
import { ReactNode, useState } from 'react'
import { ROLES } from '../../shared/roles'
import { isPlayerWerewolf } from '../../shared/rules'
import { GameState, Player } from '../../shared/types'
import { useLive } from '../lib/live'
import { ConnectionBadge } from '../ui/Feedback'
import { RoleCard } from '../ui/RoleCard'
import { SeatGrid } from '../ui/SeatGrid'

const TEAM_LABEL = { village: 'Camp du village', loups: 'Camp des loups', solitaire: 'Solitaire', ambigu: 'Camp ambigu' } as const

export function effectiveCamp(p: Player, players: Player[]): string {
  if (isPlayerWerewolf(p, players)) return TEAM_LABEL.loups
  return TEAM_LABEL[ROLES[p.roleId].team]
}

export function MjHeader({ game, subtitle, right, onVillage }: { game: GameState; subtitle: ReactNode; right?: ReactNode; onVillage: () => void }) {
  const undo = useLive(s => s.undo)
  const canUndo = useLive(s => s.staff?.canUndo ?? false)
  const Icon = game.cycle === 'night' ? Moon : Sun
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-rule bg-ink/95 py-3 pl-5 pr-3 backdrop-blur">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2 font-display text-[22px] font-bold tracking-[0.06em]">
          <Icon size={18} className={game.cycle === 'night' ? 'text-muted' : 'text-blood-text'} aria-hidden />
          {game.cycle === 'night' ? 'Nuit' : 'Jour'} {game.roundNumber}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 font-serif text-[15px] italic text-muted"><span className="whitespace-nowrap">{subtitle}</span><ConnectionBadge /></span>
      </div>
      {right}
      <button type="button" aria-label="Voir le village" onClick={onVillage}
        className="flex h-12 w-12 items-center justify-center border border-rule text-bone"><Users size={20} /></button>
      <button type="button" aria-label="Annuler la dernière action" onClick={undo} disabled={!canUndo}
        className="flex h-12 w-12 items-center justify-center border border-rule text-bone"><Undo2 size={20} /></button>
    </header>
  )
}

export function StickyFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="sticky bottom-0 z-10 mt-auto flex gap-2 border-t border-rule bg-ink px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3">
      {children}
    </footer>
  )
}

export function PrimaryButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="min-h-[56px] flex-[2] bg-blood px-3 font-display text-[16px] font-bold tracking-[0.06em] text-[#F6EFE0] active:bg-blood-go">
      {children}
    </button>
  )
}

export function SecondaryButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="min-h-[56px] flex-1 border border-rule px-3 font-display text-[15px] font-bold tracking-[0.06em] text-bone active:bg-surface">
      {children}
    </button>
  )
}

/** Full-screen, high-contrast card for the Seer or any inspection. */
export function CardReveal({ player, players, onClose, context }: { player: Player; players: Player[]; onClose: () => void; context?: string }) {
  const role = ROLES[player.roleId]
  return (
    <div role="dialog" aria-modal="true" aria-label={`Carte de ${player.name}`}
      className="fixed inset-0 z-40 flex flex-col gap-4 bg-black px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-6">
      <div className="flex items-baseline justify-between">
        <span className="label-caps">Siège {player.seatNumber} · {player.name}</span>
        {context && <span className="font-serif text-[15px] italic text-muted">{context}</span>}
      </div>
      <div className="min-h-0 flex-1"><RoleCard roleId={player.roleId} /></div>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="font-display text-4xl font-bold tracking-[0.06em]">{role.name}</h1>
        <span className="bg-blood px-5 py-2 font-display text-base font-bold tracking-[0.14em] text-[#F6EFE0]">{effectiveCamp(player, players)}</span>
        {player.isInfected && <span className="font-serif text-lg italic text-blood-text">Infecté : joue désormais avec les loups</span>}
      </div>
      <button type="button" onClick={onClose} className="min-h-[60px] border border-rule bg-surface font-display text-base font-bold tracking-[0.1em]">Refermer</button>
    </div>
  )
}

/** Bottom sheet listing seats to pick from (accuse, elect, shoot…). */
export function PickerSheet({ title, players, onPick, onClose, prompt, disabledReason }: {
  title: string
  players: Player[]
  onPick: (id: string) => void
  onClose?: () => void
  prompt?: string
  disabledReason?: (p: Player) => string | undefined
}) {
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-30 flex flex-col justify-end bg-black/70">
      <div className="flex max-h-[90vh] flex-col gap-3 overflow-y-auto border-t border-rule bg-ink p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold tracking-[0.06em]">{title}</h2>
          {onClose && (
            <button type="button" aria-label="Fermer" onClick={onClose} className="flex h-12 w-12 items-center justify-center border border-rule"><X size={20} /></button>
          )}
        </div>
        {prompt && <p className="font-serif text-xl leading-snug">{prompt}</p>}
        <SeatGrid players={players} onPick={onPick} disabledReason={disabledReason} />
      </div>
    </div>
  )
}

/** The whole village with secrets, for checks and manual corrections. */
export function VillageSheet({ game, onClose, onInspect }: { game: GameState; onClose: () => void; onInspect: (p: Player) => void }) {
  const dispatch = useLive(s => s.dispatch)
  const [armed, setArmed] = useState<string | null>(null)
  const [tab, setTab] = useState<'players' | 'log'>('players')
  return (
    <div role="dialog" aria-modal="true" aria-label="Le village" className="fixed inset-0 z-30 flex flex-col bg-ink">
      <div className="flex items-center gap-2 border-b border-rule py-3 pl-5 pr-3">
        <h2 className="flex-1 font-display text-xl font-bold tracking-[0.06em]">Le village</h2>
        {(['players', 'log'] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)} aria-pressed={tab === t}
            className={`min-h-[48px] border px-3 font-display text-[14px] font-bold tracking-[0.06em] ${tab === t ? 'border-blood bg-blood text-[#F6EFE0]' : 'border-rule text-bone'}`}>
            {t === 'players' ? 'Joueurs' : 'Journal'}
          </button>
        ))}
        <button type="button" aria-label="Fermer" onClick={onClose} className="flex h-12 w-12 items-center justify-center border border-rule"><X size={20} /></button>
      </div>
      {tab === 'log' ? (
        <ol className="flex-1 overflow-y-auto px-4 py-2">
          {game.logs.map(l => (
            <li key={l.id} className={`flex gap-3 border-b border-rule py-2 font-serif text-[16px] leading-snug ${l.type === 'death' || l.type === 'alert' ? 'text-blood-text' : ''}`}>
              <span className="w-14 shrink-0 font-sans text-[13px] text-muted">{l.turnLabel}</span>
              <span>{l.message}</span>
            </li>
          ))}
        </ol>
      ) : (
      <ul className="flex-1 overflow-y-auto">
        {game.players.map(p => {
          const tags = [
            p.isCaptain && 'Capitaine',
            p.isLover && 'Amoureux',
            p.isCharmed && 'Charmé',
            p.isInfected && 'Infecté',
            p.idiotRevealed && 'Idiot révélé, ne vote plus',
            p.roleId === 'ancien' && p.isAlive && `${p.elderLives} vie(s)`,
            p.roleId === 'renard' && p.foxLostPower && 'Flair perdu',
            p.dogWolfChoice && `Camp ${p.dogWolfChoice === 'loup' ? 'loup' : 'village'}`,
            !p.isAlive && `Mort · ${p.deathRound ?? ''}`
          ].filter((t): t is string => typeof t === 'string')
          return (
            <li key={p.id} className="flex items-center gap-2 border-b border-rule px-4 py-2">
              <button type="button" onClick={() => onInspect(p)} className={`flex min-h-[52px] flex-1 items-center gap-3 text-left ${p.isAlive ? '' : 'opacity-50'}`}>
                <span className="w-6 font-display text-sm font-bold text-muted">{p.seatNumber}</span>
                <span className="flex flex-col">
                  <span className={`font-serif text-lg font-semibold ${p.isAlive ? '' : 'line-through'}`}>{p.name}</span>
                  <span className="font-serif text-[15px] italic text-muted">{ROLES[p.roleId].name}{tags.length > 0 && ` · ${tags.join(' · ')}`}</span>
                </span>
              </button>
              <button type="button"
                onClick={() => {
                  if (armed !== p.id) return setArmed(p.id)
                  dispatch({ type: 'TOGGLE_LIFE', playerId: p.id })
                  setArmed(null)
                }}
                className={`min-h-[44px] min-w-[96px] border px-2 font-sans text-[14px] font-semibold ${armed === p.id ? 'border-blood bg-blood text-[#F6EFE0]' : 'border-rule text-bone-dim'}`}>
                {armed === p.id ? 'Confirmer ?' : p.isAlive ? 'Éliminer' : 'Ranimer'}
              </button>
            </li>
          )
        })}
      </ul>
      )}
    </div>
  )
}

/** Blocking prompts the rules impose before the game can go on. */
export function PendingPrompts({ game }: { game: GameState }) {
  const dispatch = useLive(s => s.dispatch)
  const alive = game.players.filter(p => p.isAlive)
  const hunter = game.players.find(p => p.id === game.pendingHunterShotPlayerId)
  if (hunter) {
    return (
      <PickerSheet title="Le Chasseur tire" players={alive}
        prompt={`« ${hunter.name}, avant de mourir, tu emportes quelqu'un avec toi. Qui vises-tu ? »`}
        onPick={id => dispatch({ type: 'EXECUTE_HUNTER_SHOT', targetPlayerId: id })} />
    )
  }
  if (game.pendingCaptainSuccessor && game.phase === 'playing') {
    return (
      <PickerSheet title="Succession du Capitaine" players={alive}
        prompt="« Capitaine, avant de partir, désigne ton successeur. »"
        onPick={id => dispatch({ type: 'ASSIGN_CAPTAIN_SUCCESSOR', newCaptainId: id })} />
    )
  }
  return null
}
