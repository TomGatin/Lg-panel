import { describe, expect, it } from 'vitest'
import { RuleError } from '../shared/reducer'
import { getNightSteps } from '../shared/rules'
import { RoleId } from '../shared/types'
import { Game } from './helpers'

describe('setup', () => {
  it('opens night 1 with players in seat order', () => {
    const g = new Game(['loup_garou', 'voyante', 'villageois'], ['Alice', 'Bob', 'Chloé'])
    expect(g.state.phase).toBe('playing')
    expect(g.state.cycle).toBe('night')
    expect(g.state.players.map(p => p.name)).toEqual(['Alice', 'Bob', 'Chloé'])
  })

  it('refuses duplicate seats', () => {
    const g = new Game(['villageois', 'villageois', 'loup_garou'])
    g.do({ type: 'RESET_GAME' })
    expect(() => g.do({ type: 'SETUP_GAME', players: [
      { name: 'A', roleId: 'villageois', seatNumber: 1 },
      { name: 'B', roleId: 'villageois', seatNumber: 1 },
      { name: 'C', roleId: 'loup_garou', seatNumber: 2 }
    ] })).toThrow(RuleError)
  })
})

describe('cascading deaths', () => {
  it('kills the other lover of grief', () => {
    const g = new Game(['loup_garou', 'villageois', 'villageois', 'villageois', 'villageois'])
    g.do({ type: 'TOGGLE_LOVER', playerId: g.id(2) }, { type: 'TOGGLE_LOVER', playerId: g.id(3) })
    g.do({ type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: g.id(2) }).dawn()
    expect(g.player(2).isAlive).toBe(false)
    expect(g.player(3).deathReason).toBe('chagrin')
    expect(g.state.dawnDeathIds).toEqual([g.id(2), g.id(3)])
  })

  it('lets a hunter who dies of grief shoot, and blocks nightfall until then', () => {
    const g = new Game(['loup_garou', 'chasseur', 'villageois', 'villageois', 'villageois', 'loup_garou'])
    g.do({ type: 'TOGGLE_LOVER', playerId: g.id(2) }, { type: 'TOGGLE_LOVER', playerId: g.id(3) })
    g.dawn()
    g.do({ type: 'ELIMINATE_BY_VOTE', playerId: g.id(3) })
    expect(g.player(2).deathReason).toBe('chagrin')
    expect(g.state.pendingHunterShotPlayerId).toBe(g.id(2))
    expect(() => g.do({ type: 'ADVANCE_TO_NIGHT' })).toThrow(RuleError)
    g.do({ type: 'EXECUTE_HUNTER_SHOT', targetPlayerId: g.id(1) })
    expect(g.player(1).deathReason).toBe('chasseur')
    expect(g.state.pendingHunterShotPlayerId).toBeUndefined()
  })

  it('waits for the hunter shot before declaring the wolves winners', () => {
    const g = new Game(['loup_garou', 'chasseur', 'villageois'])
    g.do({ type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: g.id(2) }).dawn()
    expect(g.state.phase).toBe('playing')
    g.do({ type: 'EXECUTE_HUNTER_SHOT', targetPlayerId: g.id(1) })
    expect(g.state.phase).toBe('game_over')
    expect(g.state.winner).toBe('village')
  })

  it('hands the captaincy over when the captain dies', () => {
    const g = new Game(['loup_garou', 'villageois', 'villageois', 'villageois', 'villageois'])
    g.dawn().do({ type: 'ASSIGN_CAPTAIN', playerId: g.id(2) }, { type: 'ELIMINATE_BY_VOTE', playerId: g.id(2) })
    expect(g.state.pendingCaptainSuccessor).toBe(true)
    g.do({ type: 'ASSIGN_CAPTAIN_SUCCESSOR', newCaptainId: g.id(3) })
    expect(g.player(3).isCaptain).toBe(true)
    expect(g.state.pendingCaptainSuccessor).toBe(false)
  })
})

describe('ancien', () => {
  it('survives the first wolf attack only', () => {
    const g = new Game(['loup_garou', 'ancien', 'villageois', 'villageois', 'villageois'])
    g.do({ type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: g.id(2) }).dawn()
    expect(g.player(2).isAlive).toBe(true)
    g.do({ type: 'ADVANCE_TO_NIGHT' }, { type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: g.id(2) }).dawn()
    expect(g.player(2).isAlive).toBe(false)
  })

  it('strips village powers when voted out', () => {
    const g = new Game(['loup_garou', 'ancien', 'voyante', 'villageois', 'villageois', 'villageois'])
    g.dawn().do({ type: 'ELIMINATE_BY_VOTE', playerId: g.id(2) }, { type: 'ADVANCE_TO_NIGHT' })
    expect(g.state.villagePowersDisabled).toBe(true)
    expect(getNightSteps(g.state).map(s => s.id)).not.toContain('voyante')
  })
})

describe('ange', () => {
  it('wins when voted out on day 1', () => {
    const g = new Game(['loup_garou', 'ange', 'villageois', 'villageois', 'villageois'])
    g.dawn().do({ type: 'ELIMINATE_BY_VOTE', playerId: g.id(2) })
    expect(g.state.winner).toBe('ange')
    expect(g.state.phase).toBe('game_over')
  })

  it('does not win on a later day', () => {
    const g = new Game(['loup_garou', 'ange', 'villageois', 'villageois', 'villageois', 'villageois'])
    g.dawn().do({ type: 'ADVANCE_TO_NIGHT' }).dawn().do({ type: 'ELIMINATE_BY_VOTE', playerId: g.id(2) })
    expect(g.state.angelWon).toBe(false)
  })
})

describe('night roles', () => {
  it('salvateur protects, and not twice in a row', () => {
    const g = new Game(['loup_garou', 'salvateur', 'villageois', 'villageois', 'villageois'])
    g.do({ type: 'SET_NIGHT_TARGET', key: 'salvateurTargetId', playerId: g.id(3) },
      { type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: g.id(3) }).dawn()
    expect(g.player(3).isAlive).toBe(true)
    g.do({ type: 'ADVANCE_TO_NIGHT' })
    expect(() => g.do({ type: 'SET_NIGHT_TARGET', key: 'salvateurTargetId', playerId: g.id(3) })).toThrow(RuleError)
  })

  it('corbeau starts the vote with two votes', () => {
    const g = new Game(['loup_garou', 'corbeau', 'villageois', 'villageois', 'villageois'])
    g.do({ type: 'SET_NIGHT_TARGET', key: 'corbeauTargetId', playerId: g.id(4) }).dawn()
    expect(g.state.vote.accusedIds).toEqual([g.id(4)])
    expect(g.state.vote.votes[g.id(4)]).toBe(2)
  })

  it('witch saves and poisons, each potion once', () => {
    const g = new Game(['loup_garou', 'sorciere', 'villageois', 'villageois', 'villageois', 'villageois'])
    g.do({ type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: g.id(3) },
      { type: 'SET_WITCH_HEAL', saved: true },
      { type: 'SET_NIGHT_TARGET', key: 'witchKillTargetId', playerId: g.id(1) }).dawn()
    expect(g.player(3).isAlive).toBe(true)
    expect(g.player(1).deathReason).toBe('sorciere')
    expect(g.state.night.witchHealUsed && g.state.night.witchKillUsed).toBe(true)
  })

  it('infects instead of killing, once per game', () => {
    const g = new Game(['infect_pere_des_loups', 'loup_garou', 'villageois', 'villageois', 'villageois', 'villageois', 'villageois'])
    g.do({ type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: g.id(3) }, { type: 'SET_INFECT_VICTIM', infect: true }).dawn()
    expect(g.player(3).isAlive).toBe(true)
    expect(g.player(3).isInfected).toBe(true)
    g.do({ type: 'ADVANCE_TO_NIGHT' }, { type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: g.id(4) })
    expect(() => g.do({ type: 'SET_INFECT_VICTIM', infect: true })).toThrow(RuleError)
  })

  it('rusty sword knight wounds the next wolf, who dies the following dawn', () => {
    const g = new Game(['villageois', 'chevalier_epee_rouillee', 'villageois', 'loup_garou', 'villageois', 'loup_garou', 'villageois'])
    g.do({ type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: g.id(2) }).dawn()
    expect(g.player(4).isAlive).toBe(true)
    g.do({ type: 'ADVANCE_TO_NIGHT' }).dawn()
    expect(g.player(4).deathReason).toBe('epee_rouillee')
  })

  it('fox loses its power when no wolf is sniffed', () => {
    const g = new Game(['renard', 'villageois', 'villageois', 'villageois', 'loup_garou', 'villageois'])
    g.do({ type: 'SET_NIGHT_TARGET', key: 'foxTargetId', playerId: g.id(2) }, { type: 'COMPLETE_NIGHT_STEP', stepId: 'renard' })
    expect(g.player(1).foxLostPower).toBe(true)
  })

  it('charms at most two players a night', () => {
    const g = new Game(['joueur_de_flute', 'villageois', 'villageois', 'villageois', 'loup_garou'])
    g.do({ type: 'TOGGLE_CHARMED_TONIGHT', playerId: g.id(2) }, { type: 'TOGGLE_CHARMED_TONIGHT', playerId: g.id(3) })
    expect(() => g.do({ type: 'TOGGLE_CHARMED_TONIGHT', playerId: g.id(4) })).toThrow(RuleError)
  })
})

describe('timer', () => {
  it('pauses and resumes from the remaining time', () => {
    const g = new Game(['loup_garou', 'villageois', 'villageois']).dawn()
    g.do({ type: 'START_TIMER', durationSeconds: 120 })
    expect(g.state.timer.endsAt).toBe(g.now + 120_000)
    g.now += 30_000
    g.do({ type: 'PAUSE_TIMER' })
    expect(g.state.timer.pausedRemaining).toBe(90)
    g.now += 500_000
    g.do({ type: 'START_TIMER' })
    expect(g.state.timer.endsAt).toBe(g.now + 90_000)
  })
})

describe('victory', () => {
  it('reopens the game if a correction revives a player', () => {
    const g = new Game(['loup_garou', 'villageois', 'villageois'])
    g.do({ type: 'TOGGLE_LIFE', playerId: g.id(1) })
    expect(g.state.winner).toBe('village')
    g.do({ type: 'TOGGLE_LIFE', playerId: g.id(1) })
    expect(g.state.phase).toBe('playing')
  })

  it('keeps playing while the white wolf still has packmates', () => {
    const g = new Game(['loup_blanc', 'loup_garou', 'villageois'])
    g.do({ type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: g.id(3) }).dawn()
    expect(g.state.phase).toBe('playing')
  })
})

describe('ancien', () => {
  it('takes the village powers away when the witch poisons him', () => {
    const g = new Game(['loup_garou', 'ancien', 'sorciere', 'chasseur', 'villageois'])
    g.do({ type: 'SET_NIGHT_TARGET', key: 'witchKillTargetId', playerId: g.id(2) }).dawn()
    expect(g.player(2).isAlive).toBe(false)
    expect(g.state.villagePowersDisabled).toBe(true)
  })

  it('keeps the powers when the wolves finally eat him', () => {
    const g = new Game(['loup_garou', 'ancien', 'villageois', 'villageois', 'villageois'])
    g.do({ type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: g.id(2) }).dawn()
    g.do({ type: 'ADVANCE_TO_NIGHT' }, { type: 'SET_NIGHT_TARGET', key: 'wolfVictimId', playerId: g.id(2) }).dawn()
    expect(g.player(2).isAlive).toBe(false)
    expect(g.state.villagePowersDisabled).toBe(false)
  })
})

describe('voleur', () => {
  const setup = (cards: RoleId[]) => {
    const g = new Game(['villageois', 'villageois', 'loup_garou'])
    g.do({ type: 'RESET_GAME' }, { type: 'SETUP_GAME', thiefCards: cards, players: [
      { name: 'A', roleId: 'voleur', seatNumber: 1 },
      { name: 'B', roleId: 'loup_garou', seatNumber: 2 },
      { name: 'C', roleId: 'villageois', seatNumber: 3 },
      { name: 'D', roleId: 'villageois', seatNumber: 4 },
      { name: 'E', roleId: 'villageois', seatNumber: 5 },
      { name: 'F', roleId: 'villageois', seatNumber: 6 }
    ] })
    return g
  }

  it('wakes first on night 1 and plays the card he took', () => {
    const g = setup(['voyante', 'villageois'])
    expect(getNightSteps(g.state)[0].id).toBe('voleur')
    g.do({ type: 'THIEF_SWAP', roleId: 'voyante' }, { type: 'COMPLETE_NIGHT_STEP', stepId: 'voleur' })
    expect(g.player(1).roleId).toBe('voyante')
    expect(getNightSteps(g.state).map(s => s.id)).toContain('voyante')
    expect(g.state.composition).toHaveLength(8)
  })

  it('must take a wolf when both cards are wolves', () => {
    const g = setup(['loup_garou', 'grand_mechant_loup'])
    expect(() => g.do({ type: 'COMPLETE_NIGHT_STEP', stepId: 'voleur' })).toThrow(RuleError)
    expect(() => g.do({ type: 'THIEF_SWAP', roleId: 'voyante' })).toThrow(RuleError)
    g.do({ type: 'THIEF_SWAP', roleId: 'loup_garou' }, { type: 'COMPLETE_NIGHT_STEP', stepId: 'voleur' })
    expect(g.player(1).roleId).toBe('loup_garou')
  })

  it('needs the two cards at setup', () => {
    expect(() => setup([])).toThrow(RuleError)
  })
})

describe('idiot du village', () => {
  it('survives the first vote, revealed, and dies on the second', () => {
    const g = new Game(['loup_garou', 'idiot_du_village', 'villageois', 'villageois', 'villageois'])
    g.dawn().do({ type: 'ELIMINATE_BY_VOTE', playerId: g.id(2) })
    expect(g.player(2).isAlive).toBe(true)
    expect(g.player(2).idiotRevealed).toBe(true)
    g.do({ type: 'ADVANCE_TO_NIGHT' }).dawn().do({ type: 'ELIMINATE_BY_VOTE', playerId: g.id(2) })
    expect(g.player(2).isAlive).toBe(false)
  })
})

describe('bouc émissaire', () => {
  it('dies on a tie', () => {
    const g = new Game(['loup_garou', 'bouc_emissaire', 'villageois', 'villageois', 'villageois'])
    g.dawn().do({ type: 'SCAPEGOAT' })
    expect(g.player(2).deathReason).toBe('bouc')
  })
})

describe('servante dévouée', () => {
  it('takes the role of the condemned, who is revealed as the servant', () => {
    const g = new Game(['loup_garou', 'servante_devouee', 'chasseur', 'villageois', 'villageois', 'loup_garou'])
    g.dawn().do({ type: 'ELIMINATE_BY_VOTE', playerId: g.id(3) })
    expect(g.state.pendingHunterShotPlayerId).toBe(g.id(3))
    g.do({ type: 'SERVANT_TAKE_ROLE' })
    expect(g.player(2).roleId).toBe('chasseur')
    expect(g.player(3).roleId).toBe('servante_devouee')
    expect(g.state.pendingHunterShotPlayerId).toBeUndefined()
  })

  it('cannot act without a vote today, or while in love', () => {
    const g = new Game(['loup_garou', 'servante_devouee', 'villageois', 'villageois', 'villageois'])
    g.dawn()
    expect(() => g.do({ type: 'SERVANT_TAKE_ROLE' })).toThrow(RuleError)
    g.do({ type: 'TOGGLE_LOVER', playerId: g.id(2) }, { type: 'ELIMINATE_BY_VOTE', playerId: g.id(4) })
    expect(() => g.do({ type: 'SERVANT_TAKE_ROLE' })).toThrow(RuleError)
  })
})

describe('juge bègue', () => {
  it('calls a second vote once per game', () => {
    const g = new Game(['loup_garou', 'juge_begue', 'villageois', 'villageois', 'villageois', 'villageois', 'loup_garou'])
    g.dawn().do({ type: 'ELIMINATE_BY_VOTE', playerId: g.id(3) }, { type: 'JUDGE_SECOND_VOTE' })
    g.do({ type: 'ACCUSE', playerId: g.id(4) }, { type: 'ELIMINATE_BY_VOTE', playerId: g.id(4) })
    expect(g.player(4).isAlive).toBe(false)
    expect(() => g.do({ type: 'JUDGE_SECOND_VOTE' })).toThrow(RuleError)
  })
})

describe('carte personnalisée', () => {
  it('wakes with the step written at setup', () => {
    const g = new Game(['villageois', 'villageois', 'loup_garou'])
    g.do({ type: 'RESET_GAME' }, { type: 'SETUP_GAME', customStep: { title: 'Le Sectaire', spokenPrompt: 'Le Sectaire se réveille.', firstNightOnly: true }, players: [
      { name: 'A', roleId: 'carte_vierge', seatNumber: 1 },
      { name: 'B', roleId: 'loup_garou', seatNumber: 2 },
      { name: 'C', roleId: 'villageois', seatNumber: 3 }
    ] })
    expect(getNightSteps(g.state).find(s => s.id === 'carte_vierge')?.title).toBe('Le Sectaire')
    g.dawn().do({ type: 'ADVANCE_TO_NIGHT' })
    expect(getNightSteps(g.state).some(s => s.id === 'carte_vierge')).toBe(false)
  })
})

describe('timer', () => {
  it('adds or removes time whether running, paused or stopped, never below zero', () => {
    const g = new Game(['loup_garou', 'villageois', 'villageois', 'villageois'])
    g.dawn().do({ type: 'ADJUST_TIMER', seconds: 30 })
    expect(g.state.timer.pausedRemaining).toBe(210)
    g.do({ type: 'START_TIMER' }, { type: 'ADJUST_TIMER', seconds: -30 })
    expect(g.state.timer.endsAt).toBe(g.now + 180_000)
    g.do({ type: 'ADJUST_TIMER', seconds: -600 })
    expect(g.state.timer.endsAt).toBe(g.now)
    g.do({ type: 'RESET_TIMER' }, { type: 'START_TIMER' }, { type: 'PAUSE_TIMER' }, { type: 'ADJUST_TIMER', seconds: -600 })
    expect(g.state.timer.pausedRemaining).toBe(0)
  })
})
