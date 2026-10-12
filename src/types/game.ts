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

export interface RoleDefinition {
  id: RoleId
  name: string
  team: RoleTeam
  emoji: string
  color: string
  description: string
  maxAvailable: number
  wakeFrequency: 'first_night_only' | 'every_night' | 'even_nights' | 'conditional' | 'never'
  spokenPrompt?: string
  guideNote?: string
}

export interface Player {
  id: string
  name: string
  seatNumber: number
  roleId: RoleId
  customRoleName?: string
  isAlive: boolean
  deathReason?: 'loups' | 'gml' | 'sorciere' | 'vote' | 'chasseur' | 'chagrin' | 'loup_blanc' | 'epee_rouillee' | 'autre'
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

export interface NightState {
  currentStepIndex: number
  completedSteps: Record<string, boolean>
  wolfVictimId?: string
  gmlVictimId?: string
  infectedVictimId?: string
  infectionUsedThisGame: boolean
  witchHealUsed: boolean
  witchKillUsed: boolean
  witchKillTargetId?: string
  witchSavedVictim: boolean
  whiteWolfTargetId?: string
  charmedTonightIds: string[]
  foxTargetId?: string
  seerTargetId?: string
}

export interface GameState {
  phase: GamePhase
  cycle: GameCycle
  roundNumber: number
  players: Player[]
  night: NightState
  logs: LogEntry[]
  timerDuration: number
  timerRemaining: number
  isTimerRunning: boolean
  villagePowersDisabled: boolean
  pendingHunterShotPlayerId?: string // Set if hunter just died and needs to shoot
  pendingCaptainSuccessor: boolean // Set if captain just died
  angelWon: boolean // Set if angel was killed on Day 1 vote
}
