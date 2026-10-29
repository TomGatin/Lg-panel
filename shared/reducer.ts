import { ROLES } from './roles'
import { checkVictory, getFoxResult, getRustySwordTarget, getBearGrowlStatus, isPlayerWerewolf, turnLabel } from './rules'
import { ActionContext, DeathReason, GameAction, GameState, LogEntry, NightState, NightTargetKey, Player, VoteState } from './types'

/** Thrown when an action is not allowed by the rules; the server rejects it and the state is unchanged. */
export class RuleError extends Error {}

const DEFAULT_DEBATE_SECONDS = 180

const freshNight = (): NightState => ({
  completedSteps: {},
  infectVictim: false,
  infectionUsedThisGame: false,
  witchHealUsed: false,
  witchKillUsed: false,
  witchSavedVictim: false,
  charmedTonightIds: []
})

const emptyVote = (): VoteState => ({ accusedIds: [], votes: {}, corbeauBonus: {} })

export const initialGameState: GameState = {
  phase: 'setup',
  cycle: 'night',
  roundNumber: 1,
  players: [],
  night: freshNight(),
  logs: [],
  timer: { durationSeconds: DEFAULT_DEBATE_SECONDS, endsAt: null, pausedRemaining: null },
  vote: emptyVote(),
  villagePowersDisabled: false,
  pendingCaptainSuccessor: false,
  angelWon: false,
  lastDeathIds: [],
  dawnDeathIds: []
}

const DEATH_MESSAGES: Record<DeathReason, (name: string, role: string) => string> = {
  loups: (n, r) => `${n} (${r}) a été dévoré par les loups.`,
  gml: (n, r) => `${n} (${r}) a été dévoré par le Grand Méchant Loup.`,
  sorciere: (n, r) => `${n} (${r}) a succombé au poison de la Sorcière.`,
  vote: (n, r) => `${n} (${r}) a été condamné par le village.`,
  chasseur: (n, r) => `${n} (${r}) a été abattu par le Chasseur.`,
  chagrin: (n, r) => `${n} (${r}) meurt de chagrin après la perte de sa moitié.`,
  loup_blanc: (n, r) => `${n} (${r}) a été égorgé par le Loup-Garou Blanc.`,
  epee_rouillee: (n, r) => `${n} (${r}) succombe à la blessure de l'épée rouillée.`,
  autre: (n, r) => `${n} (${r}) a été éliminé par le MJ.`
}

interface Draft {
  state: GameState
  log: (message: string, type: LogEntry['type'], label?: string) => void
}

function findPlayer(state: GameState, id: string | undefined): Player | undefined {
  return id === undefined ? undefined : state.players.find(p => p.id === id)
}

function requireAlive(state: GameState, id: string): Player {
  const p = findPlayer(state, id)
  if (!p) throw new RuleError('Joueur inconnu.')
  if (!p.isAlive) throw new RuleError(`${p.name} est déjà mort.`)
  return p
}

function requireCycle(state: GameState, cycle: GameState['cycle']): void {
  if (state.phase !== 'playing') throw new RuleError('Aucune partie en cours.')
  if (state.cycle !== cycle) throw new RuleError(cycle === 'night' ? 'Action réservée à la nuit.' : 'Action réservée au jour.')
}

// Every death goes through here so hunter, captain, lovers and special roles cascade the same way.
function kill({ state, log }: Draft, playerId: string, reason: DeathReason): void {
  const p = findPlayer(state, playerId)
  if (!p || !p.isAlive) return
  p.isAlive = false
  p.deathReason = reason
  p.deathRound = turnLabel(state)
  log(DEATH_MESSAGES[reason](p.name, ROLES[p.roleId].name), 'death')

  if (p.roleId === 'chasseur' && !state.villagePowersDisabled) {
    state.pendingHunterShotPlayerId = p.id
    log(`Le Chasseur (${p.name}) doit tirer avant de quitter la partie.`, 'alert')
  }
  if (p.isCaptain) {
    p.isCaptain = false
    state.pendingCaptainSuccessor = true
    log(`Le Capitaine (${p.name}) doit désigner son successeur.`, 'alert')
  }
  if (p.roleId === 'ange' && reason === 'vote' && state.cycle === 'day' && state.roundNumber === 1) {
    state.angelWon = true
    log(`L'Ange (${p.name}) a été condamné au premier vote : il gagne la partie.`, 'alert')
  }
  if (p.roleId === 'ancien' && reason === 'vote') {
    state.villagePowersDisabled = true
    log('Le village a condamné l\'Ancien : tous les villageois perdent leurs pouvoirs.', 'alert')
  }
  for (const child of state.players) {
    if (child.roleId === 'enfant_sauvage' && child.isAlive && child.wildChildModelId === p.id) {
      log(`Le modèle de ${child.name} (Enfant Sauvage) est mort : il rejoint la meute.`, 'alert')
    }
  }
  if (p.isLover) {
    for (const other of state.players) {
      if (other.isLover && other.isAlive) kill({ state, log }, other.id, 'chagrin')
    }
  }
}

function resolveDawn(draft: Draft): void {
  const { state, log } = draft
  const night = state.night
  const label = `Nuit ${state.roundNumber}`
  const protectedId = night.salvateurTargetId

  if (night.rustyWoundedWolfId) {
    kill(draft, night.rustyWoundedWolfId, 'epee_rouillee')
  }

  const victim = findPlayer(state, night.wolfVictimId)
  let rustyWound: string | undefined
  if (victim && victim.isAlive) {
    if (protectedId === victim.id) {
      log(`Le Salvateur a protégé ${victim.name} de l'attaque des loups.`, 'power', label)
    } else if (night.infectVictim) {
      victim.isInfected = true
      log(`${victim.name} a été secrètement infecté par le Père des Loups.`, 'power', label)
    } else if (night.witchSavedVictim) {
      log(`La Sorcière a sauvé ${victim.name} avec sa potion de vie.`, 'power', label)
    } else if (victim.roleId === 'ancien' && victim.elderLives > 1) {
      victim.elderLives -= 1
      log(`L'Ancien (${victim.name}) résiste à l'attaque des loups.`, 'alert', label)
    } else {
      kill(draft, victim.id, 'loups')
      if (victim.roleId === 'chevalier_epee_rouillee' && !state.villagePowersDisabled) {
        const wolf = getRustySwordTarget(state.players)
        if (wolf) {
          rustyWound = wolf.id
          log(`L'épée rouillée du Chevalier a blessé ${wolf.name} : il mourra la nuit prochaine.`, 'alert', label)
        }
      }
    }
  }

  const gmlVictim = findPlayer(state, night.gmlVictimId)
  if (gmlVictim && gmlVictim.isAlive) {
    if (protectedId === gmlVictim.id) {
      log(`Le Salvateur a protégé ${gmlVictim.name} du Grand Méchant Loup.`, 'power', label)
    } else {
      kill(draft, gmlVictim.id, 'gml')
    }
  }
  if (night.witchKillTargetId) kill(draft, night.witchKillTargetId, 'sorciere')
  if (night.whiteWolfTargetId) kill(draft, night.whiteWolfTargetId, 'loup_blanc')

  const corbeauTarget = findPlayer(state, night.corbeauTargetId)
  state.vote = emptyVote()
  if (corbeauTarget && corbeauTarget.isAlive) {
    state.vote = { accusedIds: [corbeauTarget.id], votes: { [corbeauTarget.id]: 2 }, corbeauBonus: { [corbeauTarget.id]: 2 } }
    log(`Le Corbeau accable ${corbeauTarget.name} : il commence le vote avec 2 voix.`, 'power', label)
  }

  state.night = {
    ...freshNight(),
    infectionUsedThisGame: night.infectionUsedThisGame || night.infectVictim,
    witchHealUsed: night.witchHealUsed || night.witchSavedVictim,
    witchKillUsed: night.witchKillUsed || night.witchKillTargetId !== undefined,
    lastSalvateurTargetId: night.salvateurTargetId,
    rustyWoundedWolfId: rustyWound
  }
  state.cycle = 'day'
  state.timer = { durationSeconds: state.timer.durationSeconds, endsAt: null, pausedRemaining: null }
  log('L\'aube se lève sur Thiercelieux. Le village se réveille.', 'turn')

  const bear = getBearGrowlStatus(state.players)
  if (bear && !state.villagePowersDisabled) {
    log(bear.growls ? 'L\'ours grogne ce matin : un loup est assis à côté du montreur.' : 'L\'ours reste paisible ce matin.',
      bear.growls ? 'alert' : 'info')
  }
}

function completeNightStep({ state, log }: Draft, stepId: string): void {
  const night = state.night
  if (stepId === 'voyante') {
    const target = findPlayer(state, night.seerTargetId)
    if (target) log(`La Voyante a sondé ${target.name} : ${ROLES[target.roleId].name}.`, 'power')
  }
  if (stepId === 'renard' && night.foxTargetId) {
    const result = getFoxResult(night.foxTargetId, state.players)
    const fox = state.players.find(p => p.roleId === 'renard')
    if (result && fox) {
      if (result.hasWolf) {
        log(`Le Renard flaire ${result.target.name} et ses voisins : au moins un loup.`, 'power')
      } else {
        fox.foxLostPower = true
        log(`Le Renard flaire ${result.target.name} et ses voisins : aucun loup. Il perd son flair.`, 'power')
      }
    }
  }
  if (stepId === 'salvateur') {
    const target = findPlayer(state, night.salvateurTargetId)
    if (target) log(`Le Salvateur protège ${target.name} cette nuit.`, 'power')
  }
  night.completedSteps[stepId] = true
}

function setNightTarget(state: GameState, key: NightTargetKey, playerId: string | undefined): void {
  requireCycle(state, 'night')
  const night = state.night
  if (playerId !== undefined) {
    requireAlive(state, playerId)
    if (key === 'salvateurTargetId' && playerId === night.lastSalvateurTargetId) {
      throw new RuleError('Le Salvateur ne peut pas protéger la même personne deux nuits de suite.')
    }
    if (key === 'whiteWolfTargetId') {
      const target = requireAlive(state, playerId)
      if (!isPlayerWerewolf(target, state.players) || target.roleId === 'loup_blanc') {
        throw new RuleError('Le Loup-Garou Blanc ne peut dévorer qu\'un autre loup.')
      }
    }
    if (key === 'witchKillTargetId' && night.witchKillUsed) {
      throw new RuleError('La potion de mort a déjà été utilisée.')
    }
  }
  night[key] = playerId
  if (key === 'wolfVictimId' && playerId === undefined) {
    night.infectVictim = false
    night.witchSavedVictim = false
  }
}

function applyTimer(state: GameState, action: GameAction, now: number): void {
  const t = state.timer
  switch (action.type) {
    case 'START_TIMER': {
      const seconds = t.pausedRemaining ?? action.durationSeconds ?? t.durationSeconds
      if (action.durationSeconds !== undefined) t.durationSeconds = action.durationSeconds
      t.endsAt = now + seconds * 1000
      t.pausedRemaining = null
      return
    }
    case 'PAUSE_TIMER':
      if (t.endsAt !== null) {
        t.pausedRemaining = Math.max(0, Math.ceil((t.endsAt - now) / 1000))
        t.endsAt = null
      }
      return
    case 'RESET_TIMER':
      if (action.durationSeconds !== undefined) t.durationSeconds = action.durationSeconds
      t.endsAt = null
      t.pausedRemaining = null
      return
    default:
      return
  }
}

function apply(draft: Draft, action: GameAction, ctx: ActionContext): void {
  const { state, log } = draft
  switch (action.type) {
    case 'SETUP_GAME': {
      if (state.phase !== 'setup') throw new RuleError('Une partie est déjà en cours.')
      if (action.players.length < 3) throw new RuleError('Il faut au moins 3 joueurs.')
      const seats = new Set(action.players.map(p => p.seatNumber))
      if (seats.size !== action.players.length) throw new RuleError('Deux joueurs ont le même siège.')
      state.players = action.players
        .slice()
        .sort((a, b) => a.seatNumber - b.seatNumber)
        .map(p => ({
          id: `p${p.seatNumber}`,
          name: p.name.trim() || `Joueur ${p.seatNumber}`,
          seatNumber: p.seatNumber,
          roleId: p.roleId,
          isAlive: true,
          isLover: false,
          isCharmed: false,
          isInfected: false,
          isCaptain: false,
          elderLives: p.roleId === 'ancien' ? 2 : 0,
          foxLostPower: false
        }))
      state.phase = 'playing'
      state.cycle = 'night'
      state.roundNumber = 1
      log(`Partie ouverte avec ${state.players.length} joueurs. Thiercelieux s'endort pour la Nuit 1.`, 'turn', 'Ouverture')
      return
    }
    case 'RESET_GAME':
      return
    case 'TOGGLE_LIFE': {
      const p = findPlayer(state, action.playerId)
      if (!p) throw new RuleError('Joueur inconnu.')
      if (p.isAlive) {
        kill(draft, p.id, action.reason ?? 'autre')
      } else {
        p.isAlive = true
        p.deathReason = undefined
        p.deathRound = undefined
        log(`${p.name} a été ramené en jeu par le MJ.`, 'info')
      }
      return
    }
    case 'ELIMINATE_BY_VOTE': {
      requireCycle(state, 'day')
      requireAlive(state, action.playerId)
      kill(draft, action.playerId, 'vote')
      state.vote = emptyVote()
      return
    }
    case 'EXECUTE_HUNTER_SHOT': {
      if (!state.pendingHunterShotPlayerId) throw new RuleError('Aucun chasseur ne doit tirer.')
      requireAlive(state, action.targetPlayerId)
      state.pendingHunterShotPlayerId = undefined
      kill(draft, action.targetPlayerId, 'chasseur')
      return
    }
    case 'ASSIGN_CAPTAIN': {
      const target = requireAlive(state, action.playerId)
      const becomes = !target.isCaptain
      state.players.forEach(p => { p.isCaptain = becomes && p.id === target.id })
      if (becomes) log(`${target.name} est élu Capitaine : sa voix compte double.`, 'power')
      return
    }
    case 'ASSIGN_CAPTAIN_SUCCESSOR': {
      if (!state.pendingCaptainSuccessor) throw new RuleError('Aucune succession en attente.')
      const heir = requireAlive(state, action.newCaptainId)
      state.players.forEach(p => { p.isCaptain = p.id === heir.id })
      state.pendingCaptainSuccessor = false
      log(`${heir.name} hérite du titre de Capitaine.`, 'power')
      return
    }
    case 'TOGGLE_LOVER': {
      const p = findPlayer(state, action.playerId)
      if (!p) throw new RuleError('Joueur inconnu.')
      if (!p.isLover && state.players.filter(x => x.isLover).length >= 2) {
        throw new RuleError('Il y a déjà deux amoureux.')
      }
      p.isLover = !p.isLover
      const lovers = state.players.filter(x => x.isLover)
      if (lovers.length === 2) log(`Cupidon unit ${lovers[0].name} et ${lovers[1].name}.`, 'power')
      return
    }
    case 'TOGGLE_CHARMED_TONIGHT': {
      requireCycle(state, 'night')
      const p = requireAlive(state, action.playerId)
      const tonight = state.night.charmedTonightIds
      if (tonight.includes(p.id)) {
        state.night.charmedTonightIds = tonight.filter(id => id !== p.id)
        p.isCharmed = false
        return
      }
      if (p.roleId === 'joueur_de_flute') throw new RuleError('Le Joueur de Flûte ne se charme pas lui-même.')
      if (p.isCharmed) throw new RuleError(`${p.name} est déjà charmé.`)
      if (tonight.length >= 2) throw new RuleError('Deux joueurs sont déjà charmés cette nuit.')
      tonight.push(p.id)
      p.isCharmed = true
      return
    }
    case 'SET_INFECTED': {
      const p = findPlayer(state, action.playerId)
      if (!p) throw new RuleError('Joueur inconnu.')
      p.isInfected = action.isInfected
      return
    }
    case 'SET_WILD_CHILD_MODEL': {
      const child = findPlayer(state, action.childId)
      const model = findPlayer(state, action.modelId)
      if (!child || child.roleId !== 'enfant_sauvage') throw new RuleError('Ce joueur n\'est pas l\'Enfant Sauvage.')
      if (!model || model.id === child.id) throw new RuleError('Modèle invalide.')
      child.wildChildModelId = model.id
      log(`${child.name} (Enfant Sauvage) choisit ${model.name} comme modèle.`, 'power')
      return
    }
    case 'SET_DOG_WOLF_CHOICE': {
      const p = findPlayer(state, action.playerId)
      if (!p || p.roleId !== 'chien_loup') throw new RuleError('Ce joueur n\'est pas le Chien-Loup.')
      p.dogWolfChoice = action.choice
      log(`${p.name} (Chien-Loup) choisit le camp ${action.choice === 'loup' ? 'des loups' : 'du village'}.`, 'power')
      return
    }
    case 'SET_NIGHT_TARGET':
      setNightTarget(state, action.key, action.playerId)
      return
    case 'SET_INFECT_VICTIM': {
      requireCycle(state, 'night')
      if (action.infect) {
        if (state.night.infectionUsedThisGame) throw new RuleError('L\'infection a déjà été utilisée.')
        if (!state.night.wolfVictimId) throw new RuleError('Désignez d\'abord la victime des loups.')
        const father = state.players.find(p => p.roleId === 'infect_pere_des_loups' && p.isAlive)
        if (!father) throw new RuleError('L\'Infect Père des Loups n\'est plus en vie.')
      }
      state.night.infectVictim = action.infect
      return
    }
    case 'SET_WITCH_HEAL': {
      requireCycle(state, 'night')
      if (action.saved) {
        if (state.night.witchHealUsed) throw new RuleError('La potion de vie a déjà été utilisée.')
        if (!state.night.wolfVictimId) throw new RuleError('Aucune victime à sauver.')
      }
      state.night.witchSavedVictim = action.saved
      return
    }
    case 'COMPLETE_NIGHT_STEP':
      requireCycle(state, 'night')
      completeNightStep(draft, action.stepId)
      return
    case 'ADVANCE_TO_DAY':
      requireCycle(state, 'night')
      resolveDawn(draft)
      return
    case 'ADVANCE_TO_NIGHT': {
      requireCycle(state, 'day')
      if (state.pendingHunterShotPlayerId) throw new RuleError('Le Chasseur doit d\'abord tirer.')
      if (state.pendingCaptainSuccessor) throw new RuleError('Le Capitaine doit d\'abord être remplacé.')
      state.roundNumber += 1
      state.cycle = 'night'
      state.night.completedSteps = {}
      state.vote = emptyVote()
      state.timer = { durationSeconds: state.timer.durationSeconds, endsAt: null, pausedRemaining: null }
      log(`Le crépuscule tombe sur Thiercelieux. Début de la Nuit ${state.roundNumber}.`, 'turn')
      return
    }
    case 'START_TIMER':
    case 'PAUSE_TIMER':
    case 'RESET_TIMER':
      applyTimer(state, action, ctx.now)
      return
    case 'ACCUSE': {
      requireCycle(state, 'day')
      const p = requireAlive(state, action.playerId)
      if (!state.vote.accusedIds.includes(p.id)) {
        state.vote.accusedIds.push(p.id)
        state.vote.votes[p.id] = state.vote.votes[p.id] ?? 0
      }
      return
    }
    case 'UNACCUSE': {
      requireCycle(state, 'day')
      state.vote.accusedIds = state.vote.accusedIds.filter(id => id !== action.playerId)
      delete state.vote.votes[action.playerId]
      delete state.vote.corbeauBonus[action.playerId]
      return
    }
    case 'ADJUST_VOTES': {
      requireCycle(state, 'day')
      if (!state.vote.accusedIds.includes(action.playerId)) throw new RuleError('Ce joueur n\'est pas accusé.')
      state.vote.votes[action.playerId] = Math.max(0, (state.vote.votes[action.playerId] ?? 0) + action.delta)
      return
    }
    case 'ADD_LOG':
      log(action.message, action.logType ?? 'info')
      return
  }
}

/**
 * Pure transition: same state, action and context always give the same result.
 * Throws RuleError when the action breaks a rule.
 */
export function reduce(prev: GameState, action: GameAction, ctx: ActionContext): GameState {
  if (action.type === 'RESET_GAME') return structuredClone(initialGameState)

  const state = structuredClone(prev)
  const newLogs: LogEntry[] = []
  const time = new Date(ctx.now).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const draft: Draft = {
    state,
    log: (message, type, label) => {
      newLogs.push({ id: `${ctx.seq}-${newLogs.length}`, time, turnLabel: label ?? turnLabel(state), message, type })
    }
  }
  const aliveBefore = new Set(prev.players.filter(p => p.isAlive).map(p => p.id))

  apply(draft, action, ctx)

  const newlyDead = state.players.filter(p => !p.isAlive && aliveBefore.has(p.id)).map(p => p.id)
  if (newlyDead.length > 0) state.lastDeathIds = newlyDead
  if (action.type === 'ADVANCE_TO_DAY') state.dawnDeathIds = newlyDead
  if (action.type === 'ADVANCE_TO_NIGHT') {
    state.lastDeathIds = []
    state.dawnDeathIds = []
  }

  // Victory waits for a pending hunter shot, which can still change the outcome.
  if (state.phase !== 'setup' && !state.pendingHunterShotPlayerId) {
    const victory = checkVictory(state)
    if (victory && state.phase === 'playing') {
      state.phase = 'game_over'
      state.winner = victory.winner
      draft.log(`${victory.title}. ${victory.description}`, 'turn')
    } else if (!victory && state.phase === 'game_over') {
      // A correction (revive, undo of a manual kill) can reopen a finished game.
      state.phase = 'playing'
      state.winner = undefined
    }
  }

  state.logs = [...newLogs.reverse(), ...state.logs]
  return state
}
