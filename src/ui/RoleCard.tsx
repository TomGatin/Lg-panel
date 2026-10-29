import { useState } from 'react'
import { ROLES } from '../../shared/roles'
import { RoleId } from '../../shared/types'

/** Scan of the physical card from public/cards/<roleId>.jpg, or an engraved placeholder. */
export function RoleCard({ roleId, className = '' }: { roleId: RoleId; className?: string }) {
  const [missing, setMissing] = useState(false)
  const name = ROLES[roleId].name
  if (!missing) {
    return (
      <img
        src={`/cards/${roleId}.jpg`}
        alt={`Carte ${name}`}
        onError={() => setMissing(true)}
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
