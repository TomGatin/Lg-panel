import { ReactNode } from 'react'
import { ROLES } from '../../shared/roles'
import { getFoxResult, getNightSteps, isPlayerWerewolf, NightStep } from '../../shared/rules'
import { GameState, NightTargetKey, Player } from '../../shared/types'
import { useLive } from '../lib/live'
import { SeatGrid } from '../ui/SeatGrid'
import { PrimaryButton, SecondaryButton, StickyFooter } from './parts'

const nameOf = (game: GameState, id: string | undefined) => game.players.find(p => p.id === id)?.name

export function NightView({ game, onInspect }: { game: GameState; onInspect: (p: Player, context: string) => void }) {
  const dispatch = useLive(s => s.dispatch)
  const steps = getNightSteps(game)
  const index = steps.findIndex(s => !game.night.completedSteps[s.id])
  const step = index === -1 ? undefined : steps[index]

  return (
    <>
      <div className="flex gap-1 px-5 pt-3" aria-hidden>
        {steps.map((s, i) => (
          <span key={s.id} className={`h-1 flex-1 ${i < index || index === -1 ? 'bg-muted' : i === index ? 'bg-blood-go' : 'bg-rule'}`} />
        ))}
      </div>

      {step ? (
        <>
          <section className="engraved mx-4 mt-4 flex flex-col items-center gap-2 px-5 py-6 text-center">
            <h1 className="font-display text-[32px] font-bold leading-tight tracking-[0.06em]">{step.title}</h1>
            <span className="font-serif text-[15px] italic text-blood-text">
              {step.playerIds.length > 0 ? step.playerIds.map(id => nameOf(game, id)).join(', ') : 'personne à toucher'}
            </span>
            <p className="mt-1 font-serif text-[22px] leading-snug">« {step.spokenPrompt} »</p>
            <p className="font-sans text-[14px] text-muted">{step.instructions}</p>
          </section>
          <div className="flex flex-col gap-3 px-4 pt-4">
            <StepControls game={game} step={step} onInspect={onInspect} />
          </div>
          <StickyFooter>
            <SecondaryButton onClick={() => dispatch({ type: 'COMPLETE_NIGHT_STEP', stepId: step.id })}>Passer</SecondaryButton>
            <PrimaryButton onClick={() => dispatch({ type: 'COMPLETE_NIGHT_STEP', stepId: step.id })}>{validateLabel(game, step)}</PrimaryButton>
          </StickyFooter>
        </>
      ) : (
        <>
          <section className="engraved mx-4 mt-4 flex flex-col gap-3 px-5 py-6">
            <h1 className="text-center font-display text-[28px] font-bold tracking-[0.06em]">La nuit s'achève</h1>
            <NightSummary game={game} />
          </section>
          <StickyFooter>
            <PrimaryButton onClick={() => dispatch({ type: 'ADVANCE_TO_DAY' })}>Lever du jour</PrimaryButton>
          </StickyFooter>
        </>
      )}
    </>
  )
}

function validateLabel(game: GameState, step: NightStep): string {
  const n = game.night
  const target: Partial<Record<NightStep['id'], string | undefined>> = {
    salvateur: nameOf(game, n.salvateurTargetId),
    voyante: nameOf(game, n.seerTargetId),
    renard: nameOf(game, n.foxTargetId),
    loups_garous: nameOf(game, n.wolfVictimId),
    grand_mechant_loup: nameOf(game, n.gmlVictimId),
    loup_blanc: nameOf(game, n.whiteWolfTargetId),
    corbeau: nameOf(game, n.corbeauTargetId)
  }
  const took = step.id === 'voleur' ? game.thief?.took : undefined
  const name = took ? ROLES[took].name : target[step.id]
  return name ? `Valider · ${name}` : 'Valider'
}

function NightSummary({ game }: { game: GameState }) {
  const n = game.night
  const lines: [string, string | undefined][] = [
    ['Protégé', nameOf(game, n.salvateurTargetId)],
    ['Victime des loups', nameOf(game, n.wolfVictimId) && `${nameOf(game, n.wolfVictimId)}${n.infectVictim ? ' (infecté)' : ''}${n.witchSavedVictim ? ' (sauvé par la Sorcière)' : ''}`],
    ['Grand Méchant Loup', nameOf(game, n.gmlVictimId)],
    ['Loup Blanc', nameOf(game, n.whiteWolfTargetId)],
    ['Empoisonné', nameOf(game, n.witchKillTargetId)],
    ['Accablé par le Corbeau', nameOf(game, n.corbeauTargetId)],
    ['Blessé par l\'épée', nameOf(game, n.rustyWoundedWolfId)]
  ]
  const shown = lines.filter((l): l is [string, string] => l[1] !== undefined)
  if (shown.length === 0) return <p className="text-center font-serif text-lg italic text-muted">Aucune victime désignée cette nuit.</p>
  return (
    <dl className="flex flex-col gap-1 font-serif text-lg">
      {shown.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 border-b border-rule py-1">
          <dt className="italic text-muted">{k}</dt><dd className="font-semibold">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function Choice({ active, onClick, children, disabled }: { active: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={active}
      className={`min-h-[56px] flex-1 border font-display text-[15px] font-bold tracking-[0.06em] ${active ? 'border-blood bg-blood text-[#F6EFE0]' : 'border-rule text-bone'}`}>
      {children}
    </button>
  )
}

function Notice({ tone = 'info', children }: { tone?: 'info' | 'alert'; children: ReactNode }) {
  return (
    <p className={`border px-4 py-3 font-serif text-[18px] ${tone === 'alert' ? 'border-blood bg-blood-deep text-[#F6EFE0]' : 'border-rule text-bone-dim'}`}>
      {children}
    </p>
  )
}

function StepControls({ game, step, onInspect }: { game: GameState; step: NightStep; onInspect: (p: Player, context: string) => void }) {
  const dispatch = useLive(s => s.dispatch)
  const { players, night } = game
  const setTarget = (key: NightTargetKey, current: string | undefined) => (id: string) =>
    dispatch({ type: 'SET_NIGHT_TARGET', key, playerId: current === id ? undefined : id })
  const isWolf = (p: Player) => isPlayerWerewolf(p, players)
  const touchList = (ids: string[]) => (
    <Notice>{ids.length > 0 ? `À toucher : ${ids.map(id => nameOf(game, id)).join(', ')}` : 'Personne à toucher.'}</Notice>
  )

  switch (step.id) {
    case 'voleur': {
      const thief = game.thief
      if (!thief) return null
      return (
        <div className="flex gap-2">
          <Choice active={!thief.took} onClick={() => dispatch({ type: 'THIEF_SWAP' })}>Garde sa carte</Choice>
          {thief.cards.map((roleId, i) => (
            <Choice key={i} active={thief.took === roleId} onClick={() => dispatch({ type: 'THIEF_SWAP', roleId })}>{ROLES[roleId].name}</Choice>
          ))}
        </div>
      )
    }
    case 'carte_vierge':
      return touchList(step.playerIds)
    case 'cupidon':
      return (
        <SeatGrid players={players} selectedIds={players.filter(p => p.isLover).map(p => p.id)}
          onPick={id => dispatch({ type: 'TOGGLE_LOVER', playerId: id })} />
      )
    case 'amoureux':
    case 'deux_soeurs':
    case 'charmes_reveil':
      return touchList(step.playerIds)
    case 'enfant_sauvage': {
      const child = players.find(p => p.id === step.playerIds[0])
      return (
        <SeatGrid players={players} selectedIds={child?.wildChildModelId ? [child.wildChildModelId] : []}
          disabledReason={p => (p.id === child?.id ? 'lui-même' : undefined)}
          onPick={id => child && dispatch({ type: 'SET_WILD_CHILD_MODEL', childId: child.id, modelId: id })} />
      )
    }
    case 'chien_loup': {
      const dog = players.find(p => p.id === step.playerIds[0])
      if (!dog) return null
      return (
        <div className="flex gap-2">
          <Choice active={dog.dogWolfChoice === 'village'} onClick={() => dispatch({ type: 'SET_DOG_WOLF_CHOICE', playerId: dog.id, choice: 'village' })}>Village</Choice>
          <Choice active={dog.dogWolfChoice === 'loup'} onClick={() => dispatch({ type: 'SET_DOG_WOLF_CHOICE', playerId: dog.id, choice: 'loup' })}>Loup-Garou</Choice>
        </div>
      )
    }
    case 'salvateur':
      return (
        <SeatGrid players={players} selectedIds={night.salvateurTargetId ? [night.salvateurTargetId] : []}
          disabledReason={p => (p.id === night.lastSalvateurTargetId ? 'protégé hier' : undefined)}
          onPick={setTarget('salvateurTargetId', night.salvateurTargetId)} />
      )
    case 'voyante':
      return (
        <SeatGrid players={players} selectedIds={night.seerTargetId ? [night.seerTargetId] : []}
          disabledReason={p => (step.playerIds.includes(p.id) ? 'elle-même' : undefined)}
          onPick={id => {
            if (night.seerTargetId !== id) dispatch({ type: 'SET_NIGHT_TARGET', key: 'seerTargetId', playerId: id })
            const p = players.find(x => x.id === id)
            if (p) onInspect(p, 'vu par la Voyante')
          }} />
      )
    case 'renard': {
      const result = night.foxTargetId ? getFoxResult(night.foxTargetId, players) : null
      return (
        <>
          <SeatGrid players={players} selectedIds={night.foxTargetId ? [night.foxTargetId] : []}
            onPick={setTarget('foxTargetId', night.foxTargetId)} />
          {result && (
            <Notice tone={result.hasWolf ? 'alert' : 'info'}>
              {[result.leftNeighbor, result.target, result.rightNeighbor].filter(Boolean).map(p => p?.name).join(' · ')} :{' '}
              {result.hasWolf ? 'au moins un loup. Le Renard acquiesce.' : 'aucun loup. Le Renard perd son flair.'}
            </Notice>
          )}
        </>
      )
    }
    case 'loups_garous': {
      const father = players.find(p => p.roleId === 'infect_pere_des_loups' && p.isAlive)
      const canInfect = father && !night.infectionUsedThisGame && night.wolfVictimId
      return (
        <>
          <SeatGrid players={players} selectedIds={night.wolfVictimId ? [night.wolfVictimId] : []}
            disabledReason={p => (isWolf(p) ? 'loup' : undefined)}
            note={p => (p.id === night.salvateurTargetId ? 'protégé' : undefined)}
            onPick={setTarget('wolfVictimId', night.wolfVictimId)} />
          {canInfect && (
            <Choice active={night.infectVictim} onClick={() => dispatch({ type: 'SET_INFECT_VICTIM', infect: !night.infectVictim })}>
              {night.infectVictim ? 'Victime infectée' : 'Le Père des Loups infecte ?'}
            </Choice>
          )}
        </>
      )
    }
    case 'grand_mechant_loup':
      return (
        <SeatGrid players={players} selectedIds={night.gmlVictimId ? [night.gmlVictimId] : []}
          disabledReason={p => (isWolf(p) ? 'loup' : p.id === night.wolfVictimId ? 'déjà visé' : undefined)}
          onPick={setTarget('gmlVictimId', night.gmlVictimId)} />
      )
    case 'loup_blanc':
      return (
        <SeatGrid players={players} selectedIds={night.whiteWolfTargetId ? [night.whiteWolfTargetId] : []}
          disabledReason={p => (!isWolf(p) || p.roleId === 'loup_blanc' ? 'pas un loup' : undefined)}
          onPick={setTarget('whiteWolfTargetId', night.whiteWolfTargetId)} />
      )
    case 'sorciere': {
      const victim = nameOf(game, night.wolfVictimId)
      return (
        <>
          <Notice tone={victim ? 'alert' : 'info'}>
            {victim ? `Victime des loups : ${victim}${night.infectVictim ? ' (infectée, elle ne mourra pas)' : ''}` : 'Les loups n\'ont désigné personne.'}
          </Notice>
          <div className="flex gap-2">
            <Choice active={night.witchSavedVictim} disabled={night.witchHealUsed || !victim}
              onClick={() => dispatch({ type: 'SET_WITCH_HEAL', saved: !night.witchSavedVictim })}>
              {night.witchHealUsed ? 'Vie déjà utilisée' : 'Potion de vie'}
            </Choice>
          </div>
          <span className="label-caps">{night.witchKillUsed ? 'Potion de mort déjà utilisée' : 'Potion de mort'}</span>
          {!night.witchKillUsed && (
            <SeatGrid players={players} selectedIds={night.witchKillTargetId ? [night.witchKillTargetId] : []}
              onPick={setTarget('witchKillTargetId', night.witchKillTargetId)} />
          )}
        </>
      )
    }
    case 'corbeau':
      return (
        <SeatGrid players={players} selectedIds={night.corbeauTargetId ? [night.corbeauTargetId] : []}
          onPick={setTarget('corbeauTargetId', night.corbeauTargetId)} />
      )
    case 'joueur_de_flute':
      return (
        <SeatGrid players={players} selectedIds={night.charmedTonightIds}
          disabledReason={p => p.roleId === 'joueur_de_flute' ? 'lui-même' : p.isCharmed && !night.charmedTonightIds.includes(p.id) ? 'déjà charmé' : undefined}
          onPick={id => dispatch({ type: 'TOGGLE_CHARMED_TONIGHT', playerId: id })} />
      )
  }
}
