import { ROLES } from './roles'
import { GameState, Player, RoleId, Winner } from './types'

export const WOLF_ROLES: RoleId[] = ['loup_garou', 'grand_mechant_loup', 'infect_pere_des_loups', 'loup_blanc']

// Infection, Chien-Loup and Enfant Sauvage make the werewolf side dynamic.
export function isPlayerWerewolf(player: Player, allPlayers: Player[]): boolean {
  if (player.isInfected) return true
  if (WOLF_ROLES.includes(player.roleId)) return true
  if (player.roleId === 'chien_loup' && player.dogWolfChoice === 'loup') return true
  if (player.roleId === 'enfant_sauvage' && player.wildChildModelId) {
    const model = allPlayers.find(p => p.id === player.wildChildModelId)
    if (model && !model.isAlive) return true
  }
  return false
}

// Alive players in table order, so neighbours wrap around the circle.
export function getAlivePlayers(players: Player[]): Player[] {
  return players.filter(p => p.isAlive).sort((a, b) => a.seatNumber - b.seatNumber)
}

export function turnLabel(state: Pick<GameState, 'cycle' | 'roundNumber'>): string {
  return `${state.cycle === 'night' ? 'Nuit' : 'Jour'} ${state.roundNumber}`
}

export interface BearStatus {
  bear?: Player
  growls: boolean
  leftNeighbor?: Player
  rightNeighbor?: Player
}

// The bear growls if an alive wolf sits directly next to the tamer (or if the tamer is infected).
export function getBearGrowlStatus(players: Player[]): BearStatus | null {
  const bear = players.find(p => p.roleId === 'montreur_ours' && p.isAlive)
  if (!bear) return null
  const alive = getAlivePlayers(players)
  const idx = alive.findIndex(p => p.id === bear.id)
  if (alive.length <= 1) return { bear, growls: bear.isInfected }
  const leftNeighbor = alive[(idx - 1 + alive.length) % alive.length]
  const rightNeighbor = alive[(idx + 1) % alive.length]
  const growls =
    bear.isInfected || isPlayerWerewolf(leftNeighbor, players) || isPlayerWerewolf(rightNeighbor, players)
  return { bear, growls, leftNeighbor, rightNeighbor }
}

// First alive wolf after the knight in table order: wounded if the knight is eaten.
export function getRustySwordTarget(players: Player[]): Player | undefined {
  const knight = players.find(p => p.roleId === 'chevalier_epee_rouillee')
  if (!knight) return undefined
  const ring = players.filter(p => p.isAlive || p.id === knight.id).sort((a, b) => a.seatNumber - b.seatNumber)
  const idx = ring.findIndex(p => p.id === knight.id)
  for (let i = 1; i < ring.length; i++) {
    const candidate = ring[(idx + i) % ring.length]
    if (candidate.isAlive && isPlayerWerewolf(candidate, players)) return candidate
  }
  return undefined
}

export interface FoxResult {
  target: Player
  leftNeighbor?: Player
  rightNeighbor?: Player
  hasWolf: boolean
}

export function getFoxResult(targetId: string, players: Player[]): FoxResult | null {
  const alive = getAlivePlayers(players)
  const idx = alive.findIndex(p => p.id === targetId)
  if (idx === -1) return null
  const target = alive[idx]
  const leftNeighbor = alive.length > 1 ? alive[(idx - 1 + alive.length) % alive.length] : undefined
  const rightNeighbor = alive.length > 2 ? alive[(idx + 1) % alive.length] : undefined
  const hasWolf = [target, leftNeighbor, rightNeighbor].some(p => p !== undefined && isPlayerWerewolf(p, players))
  return { target, leftNeighbor, rightNeighbor, hasWolf }
}

export type NightStepId =
  | 'voleur'
  | 'cupidon'
  | 'amoureux'
  | 'deux_soeurs'
  | 'enfant_sauvage'
  | 'chien_loup'
  | 'salvateur'
  | 'voyante'
  | 'renard'
  | 'carte_vierge'
  | 'loups_garous'
  | 'grand_mechant_loup'
  | 'loup_blanc'
  | 'sorciere'
  | 'corbeau'
  | 'joueur_de_flute'
  | 'charmes_reveil'

export interface NightStep {
  id: NightStepId
  title: string
  roleId?: RoleId
  spokenPrompt: string
  instructions: string
  playerIds: string[]
}

/** Village roles lose their night power once the Ancien has been voted out. */
function hasPower(state: GameState, roleId: RoleId): boolean {
  return !(state.villagePowersDisabled && ROLES[roleId].team === 'village')
}

// Night order: first-night rituals, protection, information, kills, then the Witch who reacts to them.
export function getNightSteps(state: GameState): NightStep[] {
  const { players, roundNumber } = state
  const steps: NightStep[] = []
  const alive = (roleId: RoleId) => players.filter(p => p.roleId === roleId && p.isAlive)
  const first = (roleId: RoleId) => alive(roleId)[0] as Player | undefined
  const push = (step: Omit<NightStep, 'playerIds'>, who: Player[]) => steps.push({ ...step, playerIds: who.map(p => p.id) })

  if (roundNumber === 1) {
    const thief = players.find(p => p.id === state.thief?.playerId && p.isAlive)
    if (thief) {
      push({ id: 'voleur', title: 'Le Voleur', roleId: 'voleur',
        spokenPrompt: ROLES.voleur.spokenPrompt ?? '',
        instructions: 'Touchez la carte qu\'il prend, ou validez s\'il garde la sienne.' }, [thief])
    }
    const cupidon = first('cupidon')
    if (cupidon) {
      push({ id: 'cupidon', title: 'Cupidon', roleId: 'cupidon',
        spokenPrompt: 'Cupidon se réveille et désigne deux personnes qui seront unies d\'un amour indéfectible.',
        instructions: 'Touchez les deux amoureux désignés.' }, [cupidon])
      push({ id: 'amoureux', title: 'Les Amoureux',
        spokenPrompt: 'Cupidon s\'endort. Je touche les amoureux. Les Amoureux se réveillent, se reconnaissent et s\'endorment.',
        instructions: 'Touchez discrètement l\'épaule des deux amoureux.' }, players.filter(p => p.isLover))
    }
    const soeurs = alive('deux_soeurs')
    if (soeurs.length >= 2) {
      push({ id: 'deux_soeurs', title: 'Les Deux Sœurs', roleId: 'deux_soeurs',
        spokenPrompt: 'Les Deux Sœurs se réveillent, se reconnaissent et s\'endorment.',
        instructions: 'Rien à saisir.' }, soeurs)
    }
    const enfant = first('enfant_sauvage')
    if (enfant) {
      push({ id: 'enfant_sauvage', title: 'L\'Enfant Sauvage', roleId: 'enfant_sauvage',
        spokenPrompt: 'L\'Enfant Sauvage se réveille et me montre discrètement son modèle.',
        instructions: 'Touchez le modèle choisi.' }, [enfant])
    }
    const chien = first('chien_loup')
    if (chien) {
      push({ id: 'chien_loup', title: 'Le Chien-Loup', roleId: 'chien_loup',
        spokenPrompt: 'Le Chien-Loup se réveille et choisit son camp : Village ou Loup-Garou.',
        instructions: 'Enregistrez son choix, il est définitif.' }, [chien])
    }
  }

  const salvateur = first('salvateur')
  if (salvateur && hasPower(state, 'salvateur')) {
    push({ id: 'salvateur', title: 'Le Salvateur', roleId: 'salvateur',
      spokenPrompt: ROLES.salvateur.spokenPrompt ?? '',
      instructions: 'Touchez le joueur protégé. Pas le même que la nuit dernière.' }, [salvateur])
  }

  const voyante = first('voyante')
  if (voyante && hasPower(state, 'voyante')) {
    push({ id: 'voyante', title: 'La Voyante', roleId: 'voyante',
      spokenPrompt: 'La Voyante se réveille et me désigne la personne dont elle veut connaître l\'identité.',
      instructions: 'Touchez le joueur désigné : sa carte s\'affiche en plein écran.' }, [voyante])
  }

  const renard = players.find(p => p.roleId === 'renard' && p.isAlive && !p.foxLostPower)
  if (renard && hasPower(state, 'renard')) {
    push({ id: 'renard', title: 'Le Renard', roleId: 'renard',
      spokenPrompt: 'Le Renard se réveille et me désigne un joueur central à flairer.',
      instructions: 'Touchez le joueur central : le panel vérifie le trio.' }, [renard])
  }

  const custom = first('carte_vierge')
  if (custom && state.customStep?.spokenPrompt.trim() && (!state.customStep.firstNightOnly || roundNumber === 1) && hasPower(state, 'carte_vierge')) {
    push({ id: 'carte_vierge', title: state.customStep.title || ROLES.carte_vierge.name, roleId: 'carte_vierge',
      spokenPrompt: state.customStep.spokenPrompt, instructions: 'Rôle maison : rien à saisir.' }, [custom])
  }

  const wolves = players.filter(p => p.isAlive && isPlayerWerewolf(p, players))
  if (wolves.length > 0) {
    push({ id: 'loups_garous', title: 'Les Loups-Garous', roleId: 'loup_garou',
      spokenPrompt: 'Les Loups-Garous se réveillent et désignent ensemble leur victime.',
      instructions: 'Touchez la victime choisie par la meute.' }, wolves)
  }

  const gml = first('grand_mechant_loup')
  const anyWolfDead = players.some(p => !p.isAlive && isPlayerWerewolf(p, players))
  if (gml && !anyWolfDead) {
    push({ id: 'grand_mechant_loup', title: 'Le Grand Méchant Loup', roleId: 'grand_mechant_loup',
      spokenPrompt: 'Le Grand Méchant Loup se réveille seul et désigne une seconde victime.',
      instructions: 'Touchez sa seconde victime.' }, [gml])
  }

  const loupBlanc = first('loup_blanc')
  if (loupBlanc && roundNumber % 2 === 0) {
    push({ id: 'loup_blanc', title: 'Le Loup-Garou Blanc', roleId: 'loup_blanc',
      spokenPrompt: 'Le Loup-Garou Blanc se réveille et peut éliminer un loup.',
      instructions: 'Touchez le loup visé, ou passez.' }, [loupBlanc])
  }

  const sorciere = first('sorciere')
  if (sorciere && hasPower(state, 'sorciere')) {
    push({ id: 'sorciere', title: 'La Sorcière', roleId: 'sorciere',
      spokenPrompt: 'La Sorcière se réveille. Je lui montre la victime des loups. Potion de vie ? Potion de mort ?',
      instructions: 'Indiquez si elle sauve la victime, puis qui elle empoisonne.' }, [sorciere])
  }

  const corbeau = first('corbeau')
  if (corbeau && hasPower(state, 'corbeau')) {
    push({ id: 'corbeau', title: 'Le Corbeau', roleId: 'corbeau',
      spokenPrompt: ROLES.corbeau.spokenPrompt ?? '',
      instructions: 'Touchez le joueur accablé, ou passez.' }, [corbeau])
  }

  const flute = first('joueur_de_flute')
  if (flute) {
    push({ id: 'joueur_de_flute', title: 'Le Joueur de Flûte', roleId: 'joueur_de_flute',
      spokenPrompt: 'Le Joueur de Flûte se réveille et me montre deux joueurs à envoûter.',
      instructions: 'Touchez les deux joueurs charmés cette nuit.' }, [flute])
    push({ id: 'charmes_reveil', title: 'Les Envoûtés',
      spokenPrompt: 'Le Joueur de Flûte s\'endort. Je touche les personnes charmées. Les Envoûtés se réveillent, se reconnaissent et s\'endorment.',
      instructions: 'Touchez discrètement tous les envoûtés.' }, players.filter(p => p.isAlive && p.isCharmed))
  }

  return steps
}

/** The step the MJ is on: the first one not yet validated. */
export function getCurrentNightStep(state: GameState): NightStep | undefined {
  return getNightSteps(state).find(s => !state.night.completedSteps[s.id])
}

export interface VictoryResult {
  winner?: Winner
  title: string
  description: string
}

export function checkVictory(state: Pick<GameState, 'players' | 'angelWon'>): VictoryResult | null {
  const { players } = state
  if (state.angelWon) {
    return { winner: 'ange', title: 'Victoire de l\'Ange',
      description: 'L\'Ange a obtenu ce qu\'il voulait : être condamné par le village dès le premier jour.' }
  }
  const alive = players.filter(p => p.isAlive)
  if (alive.length === 0) {
    return { title: 'Égalité tragique', description: 'Tout le village a péri.' }
  }

  const aliveLovers = alive.filter(p => p.isLover)
  if (alive.length === 2 && aliveLovers.length === 2) {
    return { winner: 'amoureux', title: 'Victoire des Amoureux',
      description: `${aliveLovers[0].name} et ${aliveLovers[1].name} ont survécu à tous les périls de Thiercelieux.` }
  }

  const flute = alive.find(p => p.roleId === 'joueur_de_flute')
  if (flute) {
    const others = alive.filter(p => p.id !== flute.id)
    if (others.length > 0 && others.every(p => p.isCharmed)) {
      return { winner: 'joueur_de_flute', title: 'Victoire du Joueur de Flûte',
        description: `Tous les survivants ont succombé à la mélodie de ${flute.name}.` }
    }
  }

  const whiteWolf = alive.find(p => p.roleId === 'loup_blanc')
  if (whiteWolf && alive.length === 1) {
    return { winner: 'loup_blanc', title: 'Victoire du Loup-Garou Blanc',
      description: `${whiteWolf.name} a éliminé la meute et le village pour régner seul.` }
  }

  const wolves = alive.filter(p => isPlayerWerewolf(p, players))
  const villagers = alive.filter(p => !isPlayerWerewolf(p, players))
  if (wolves.length === 0) {
    return { winner: 'village', title: 'Victoire des Villageois',
      description: 'Tous les monstres ont été éliminés. Le village retrouve la paix.' }
  }
  // A mixed wolf/villager couple still plays on: they win together as the last two.
  if (wolves.length >= villagers.length && !flute && aliveLovers.length < 2 && !(whiteWolf && wolves.length > 1)) {
    return { winner: 'loups', title: 'Victoire de la Meute',
      description: 'Les Loups-Garous sont désormais en supériorité numérique.' }
  }
  return null
}
