export type RoleTeam = 'village' | 'loups' | 'solitaire' | 'ambigu'

export type RoleId =
  | 'loup_garou'
  | 'grand_mechant_loup'
  | 'infect_pere_des_loups'
  | 'loup_blanc'
  | 'voyante'
  | 'sorciere'
  | 'chasseur'
  | 'cupidon'
  | 'petite_fille'
  | 'deux_soeurs'
  | 'renard'
  | 'montreur_ours'
  | 'chevalier_epee_rouillee'
  | 'ancien'
  | 'villageois'
  | 'enfant_sauvage'
  | 'chien_loup'
  | 'joueur_de_flute'
  | 'ange'
  | 'carte_vierge'
  | 'salvateur'
  | 'corbeau'

export interface RoleDefinition {
  id: RoleId
  name: string
  team: RoleTeam
  description: string
  maxAvailable: number
  wakeFrequency: 'first_night_only' | 'every_night' | 'even_nights' | 'conditional' | 'never'
  spokenPrompt?: string
  guideNote?: string
}

export type DeathReason =
  | 'loups'
  | 'gml'
  | 'sorciere'
  | 'vote'
  | 'chasseur'
  | 'chagrin'
  | 'loup_blanc'
  | 'epee_rouillee'
  | 'autre'

export interface Player {
  id: string
  name: string
  seatNumber: number
  roleId: RoleId
  isAlive: boolean
  deathReason?: DeathReason
  deathRound?: string
  isLover: boolean
  isCharmed: boolean
  isInfected: boolean
  isCaptain: boolean
  elderLives: number
  foxLostPower: boolean
  wildChildModelId?: string
  dogWolfChoice?: 'village' | 'loup'
}

export type GamePhase = 'setup' | 'playing' | 'game_over'
export type GameCycle = 'night' | 'day'

export interface LogEntry {
  id: string
  time: string
  turnLabel: string
  message: string
  type: 'death' | 'power' | 'turn' | 'info' | 'alert'
}

/** Night fields that hold a single targeted player id. */
export type NightTargetKey =
  | 'wolfVictimId'
  | 'gmlVictimId'
  | 'whiteWolfTargetId'
  | 'witchKillTargetId'
  | 'seerTargetId'
  | 'foxTargetId'
  | 'salvateurTargetId'
  | 'corbeauTargetId'

export interface NightState {
  completedSteps: Record<string, boolean>
  wolfVictimId?: string
  gmlVictimId?: string
  infectVictim: boolean
  infectionUsedThisGame: boolean
  witchHealUsed: boolean
  witchKillUsed: boolean
  witchKillTargetId?: string
  witchSavedVictim: boolean
  whiteWolfTargetId?: string
  charmedTonightIds: string[]
  foxTargetId?: string
  seerTargetId?: string
  salvateurTargetId?: string
  /** Protected last night: the Salvateur cannot pick them twice in a row. */
  lastSalvateurTargetId?: string
  corbeauTargetId?: string
  /** Wolf wounded by the Rusty Sword Knight, dies at the next dawn. */
  rustyWoundedWolfId?: string
}

export interface GameTimer {
  durationSeconds: number
  /** Epoch ms at which the running timer hits zero; null when stopped or paused. */
  endsAt: number | null
  /** Seconds left while paused; null when running or never started. */
  pausedRemaining: number | null
}

export interface VoteState {
  accusedIds: string[]
  votes: Record<string, number>
  /** Votes the Corbeau imposed on a player this day (counted in `votes`). */
  corbeauBonus: Record<string, number>
}

export type Winner = 'village' | 'loups' | 'amoureux' | 'loup_blanc' | 'joueur_de_flute' | 'ange'

export interface GameState {
  phase: GamePhase
  cycle: GameCycle
  roundNumber: number
  players: Player[]
  night: NightState
  logs: LogEntry[]
  timer: GameTimer
  vote: VoteState
  villagePowersDisabled: boolean
  pendingHunterShotPlayerId?: string
  pendingCaptainSuccessor: boolean
  angelWon: boolean
  winner?: Winner
  /** Ids of the players killed by the most recent action that killed anyone. */
  lastDeathIds: string[]
  /** Ids of the players found dead at the last dawn (the morning announcement). */
  dawnDeathIds: string[]
}

export interface SetupPlayer {
  name: string
  roleId: RoleId
  seatNumber: number
}

export type GameAction =
  | { type: 'SETUP_GAME'; players: SetupPlayer[] }
  | { type: 'RESET_GAME' }
  | { type: 'TOGGLE_LIFE'; playerId: string; reason?: DeathReason }
  | { type: 'ELIMINATE_BY_VOTE'; playerId: string }
  | { type: 'EXECUTE_HUNTER_SHOT'; targetPlayerId: string }
  | { type: 'ASSIGN_CAPTAIN'; playerId: string }
  | { type: 'ASSIGN_CAPTAIN_SUCCESSOR'; newCaptainId: string }
  | { type: 'TOGGLE_LOVER'; playerId: string }
  | { type: 'TOGGLE_CHARMED_TONIGHT'; playerId: string }
  | { type: 'SET_INFECTED'; playerId: string; isInfected: boolean }
  | { type: 'SET_WILD_CHILD_MODEL'; childId: string; modelId: string }
  | { type: 'SET_DOG_WOLF_CHOICE'; playerId: string; choice: 'village' | 'loup' }
  | { type: 'SET_NIGHT_TARGET'; key: NightTargetKey; playerId?: string }
  | { type: 'SET_INFECT_VICTIM'; infect: boolean }
  | { type: 'SET_WITCH_HEAL'; saved: boolean }
  | { type: 'COMPLETE_NIGHT_STEP'; stepId: string }
  | { type: 'ADVANCE_TO_DAY' }
  | { type: 'ADVANCE_TO_NIGHT' }
  | { type: 'START_TIMER'; durationSeconds?: number }
  | { type: 'PAUSE_TIMER' }
  | { type: 'RESET_TIMER'; durationSeconds?: number }
  | { type: 'ACCUSE'; playerId: string }
  | { type: 'UNACCUSE'; playerId: string }
  | { type: 'ADJUST_VOTES'; playerId: string; delta: number }
  | { type: 'ADD_LOG'; message: string; logType?: LogEntry['type'] }

/** Deterministic inputs the reducer needs: the server stamps them so replays give identical states. */
export interface ActionContext {
  now: number
  seq: number
}

// --- Show (régie) -----------------------------------------------------------

export type ScreenView = 'night' | 'day' | 'reveal' | 'debate' | 'vote' | 'victory' | 'blackout'
export type SfxId = 'wolves' | 'bear' | 'rooster' | 'swoosh' | 'gunshot' | 'bell' | 'flute' | 'drum'
export type AmbienceId = 'night' | 'day' | 'none'

export type LightCommand =
  | { kind: 'scene'; name: string }
  | { kind: 'target'; seat: number; color: string }
  | { kind: 'strobe' }
  | { kind: 'blackout' }
  | { kind: 'full' }

export interface CueEffects {
  sfx?: SfxId
  ambience?: AmbienceId
  light?: LightCommand
  screen?: ScreenView
}

export type CueKind = 'nightfall' | 'night_step' | 'daybreak' | 'reveal' | 'debate' | 'vote' | 'death' | 'hunter' | 'victory'

export interface Cue {
  id: string
  kind: CueKind
  title: string
  effects: CueEffects
  /** False while the MJ has not reached the moment this cue belongs to. */
  ready: boolean
  /** The MJ has moved past this moment (validated night step). */
  passed?: boolean
  /** Night step this cue mirrors, so the régie can show where the MJ is. */
  stepId?: string
}

export type LightStatus = 'ok' | 'down' | 'fake'

export interface ShowState {
  firedCueIds: string[]
  skippedCueIds: string[]
  screen: ScreenView
  ambience: AmbienceId
  autoKinds: CueKind[]
}

export type ShowCommand =
  | { kind: 'go' }
  | { kind: 'fire'; cueId: string }
  | { kind: 'skip'; cueId: string }
  | { kind: 'screen'; view: ScreenView }
  | { kind: 'sfx'; id: SfxId }
  | { kind: 'ambience'; id: AmbienceId }
  | { kind: 'light'; command: LightCommand }
  | { kind: 'auto'; cueKind: CueKind; on: boolean }

// --- Projections --------------------------------------------------------------

export interface PublicDeath {
  name: string
  roleName: string
  roleId: RoleId
}

/** Everything the projector may show. Built server-side so secrets never leave. */
export interface PublicView {
  phase: GamePhase
  cycle: GameCycle
  roundNumber: number
  screen: ScreenView
  aliveCount: number
  timer: GameTimer
  accused: { name: string; votes: number }[]
  lastDeaths: PublicDeath[]
  /** Whether lastDeaths is the morning announcement or a death during the day (vote, hunter). */
  deathMoment: 'dawn' | 'day'
  victory?: { title: string; description: string }
}

export interface CompositionPreset {
  name: string
  roles: RoleId[]
}
