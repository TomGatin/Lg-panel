import { Player, GameState } from '../types/game'
import {
  isPlayerWerewolf,
  getBearGrowlStatus,
  getRustySwordTarget,
  getFoxResult,
  getNightSteps,
  checkVictory
} from './gameHelpers'

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ÉCHEC : ${msg}`)
    throw new Error(msg)
  } else {
    console.log(`✅ SUCCÈS : ${msg}`)
  }
}

console.log('--- TEST DES RÈGLES DE JEU THIERCELIEUX BEST OF ---')

// 1. Test isPlayerWerewolf
const basePlayers: Player[] = [
  { id: 'p1', name: 'Alice', seatNumber: 1, roleId: 'voyante', isAlive: true, isLover: false, isCharmed: false, isInfected: false, isCaptain: false, elderLives: 0, foxLostPower: false },
  { id: 'p2', name: 'Bob', seatNumber: 2, roleId: 'montreur_ours', isAlive: true, isLover: false, isCharmed: false, isInfected: false, isCaptain: false, elderLives: 0, foxLostPower: false },
  { id: 'p3', name: 'Charlie', seatNumber: 3, roleId: 'villageois', isAlive: true, isLover: false, isCharmed: false, isInfected: false, isCaptain: false, elderLives: 0, foxLostPower: false },
  { id: 'p4', name: 'David', seatNumber: 4, roleId: 'loup_garou', isAlive: true, isLover: false, isCharmed: false, isInfected: false, isCaptain: false, elderLives: 0, foxLostPower: false },
  { id: 'p5', name: 'Emma', seatNumber: 5, roleId: 'enfant_sauvage', isAlive: true, isLover: false, isCharmed: false, isInfected: false, isCaptain: false, elderLives: 0, foxLostPower: false, wildChildModelId: 'p3' },
  { id: 'p6', name: 'Fabien', seatNumber: 6, roleId: 'chevalier_epee_rouillee', isAlive: true, isLover: false, isCharmed: false, isInfected: false, isCaptain: false, elderLives: 0, foxLostPower: false },
]

assert(!isPlayerWerewolf(basePlayers[0], basePlayers), 'La Voyante n\'est pas un loup')
assert(isPlayerWerewolf(basePlayers[3], basePlayers), 'David est un loup-garou')
assert(!isPlayerWerewolf(basePlayers[4], basePlayers), 'L\'Enfant Sauvage n\'est pas loup tant que Charlie est vivant')

// If Charlie dies, Enfant Sauvage becomes werewolf
basePlayers[2].isAlive = false
assert(isPlayerWerewolf(basePlayers[4], basePlayers), 'L\'Enfant Sauvage devient loup quand son modèle Charlie meurt')
basePlayers[2].isAlive = true // revive Charlie

// 2. Test Montreur d'Ours
let bear = getBearGrowlStatus(basePlayers)
assert(bear.hasBear && bear.isBearAlive, 'Montreur d\'ours détecté et vivant')
assert(!bear.growls, 'L\'ours est calme car Alice et Charlie ne sont pas loups')

// If Charlie dies, right neighbor of Bob becomes David (Loup) -> Bear growls!
basePlayers[2].isAlive = false
bear = getBearGrowlStatus(basePlayers)
assert(bear.growls, 'L\'ours grogne car son nouveau voisin de droite vivant est David (Loup)')
basePlayers[2].isAlive = true // revive Charlie

// If Bob himself is infected -> Bear growls!
basePlayers[1].isInfected = true
bear = getBearGrowlStatus(basePlayers)
assert(bear.growls, 'L\'ours grogne car le Montreur d\'Ours est lui-même infecté')
basePlayers[1].isInfected = false

// 3. Test Chevalier à l'Épée Rouillée
const rusty = getRustySwordTarget(basePlayers)
assert(rusty.targetWolf?.id === 'p4', 'Le 1er loup à gauche du Chevalier est David')

// 4. Test Renard
const foxPositive = getFoxResult('p3', basePlayers)
assert(foxPositive !== null && foxPositive.hasWolf, 'Le renard flaire David (loup) dans le trio de Charlie')

const foxNegative = getFoxResult('p1', basePlayers)
assert(foxNegative !== null && !foxNegative.hasWolf, 'Le renard ne flaire aucun loup dans le trio d\'Alice')

// 5. Test Night Steps logic
const night1Steps = getNightSteps(1, basePlayers)
const night2Steps = getNightSteps(2, basePlayers)
assert(night1Steps.some(s => s.id === 'enfant_sauvage'), 'Nuit 1 inclut l\'Enfant Sauvage')
assert(!night2Steps.some(s => s.id === 'enfant_sauvage'), 'Nuit 2 n\'appelle plus l\'Enfant Sauvage')

// 6. Test Victory Conditions (including Angel!)
const angelState: Partial<GameState> = { angelWon: true }
const vicAngel = checkVictory(basePlayers, angelState)
assert(vicAngel.isOver && vicAngel.winner === 'ange', 'Victoire de l\'Ange quand angelWon est true')

const allVillagers: Player[] = [
  { id: 'p1', name: 'Alice', seatNumber: 1, roleId: 'voyante', isAlive: true, isLover: false, isCharmed: false, isInfected: false, isCaptain: false, elderLives: 0, foxLostPower: false },
  { id: 'p2', name: 'Bob', seatNumber: 2, roleId: 'villageois', isAlive: true, isLover: false, isCharmed: false, isInfected: false, isCaptain: false, elderLives: 0, foxLostPower: false },
  { id: 'p3', name: 'David', seatNumber: 3, roleId: 'loup_garou', isAlive: false, isLover: false, isCharmed: false, isInfected: false, isCaptain: false, elderLives: 0, foxLostPower: false },
]
const vicA = checkVictory(allVillagers)
assert(vicA.isOver && vicA.winner === 'village', 'Victoire des Villageois quand tous les loups sont morts')

const loversOnly: Player[] = [
  { id: 'p1', name: 'Alice', seatNumber: 1, roleId: 'voyante', isAlive: true, isLover: true, isCharmed: false, isInfected: false, isCaptain: false, elderLives: 0, foxLostPower: false },
  { id: 'p2', name: 'David', seatNumber: 2, roleId: 'loup_garou', isAlive: true, isLover: true, isCharmed: false, isInfected: false, isCaptain: false, elderLives: 0, foxLostPower: false },
  { id: 'p3', name: 'Bob', seatNumber: 3, roleId: 'villageois', isAlive: false, isLover: false, isCharmed: false, isInfected: false, isCaptain: false, elderLives: 0, foxLostPower: false },
]
const vicB = checkVictory(loversOnly)
assert(vicB.isOver && vicB.winner === 'amoureux', 'Victoire des Amoureux s\'ils sont les 2 seuls survivants')

console.log('🎉 TOUS LES TESTS DE LOGIQUE SONT PASSÉS AVEC SUCCÈS !')
