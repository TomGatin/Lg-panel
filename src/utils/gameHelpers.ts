import { Player, RoleId, GameState } from '../types/game'

// Check if a player belongs to the werewolf team (dynamically considering infections and transformations)
export function isPlayerWerewolf(player: Player, allPlayers: Player[]): boolean {
  if (player.isInfected) return true
  if (['loup_garou', 'grand_mechant_loup', 'infect_pere_des_loups', 'loup_blanc'].includes(player.roleId)) {
    return true
  }
  if (player.roleId === 'chien_loup' && player.dogWolfChoice === 'loup') {
    return true
  }
  if (player.roleId === 'enfant_sauvage' && player.wildChildModelId) {
    const model = allPlayers.find(p => p.id === player.wildChildModelId)
    if (model && !model.isAlive) {
      return true
    }
  }
  return false
}

// Get ordered list of alive players (preserving table circular order)
export function getAlivePlayers(players: Player[]): Player[] {
  return [...players].filter(p => p.isAlive).sort((a, b) => a.seatNumber - b.seatNumber)
}

// Calculate Bear Tamer status (growls if an alive wolf is direct left or right neighbor)
export function getBearGrowlStatus(players: Player[]): {
  hasBear: boolean
  isBearAlive: boolean
  bearPlayer?: Player
  growls: boolean
  leftNeighbor?: Player
  rightNeighbor?: Player
  leftIsWolf: boolean
  rightIsWolf: boolean
  bearIsInfected: boolean
} {
  const bear = players.find(p => p.roleId === 'montreur_ours')
  if (!bear) {
    return { hasBear: false, isBearAlive: false, growls: false, leftIsWolf: false, rightIsWolf: false, bearIsInfected: false }
  }
  if (!bear.isAlive) {
    return { hasBear: true, isBearAlive: false, bearPlayer: bear, growls: false, leftIsWolf: false, rightIsWolf: false, bearIsInfected: false }
  }

  const alive = getAlivePlayers(players)
  const bearIdx = alive.findIndex(p => p.id === bear.id)

  if (bearIdx === -1 || alive.length <= 1) {
    return { hasBear: true, isBearAlive: true, bearPlayer: bear, growls: false, leftIsWolf: false, rightIsWolf: false, bearIsInfected: false }
  }

  // Circular neighbors among ALIVE players
  const leftIdx = (bearIdx - 1 + alive.length) % alive.length
  const rightIdx = (bearIdx + 1) % alive.length

  const leftNeighbor = alive[leftIdx]
  const rightNeighbor = alive[rightIdx]

  const leftIsWolf = isPlayerWerewolf(leftNeighbor, players)
  const rightIsWolf = isPlayerWerewolf(rightNeighbor, players)
  const bearIsInfected = bear.isInfected

  const growls = leftIsWolf || rightIsWolf || bearIsInfected

  return {
    hasBear: true,
    isBearAlive: true,
    bearPlayer: bear,
    growls,
    leftNeighbor,
    rightNeighbor,
    leftIsWolf,
    rightIsWolf,
    bearIsInfected
  }
}

// Calculate the next alive wolf to the left of the Rusty Sword Knight
export function getRustySwordTarget(players: Player[]): {
  knight?: Player
  isKnightAlive: boolean
  targetWolf?: Player
} {
  const knight = players.find(p => p.roleId === 'chevalier_epee_rouillee')
  if (!knight) return { isKnightAlive: false }

  const alive = getAlivePlayers(players)
  const knightIdx = alive.findIndex(p => p.id === knight.id)

  if (knightIdx !== -1) {
    for (let i = 1; i < alive.length; i++) {
      const candidate = alive[(knightIdx + i) % alive.length]
      if (isPlayerWerewolf(candidate, players)) {
        return { knight, isKnightAlive: knight.isAlive, targetWolf: candidate }
      }
    }
  }

  return { knight, isKnightAlive: knight.isAlive, targetWolf: undefined }
}

// Calculate Renard sniffing result for a given center target
export function getFoxResult(targetId: string, players: Player[]): {
  target: Player
  leftNeighbor?: Player
  rightNeighbor?: Player
  hasWolf: boolean
} | null {
  const alive = getAlivePlayers(players)
  const targetIdx = alive.findIndex(p => p.id === targetId)
  if (targetIdx === -1) return null

  const target = alive[targetIdx]
  const leftIdx = (targetIdx - 1 + alive.length) % alive.length
  const rightIdx = (targetIdx + 1) % alive.length

  const leftNeighbor = alive.length > 1 ? alive[leftIdx] : undefined
  const rightNeighbor = alive.length > 2 ? alive[rightIdx] : undefined

  const hasWolf =
    isPlayerWerewolf(target, players) ||
    (leftNeighbor ? isPlayerWerewolf(leftNeighbor, players) : false) ||
    (rightNeighbor ? isPlayerWerewolf(rightNeighbor, players) : false)

  return { target, leftNeighbor, rightNeighbor, hasWolf }
}

export interface NightStep {
  id: string
  title: string
  emoji: string
  roleId?: RoleId
  isSpecial?: boolean
  spokenPrompt: string
  instructions: string
  associatedPlayers: Player[]
}

// Dynamic night sequence generator
export function getNightSteps(roundNumber: number, players: Player[]): NightStep[] {
  const steps: NightStep[] = []
  const isNight1 = roundNumber === 1

  // 1. Cupidon (Night 1 only)
  if (isNight1) {
    const cupidon = players.find(p => p.roleId === 'cupidon' && p.isAlive)
    if (cupidon) {
      steps.push({
        id: 'cupidon',
        title: 'Cupidon',
        emoji: '🏹',
        roleId: 'cupidon',
        spokenPrompt: 'Cupidon se réveille et désigne deux personnes qui seront unies d\'un amour indéfectible.',
        instructions: 'Désignez les deux amoureux sur la table.',
        associatedPlayers: [cupidon]
      })
      steps.push({
        id: 'amoureux',
        title: 'Les Amoureux',
        emoji: '♥',
        isSpecial: true,
        spokenPrompt: 'Cupidon s\'endort. Je touche les amoureux. Les Amoureux se réveillent, se reconnaissent et s\'endorment.',
        instructions: 'Vérifiez qu\'ils se sont reconnus discrètement.',
        associatedPlayers: players.filter(p => p.isLover)
      })
    }

    // 2. Deux Sœurs (Night 1 only)
    const soeurs = players.filter(p => p.roleId === 'deux_soeurs' && p.isAlive)
    if (soeurs.length >= 2) {
      steps.push({
        id: 'deux_soeurs',
        title: 'Les Deux Sœurs',
        emoji: '👭',
        roleId: 'deux_soeurs',
        spokenPrompt: 'Les Deux Sœurs se réveillent, se reconnaissent et s\'endorment.',
        instructions: 'Elles se regardent silencieusement.',
        associatedPlayers: soeurs
      })
    }

    // 3. Enfant Sauvage (Night 1 only)
    const enfant = players.find(p => p.roleId === 'enfant_sauvage' && p.isAlive)
    if (enfant) {
      steps.push({
        id: 'enfant_sauvage',
        title: 'L\'Enfant Sauvage',
        emoji: '🏹',
        roleId: 'enfant_sauvage',
        spokenPrompt: 'L\'Enfant Sauvage se réveille et me montre discrètement son modèle.',
        instructions: 'Enregistrez le joueur choisi comme modèle secret.',
        associatedPlayers: [enfant]
      })
    }

    // 4. Chien-Loup (Night 1 only)
    const chien = players.find(p => p.roleId === 'chien_loup' && p.isAlive)
    if (chien) {
      steps.push({
        id: 'chien_loup',
        title: 'Le Chien-Loup',
        emoji: '🐕',
        roleId: 'chien_loup',
        spokenPrompt: 'Le Chien-Loup se réveille et choisit son allégeance : Village ou Loup-Garou.',
        instructions: 'Enregistrez son choix définitif.',
        associatedPlayers: [chien]
      })
    }
  }

  // 5. Voyante
  const voyante = players.find(p => p.roleId === 'voyante' && p.isAlive)
  if (voyante) {
    steps.push({
      id: 'voyante',
      title: 'La Voyante',
      emoji: '🔮',
      roleId: 'voyante',
      spokenPrompt: 'La Voyante se réveille et me montre une personne dont elle souhaite sonder l\'âme.',
      instructions: 'Montrez-lui discrètement la carte.',
      associatedPlayers: [voyante]
    })
  }

  // 6. Renard
  const renard = players.find(p => p.roleId === 'renard' && p.isAlive && !p.foxLostPower)
  if (renard) {
    steps.push({
      id: 'renard',
      title: 'Le Renard',
      emoji: '🦊',
      roleId: 'renard',
      spokenPrompt: 'Le Renard se réveille et me désigne un joueur central à flairer.',
      instructions: 'Sélectionnez le joueur ci-dessous pour vérifier la présence d\'un loup.',
      associatedPlayers: [renard]
    })
  }

  // 7. Meute des Loups-Garous
  const livingWolves = players.filter(p => p.isAlive && isPlayerWerewolf(p, players))
  if (livingWolves.length > 0) {
    const infectFather = livingWolves.find(p => p.roleId === 'infect_pere_des_loups')
    steps.push({
      id: 'loups_garous',
      title: 'Les Loups-Garous',
      emoji: '🐺',
      roleId: 'loup_garou',
      spokenPrompt: 'Les Loups-Garous se réveillent et désignent ensemble leur proie.',
      instructions: infectFather
        ? 'Désignez la victime. Si le Père des Loups lève la main, vous pouvez l\'infecter.'
        : 'Désignez la victime commune de la meute.',
      associatedPlayers: livingWolves
    })
  }

  // 8. Grand Méchant Loup
  const gml = players.find(p => p.roleId === 'grand_mechant_loup' && p.isAlive)
  const anyWolfDead = players.some(p => !p.isAlive && isPlayerWerewolf(p, players))
  if (gml && !anyWolfDead) {
    steps.push({
      id: 'grand_mechant_loup',
      title: 'Le Grand Méchant Loup',
      emoji: '🩸',
      roleId: 'grand_mechant_loup',
      spokenPrompt: 'Le Grand Méchant Loup se réveille seul et désigne une seconde victime.',
      instructions: 'Il dévore une victime supplémentaire tant qu\'aucun loup n\'a péri.',
      associatedPlayers: [gml]
    })
  }

  // 9. Loup-Garou Blanc (even nights only: 2, 4, 6...)
  const loupBlanc = players.find(p => p.roleId === 'loup_blanc' && p.isAlive)
  if (loupBlanc && roundNumber % 2 === 0) {
    steps.push({
      id: 'loup_blanc',
      title: 'Le Loup-Garou Blanc',
      emoji: '🌕',
      roleId: 'loup_blanc',
      spokenPrompt: 'Le Loup-Garou Blanc se réveille et peut décider d\'éliminer un loup.',
      instructions: 'Il peut tuer un loup ou se rendormir sans faire de victime.',
      associatedPlayers: [loupBlanc]
    })
  }

  // 10. Sorcière
  const sorciere = players.find(p => p.roleId === 'sorciere' && p.isAlive)
  if (sorciere) {
    steps.push({
      id: 'sorciere',
      title: 'La Sorcière',
      emoji: '🧙‍♀️',
      roleId: 'sorciere',
      spokenPrompt: 'La Sorcière se réveille. Je lui montre la victime des loups. Potion de vie ? Potion de mort ?',
      instructions: 'Indiquez si elle sauve ou empoisonne.',
      associatedPlayers: [sorciere]
    })
  }

  // 11. Joueur de Flûte
  const flute = players.find(p => p.roleId === 'joueur_de_flute' && p.isAlive)
  if (flute) {
    steps.push({
      id: 'joueur_de_flute',
      title: 'Le Joueur de Flûte',
      emoji: '🪈',
      roleId: 'joueur_de_flute',
      spokenPrompt: 'Le Joueur de Flûte se réveille et me montre deux âmes à envoûter.',
      instructions: 'Sélectionnez les 2 joueurs charmés cette nuit.',
      associatedPlayers: [flute]
    })
    steps.push({
      id: 'charmes_reveil',
      title: 'Les Envoûtés',
      emoji: '♪',
      isSpecial: true,
      spokenPrompt: 'Le Joueur de Flûte s\'endort. Je touche les personnes charmées. Les Envoûtés se réveillent, se reconnaissent et s\'endorment.',
      instructions: 'Touchez discrètement les nouveaux envoûtés.',
      associatedPlayers: players.filter(p => p.isAlive && p.isCharmed)
    })
  }

  return steps
}

// Victory detector
export function checkVictory(players: Player[], gameState?: Partial<GameState>): {
  isOver: boolean
  winner?: 'village' | 'loups' | 'amoureux' | 'loup_blanc' | 'joueur_de_flute' | 'ange'
  title?: string
  description?: string
} {
  // 0. Angel Victory: eliminated on Day 1 vote
  if (gameState?.angelWon) {
    return {
      isOver: true,
      winner: 'ange',
      title: 'Victoire de l\'Ange',
      description: 'L\'Ange a réussi son dessein en se faisant condamner par le village dès le premier jour.'
    }
  }

  const alive = players.filter(p => p.isAlive)
  if (alive.length === 0) {
    return { isOver: true, title: 'Égalité Tragique', description: 'Tout le village a péri !' }
  }

  // 1. Lovers: exactly 2 alive and both lovers
  const aliveLovers = alive.filter(p => p.isLover)
  if (alive.length === 2 && aliveLovers.length === 2) {
    return {
      isOver: true,
      winner: 'amoureux',
      title: 'Victoire des Amoureux',
      description: `${aliveLovers[0].name} et ${aliveLovers[1].name} ont survécu à tous les périls de Thiercelieux.`
    }
  }

  // 2. Joueur de Flûte
  const fluteAlive = alive.find(p => p.roleId === 'joueur_de_flute')
  if (fluteAlive) {
    const nonFluteAlive = alive.filter(p => p.id !== fluteAlive.id)
    if (nonFluteAlive.length > 0 && nonFluteAlive.every(p => p.isCharmed)) {
      return {
        isOver: true,
        winner: 'joueur_de_flute',
        title: 'Victoire du Joueur de Flûte',
        description: `Tous les survivants ont succombé à la mélodie envoûtante de ${fluteAlive.name}.`
      }
    }
  }

  // 3. Loup Blanc
  const whiteWolfAlive = alive.find(p => p.roleId === 'loup_blanc')
  if (whiteWolfAlive && alive.length === 1) {
    return {
      isOver: true,
      winner: 'loup_blanc',
      title: 'Victoire du Loup-Garou Blanc',
      description: `${whiteWolfAlive.name} a éliminé la meute et le village pour régner seul.`
    }
  }

  // 4. Wolves vs Villagers count
  const wolves = alive.filter(p => isPlayerWerewolf(p, players))
  const villagers = alive.filter(p => !isPlayerWerewolf(p, players))

  if (wolves.length === 0) {
    return {
      isOver: true,
      winner: 'village',
      title: 'Victoire des Villageois',
      description: 'Tous les monstres ont été éliminés. Le village retrouve enfin la sérénité.'
    }
  }

  if (wolves.length >= villagers.length && !fluteAlive && aliveLovers.length < 2) {
    return {
      isOver: true,
      winner: 'loups',
      title: 'Victoire de la Meute',
      description: 'Les Loups-Garous sont désormais en supériorité numérique absolue.'
    }
  }

  return { isOver: false }
}
