import { Player } from '../../shared/types'

// Fixtures from schéma.jpg: console channel number and position in a 380×330 plan.
const CHANNEL_COLORS: Record<number, string> = { 1: '#E5484D', 2: '#F2D35B', 4: '#6CCB5F', 7: '#C77DE8', 8: '#F07AC0', 10: '#3D74D6' }
const FIXTURES: [number, number, number][] = [
  [20, 12, 7], [130, 12, 1], [230, 12, 1], [336, 12, 7],
  [40, 52, 8], [140, 52, 2], [220, 52, 2], [316, 52, 8],
  [10, 100, 4], [10, 160, 4], [10, 220, 4], [10, 280, 4],
  [346, 100, 10], [346, 160, 10], [346, 220, 10], [346, 280, 10]
]
const MOVING_HEADS: [number, number, number][] = [[150, 96, 6], [204, 96, 12]]

interface RoomPlanProps {
  players: Player[]
  targetSeat?: number
  onTarget: (seat: number) => void
}

/** Room seen from above; clicking a seat aims both moving heads at it. */
export function RoomPlan({ players, targetSeat, onTarget }: RoomPlanProps) {
  const seats = [...players].sort((a, b) => a.seatNumber - b.seatNumber)
  return (
    <div className="relative mx-auto h-[330px] w-full max-w-[380px] rounded-md bg-ink">
      {FIXTURES.map(([x, y, ch], i) => (
        <span key={i} aria-hidden className="absolute flex h-[22px] w-[22px] items-center justify-center rounded text-[11px] font-bold text-ink opacity-80"
          style={{ left: x, top: y, background: CHANNEL_COLORS[ch] }}>{ch}</span>
      ))}
      {MOVING_HEADS.map(([x, y, ch]) => (
        <span key={ch} aria-hidden className="absolute flex h-7 w-7 items-center justify-center rounded-full border-2 border-blood-go text-[11px] font-bold text-blood-text"
          style={{ left: x, top: y }}>{ch}</span>
      ))}
      <div aria-hidden className="absolute left-[110px] top-[175px] h-[100px] w-[160px] rounded-[50%] bg-panel" />
      {seats.map((p, i) => {
        const angle = -Math.PI / 2 + (i / seats.length) * Math.PI * 2
        const x = Math.round(190 + Math.cos(angle) * 112 - 15)
        const y = Math.round(225 + Math.sin(angle) * 72 - 15)
        const aimed = p.seatNumber === targetSeat
        return (
          <button key={p.id} type="button" title={p.name} aria-label={`Viser ${p.name} (siège ${p.seatNumber})`}
            onClick={() => onTarget(p.seatNumber)}
            className={`absolute flex h-[30px] w-[30px] items-center justify-center rounded-full text-[13px] font-bold ${
              aimed ? 'bg-blood-go text-[#FFF6EE] ring-4 ring-blood-go/30' : p.isAlive ? 'bg-tile text-bone' : 'bg-surface text-faint'
            }`}
            style={{ left: x, top: y }}>
            {p.seatNumber}
          </button>
        )
      })}
    </div>
  )
}
