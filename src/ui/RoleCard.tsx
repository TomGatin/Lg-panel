import { useState } from 'react'
import { ROLES } from '../../shared/roles'
import { RoleId } from '../../shared/types'

export const CARD_EXTENSIONS = ['png', 'webp']

/** Scan of the physical card from public/cards/<roleId>.png (or .webp), or an engraved placeholder. */
export function RoleCard({ roleId, className = '' }: { roleId: RoleId; className?: string }) {
  const [attempt, setAttempt] = useState(0)
  const name = ROLES[roleId].name
  if (attempt < CARD_EXTENSIONS.length) {
    return (
      <img
        src={`/cards/${roleId}.${CARD_EXTENSIONS[attempt]}`}
        alt={`Carte ${name}`}
        onError={() => setAttempt(attempt + 1)}
        className={`h-full w-full object-contain ${className}`}
      />
    )
  }
  return (
    <div className={`engraved flex h-full w-full flex-col items-center justify-center gap-3 bg-ink ${className}`}>
      <span className="font-display text-[96px] font-bold leading-none text-blood-text">{name.charAt(0)}</span>
      <span className="font-serif text-base italic text-muted">[scan de la carte {name}]</span>
    </div>
  )
}
