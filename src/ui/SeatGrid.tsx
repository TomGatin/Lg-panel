import { Player } from '../../shared/types'

interface SeatGridProps {
  players: Player[]
  selectedIds?: string[]
  onPick: (id: string) => void
  /** Returns a short reason when a seat cannot be picked (it is then shown but disabled). */
  disabledReason?: (p: Player) => string | undefined
  /** Extra line under the name (e.g. "charmé", "protégé hier"). */
  note?: (p: Player) => string | undefined
}

/** Table seats as big touch targets, in seat order: the MJ's main input. */
export function SeatGrid({ players, selectedIds = [], onPick, disabledReason, note }: SeatGridProps) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {[...players].sort((a, b) => a.seatNumber - b.seatNumber).map(p => {
        const selected = selectedIds.includes(p.id)
        const reason = !p.isAlive ? 'mort' : disabledReason?.(p)
        const sub = reason ?? note?.(p)
        return (
          <button
            key={p.id}
            type="button"
            disabled={reason !== undefined}
            onClick={() => onPick(p.id)}
            aria-pressed={selected}
            className={`flex min-h-[66px] flex-col items-center justify-center px-1 font-serif transition-colors ${
              selected
                ? 'border border-blood bg-blood-deep text-[#F6EFE0] shadow-[inset_0_0_0_1px_#9E2B25]'
                : !p.isAlive
                  ? 'border border-dashed border-rule text-faint line-through !opacity-100'
                  : 'border border-rule bg-surface text-bone active:bg-tile'
            }`}
          >
            <span className={`font-display text-[13px] font-bold ${selected ? 'text-blood-text' : 'text-muted'}`}>{p.seatNumber}</span>
            <span className="max-w-full truncate text-[17px] font-semibold leading-tight">{p.name}</span>
            {sub && <span className="text-xs italic text-muted no-underline">{sub}</span>}
          </button>
        )
      })}
    </div>
  )
}
