import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { GameState, Player, RoleId, LogEntry, NightState } from '../types/game'
import { ROLES_BEST_OF } from '../data/roles'
import { getBearGrowlStatus } from '../utils/gameHelpers'

interface GameContextType {
  state: GameState
  setupGame: (configuredPlayers: { name: string; roleId: RoleId; seatNumber: number }[]) => void
  resetToSetup: () => void
  togglePlayerLife: (playerId: string, reason?: Player['deathReason']) => void
  togglePlayerLover: (playerId: string) => void
  togglePlayerCharmed: (playerId: string) => void
  setPlayerInfected: (playerId: string, isInfected: boolean) => void
  setPlayerCaptain: (playerId: string) => void
  setWildChildModel: (childId: string, modelId: string) => void
  setDogWolfChoice: (playerId: string, choice: 'village' | 'loup') => void
  setFoxLostPower: (playerId: string, lost: boolean) => void
  advanceToDay: () => void
  advanceToNight: () => void
  setNightData: <K extends keyof NightState>(key: K, value: NightState[K]) => void
  completeNightStep: (stepId: string) => void
  startTimer: () => void
  pauseTimer: () => void
  resetTimer: (newDuration?: number) => void
  setTimerSeconds: (seconds: number) => void
  addLog: (message: string, type?: LogEntry['type']) => void
  undoLastDeath: () => void
  executeHunterShot: (targetPlayerId: string) => void
  assignCaptainSuccessor: (newCaptainId: string) => void
}

const STORAGE_KEY = 'thiercelieux_best_of_state_v2'

const initialNightState: NightState = {
  currentStepIndex: 0,
  completedSteps: {},
  infectionUsedThisGame: false,
  witchHealUsed: false,
  witchKillUsed: false,
  witchSavedVictim: false,
  charmedTonightIds: []
}

const initialGameState: GameState = {
  phase: 'setup',
  cycle: 'night',
  roundNumber: 1,
  players: [],
  night: initialNightState,
  logs: [],
  timerDuration: 180,
  timerRemaining: 180,
  isTimerRunning: false,
  villagePowersDisabled: false,
  pendingHunterShotPlayerId: undefined,
  pendingCaptainSuccessor: false,
  angelWon: false
}

const GameContext = createContext<GameContextType | undefined>(undefined)

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<GameState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (e) {
      console.error('Erreur chargement localStorage', e)
    }
    return initialGameState
  })

  // Auto-save

  // --- Network Sync ---
  useEffect(() => {
    // @ts-ignore
    if (import.meta.hot) {
      // @ts-ignore
      import.meta.hot.on('lg:sync-state', (data) => {
        // Prevent infinite loop by not updating if identical
        setState(prevState => {
          if (JSON.stringify(prevState) !== JSON.stringify(data.state)) {
            return data.state;
          }
          return prevState;
        });
      });
    }
  }, []);

  useEffect(() => {
    // @ts-ignore
    if (import.meta.hot) {
      // @ts-ignore
      import.meta.hot.send('lg:sync-state', { state });
    }
  }, [state]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (e) {
      console.error('Erreur sauvegarde localStorage', e)
    }
  }, [state])

  // Timer interval
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null
    if (state.isTimerRunning && state.timerRemaining > 0) {
      interval = setInterval(() => {
        setState(prev => {
          if (prev.timerRemaining <= 1) {
            /* disabled auto gong */
            return { ...prev, timerRemaining: 0, isTimerRunning: false }
          }
          return { ...prev, timerRemaining: prev.timerRemaining - 1 }
        })
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [state.isTimerRunning, state.timerRemaining])

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const turnLabel = `${state.cycle === 'night' ? 'Nuit' : 'Jour'} ${state.roundNumber}`
    const newEntry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      turnLabel,
      message,
      type
    }
    setState(prev => ({
      ...prev,
      logs: [newEntry, ...prev.logs]
    }))
  }

  const setupGame = (configuredPlayers: { name: string; roleId: RoleId; seatNumber: number }[]) => {
    const players: Player[] = configuredPlayers.map((p, idx) => ({
      id: `p-${idx + 1}-${Math.random().toString(36).substring(2, 6)}`,
      name: p.name.trim() || `Joueur ${idx + 1}`,
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

    const newState: GameState = {
      ...initialGameState,
      phase: 'playing',
      cycle: 'night',
      roundNumber: 1,
      players,
      night: { ...initialNightState },
      logs: [
        {
          id: 'init-1',
          time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          turnLabel: 'Ouverture',
          message: `Partie ouverte avec ${players.length} villageois. Thiercelieux s'endort pour la Nuit 1.`,
          type: 'turn'
        }
      ]
    }
    setState(newState)
    /* disabled auto wolf howl */
  }

  const resetToSetup = () => {
    if (window.confirm('Voulez-vous vraiment clore cette partie et retourner au paramétrage ?')) {
      setState(initialGameState)
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  const togglePlayerLife = (playerId: string, reason?: Player['deathReason']) => {
    setState(prev => {
      const turnLabel = `${prev.cycle === 'night' ? 'Nuit' : 'Jour'} ${prev.roundNumber}`
      let logsToAdd: LogEntry[] = []
      let pendingHunter = prev.pendingHunterShotPlayerId
      let pendingCaptain = prev.pendingCaptainSuccessor
      let angelWon = prev.angelWon
      let villagePowersDisabled = prev.villagePowersDisabled

      const targetPlayer = prev.players.find(p => p.id === playerId)
      if (!targetPlayer) return prev

      const willBeAlive = !targetPlayer.isAlive

      if (!willBeAlive) {
        /* disabled auto death bell */
        const roleName = ROLES_BEST_OF[targetPlayer.roleId].name
        logsToAdd.push({
          id: Math.random().toString(36).substring(2, 9),
          time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          turnLabel,
          message: `${targetPlayer.name} (${roleName}) a été éliminé (${reason || 'décision du MJ'}).`,
          type: 'death'
        })

        // Check Angel win condition: eliminated Day 1 by village vote!
        if (targetPlayer.roleId === 'ange' && prev.cycle === 'day' && prev.roundNumber === 1 && reason === 'vote') {
          angelWon = true
          logsToAdd.push({
            id: Math.random().toString(36).substring(2, 9),
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            turnLabel,
            message: `L'Ange (${targetPlayer.name}) a été éliminé lors du 1er vote du village. Victoire éclatante de l'Ange !`,
            type: 'alert'
          })
        }

        // Check Hunter death trigger
        if (targetPlayer.roleId === 'chasseur') {
          pendingHunter = targetPlayer.id
          logsToAdd.push({
            id: Math.random().toString(36).substring(2, 9),
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            turnLabel,
            message: `Le Chasseur (${targetPlayer.name}) est mort. Il doit tirer son coup de fusil ultime !`,
            type: 'alert'
          })
        }

        // Check Captain death trigger
        if (targetPlayer.isCaptain) {
          pendingCaptain = true
          logsToAdd.push({
            id: Math.random().toString(36).substring(2, 9),
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            turnLabel,
            message: `Le Capitaine (${targetPlayer.name}) a succombé. Il doit désigner son successeur !`,
            type: 'alert'
          })
        }

        // Check Ancien death by vote penalty
        if (targetPlayer.roleId === 'ancien' && reason === 'vote') {
          villagePowersDisabled = true
          logsToAdd.push({
            id: Math.random().toString(36).substring(2, 9),
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            turnLabel,
            message: `Sacrilège : Le village a voté contre l'Ancien ! Tous les villageois perdent leurs pouvoirs !`,
            type: 'alert'
          })
        }
      } else {
        logsToAdd.push({
          id: Math.random().toString(36).substring(2, 9),
          time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          turnLabel,
          message: `${targetPlayer.name} a été réintégré par le Meneur de Jeu.`,
          type: 'info'
        })
      }

      const updatedPlayers = prev.players.map(p => {
        if (p.id === playerId) {
          return {
            ...p,
            isAlive: willBeAlive,
            deathReason: willBeAlive ? undefined : (reason || 'autre'),
            deathRound: willBeAlive ? undefined : turnLabel,
            isCaptain: willBeAlive ? p.isCaptain : false
          }
        }
        return p
      })

      // Lover collateral death
      if (!willBeAlive && targetPlayer.isLover) {
        updatedPlayers.forEach((p, idx) => {
          if (p.id !== playerId && p.isLover && p.isAlive) {
            updatedPlayers[idx] = {
              ...p,
              isAlive: false,
              deathReason: 'chagrin',
              deathRound: turnLabel
            }
            logsToAdd.push({
              id: Math.random().toString(36).substring(2, 9),
              time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
              turnLabel,
              message: `${p.name} meurt de désespoir suite à la disparition de sa moitié.`,
              type: 'death'
            })
          }
        })
      }

      // Wild Child transformation
      if (!willBeAlive) {
        updatedPlayers.forEach(p => {
          if (p.roleId === 'enfant_sauvage' && p.wildChildModelId === playerId) {
            logsToAdd.push({
              id: Math.random().toString(36).substring(2, 9),
              time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
              turnLabel,
              message: `Le modèle de ${p.name} (Enfant Sauvage) a péri. Il rejoint la meute des Loups-Garous.`,
              type: 'alert'
            })
          }
        })
      }

      return {
        ...prev,
        players: updatedPlayers,
        pendingHunterShotPlayerId: pendingHunter,
        pendingCaptainSuccessor: pendingCaptain,
        angelWon,
        villagePowersDisabled,
        logs: [...logsToAdd, ...prev.logs]
      }
    })
  }

  // Hunter shot action
  const executeHunterShot = (targetPlayerId: string) => {
    setState(prev => {
      const turnLabel = `${prev.cycle === 'night' ? 'Nuit' : 'Jour'} ${prev.roundNumber}`
      const target = prev.players.find(p => p.id === targetPlayerId)
      if (!target) return prev

      /* disabled auto gunshot */

      const updatedPlayers = prev.players.map(p =>
        p.id === targetPlayerId
          ? { ...p, isAlive: false, deathReason: 'chasseur' as const, deathRound: turnLabel }
          : p
      )

      return {
        ...prev,
        players: updatedPlayers,
        pendingHunterShotPlayerId: undefined,
        logs: [
          {
            id: Math.random().toString(36).substring(2, 9),
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            turnLabel,
            message: `Tir du Chasseur : ${target.name} (${ROLES_BEST_OF[target.roleId].name}) a été abattu d'une balle !`,
            type: 'death'
          },
          ...prev.logs
        ]
      }
    })
  }

  // Captain successor assignment
  const assignCaptainSuccessor = (newCaptainId: string) => {
    setState(prev => {
      const newCaptain = prev.players.find(p => p.id === newCaptainId)
      if (!newCaptain) return prev

      const updatedPlayers = prev.players.map(p => ({
        ...p,
        isCaptain: p.id === newCaptainId
      }))

      return {
        ...prev,
        players: updatedPlayers,
        pendingCaptainSuccessor: false,
        logs: [
          {
            id: Math.random().toString(36).substring(2, 9),
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            turnLabel: `${prev.cycle === 'night' ? 'Nuit' : 'Jour'} ${prev.roundNumber}`,
            message: `${newCaptain.name} hérite de la médaille de Capitaine !`,
            type: 'power'
          },
          ...prev.logs
        ]
      }
    })
  }

  const undoLastDeath = () => {
    setState(prev => {
      const deadPlayers = prev.players.filter(p => !p.isAlive)
      if (deadPlayers.length === 0) return prev

      const lastDead = deadPlayers[deadPlayers.length - 1]
      const updatedPlayers = prev.players.map(p =>
        p.id === lastDead.id ? { ...p, isAlive: true, deathReason: undefined, deathRound: undefined } : p
      )

      return {
        ...prev,
        players: updatedPlayers,
        pendingHunterShotPlayerId: lastDead.roleId === 'chasseur' ? undefined : prev.pendingHunterShotPlayerId,
        pendingCaptainSuccessor: lastDead.isCaptain ? false : prev.pendingCaptainSuccessor,
        logs: [
          {
            id: Math.random().toString(36).substring(2, 9),
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            turnLabel: `${prev.cycle === 'night' ? 'Nuit' : 'Jour'} ${prev.roundNumber}`,
            message: `Correction : ${lastDead.name} est rétabli en vie.`,
            type: 'info'
          },
          ...prev.logs
        ]
      }
    })
  }

  const togglePlayerLover = (playerId: string) => {
    setState(prev => ({
      ...prev,
      players: prev.players.map(p => p.id === playerId ? { ...p, isLover: !p.isLover } : p)
    }))
  }

  const togglePlayerCharmed = (playerId: string) => {
    setState(prev => ({
      ...prev,
      players: prev.players.map(p => p.id === playerId ? { ...p, isCharmed: !p.isCharmed } : p)
    }))
  }

  const setPlayerInfected = (playerId: string, isInfected: boolean) => {
    setState(prev => ({
      ...prev,
      players: prev.players.map(p => p.id === playerId ? { ...p, isInfected } : p)
    }))
  }

  const setPlayerCaptain = (playerId: string) => {
    setState(prev => {
      const target = prev.players.find(p => p.id === playerId)
      const willBeCaptain = !target?.isCaptain
      return {
        ...prev,
        players: prev.players.map(p => p.id === playerId ? { ...p, isCaptain: willBeCaptain } : { ...p, isCaptain: false }),
        logs: willBeCaptain ? [
          {
            id: Math.random().toString(36).substring(2, 9),
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            turnLabel: `${prev.cycle === 'night' ? 'Nuit' : 'Jour'} ${prev.roundNumber}`,
            message: `${target?.name} est élu Capitaine du village (son vote compte double).`,
            type: 'power'
          },
          ...prev.logs
        ] : prev.logs
      }
    })
  }

  const setWildChildModel = (childId: string, modelId: string) => {
    setState(prev => {
      const child = prev.players.find(p => p.id === childId)
      const model = prev.players.find(p => p.id === modelId)
      return {
        ...prev,
        players: prev.players.map(p => p.id === childId ? { ...p, wildChildModelId: modelId } : p),
        logs: [
          {
            id: Math.random().toString(36).substring(2, 9),
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            turnLabel: `Nuit ${prev.roundNumber}`,
            message: `${child?.name} (Enfant Sauvage) a choisi ${model?.name} comme modèle secret.`,
            type: 'power'
          },
          ...prev.logs
        ]
      }
    })
  }

  const setDogWolfChoice = (playerId: string, choice: 'village' | 'loup') => {
    setState(prev => {
      const player = prev.players.find(p => p.id === playerId)
      return {
        ...prev,
        players: prev.players.map(p => p.id === playerId ? { ...p, dogWolfChoice: choice } : p),
        logs: [
          {
            id: Math.random().toString(36).substring(2, 9),
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            turnLabel: `Nuit ${prev.roundNumber}`,
            message: `${player?.name} (Chien-Loup) a prêté allégeance : ${choice === 'loup' ? 'Meute des Loups' : 'Village'}.`,
            type: 'power'
          },
          ...prev.logs
        ]
      }
    })
  }

  const setFoxLostPower = (playerId: string, lost: boolean) => {
    setState(prev => ({
      ...prev,
      players: prev.players.map(p => p.id === playerId ? { ...p, foxLostPower: lost } : p)
    }))
  }

  const setNightData = <K extends keyof NightState>(key: K, value: NightState[K]) => {
    setState(prev => ({
      ...prev,
      night: {
        ...prev.night,
        [key]: value
      }
    }))
  }

  const completeNightStep = (stepId: string) => {
    setState(prev => ({
      ...prev,
      night: {
        ...prev.night,
        completedSteps: {
          ...prev.night.completedSteps,
          [stepId]: true
        }
      }
    }))
  }

  // Morning transition
  const advanceToDay = () => {
    setState(prev => {
      const turnLabel = `Nuit ${prev.roundNumber}`
      const newLogs: LogEntry[] = []
      let updatedPlayers = [...prev.players]
      let pendingHunter = prev.pendingHunterShotPlayerId
      let pendingCaptain = prev.pendingCaptainSuccessor

      // 1. Wolf victim
      const wolfVictimId = prev.night.wolfVictimId
      const savedByWitch = prev.night.witchSavedVictim
      const infected = prev.night.infectedVictimId

      if (wolfVictimId) {
        const victim = updatedPlayers.find(p => p.id === wolfVictimId)
        if (victim) {
          if (infected === wolfVictimId) {
            updatedPlayers = updatedPlayers.map(p => p.id === wolfVictimId ? { ...p, isInfected: true } : p)
            newLogs.push({
              id: Math.random().toString(36).substring(2, 9),
              time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
              turnLabel,
              message: `${victim.name} a été secrètement infecté par le Père des Loups cette nuit.`,
              type: 'power'
            })
          } else if (savedByWitch) {
            newLogs.push({
              id: Math.random().toString(36).substring(2, 9),
              time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
              turnLabel,
              message: `La Sorcière a utilisé sa potion de guérison pour sauver ${victim.name}.`,
              type: 'power'
            })
          } else if (victim.roleId === 'ancien' && victim.elderLives > 1) {
            updatedPlayers = updatedPlayers.map(p => p.id === wolfVictimId ? { ...p, elderLives: p.elderLives - 1 } : p)
            newLogs.push({
              id: Math.random().toString(36).substring(2, 9),
              time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
              turnLabel,
              message: `L'Ancien (${victim.name}) résiste à l'assaut des loups (1 vie restante).`,
              type: 'alert'
            })
          } else {
            updatedPlayers = updatedPlayers.map(p => p.id === wolfVictimId ? { ...p, isAlive: false, deathReason: 'loups', deathRound: turnLabel } : p)
            if (victim.roleId === 'chasseur') pendingHunter = victim.id
            if (victim.isCaptain) pendingCaptain = true
            newLogs.push({
              id: Math.random().toString(36).substring(2, 9),
              time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
              turnLabel,
              message: `${victim.name} (${ROLES_BEST_OF[victim.roleId].name}) a été dévoré par les loups.`,
              type: 'death'
            })
          }
        }
      }

      // 2. Grand Méchant Loup
      const gmlVictimId = prev.night.gmlVictimId
      if (gmlVictimId) {
        const gmlVictim = updatedPlayers.find(p => p.id === gmlVictimId && p.isAlive)
        if (gmlVictim) {
          updatedPlayers = updatedPlayers.map(p => p.id === gmlVictimId ? { ...p, isAlive: false, deathReason: 'gml', deathRound: turnLabel } : p)
          if (gmlVictim.roleId === 'chasseur') pendingHunter = gmlVictim.id
          if (gmlVictim.isCaptain) pendingCaptain = true
          newLogs.push({
            id: Math.random().toString(36).substring(2, 9),
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            turnLabel,
            message: `${gmlVictim.name} a été dévoré par le Grand Méchant Loup.`,
            type: 'death'
          })
        }
      }

      // 3. Witch kill
      const witchKillId = prev.night.witchKillTargetId
      if (witchKillId) {
        const witchVictim = updatedPlayers.find(p => p.id === witchKillId && p.isAlive)
        if (witchVictim) {
          updatedPlayers = updatedPlayers.map(p => p.id === witchKillId ? { ...p, isAlive: false, deathReason: 'sorciere', deathRound: turnLabel } : p)
          if (witchVictim.roleId === 'chasseur') pendingHunter = witchVictim.id
          if (witchVictim.isCaptain) pendingCaptain = true
          newLogs.push({
            id: Math.random().toString(36).substring(2, 9),
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            turnLabel,
            message: `${witchVictim.name} a succombé au poison de la Sorcière.`,
            type: 'death'
          })
        }
      }

      // 4. White Werewolf
      const whiteWolfKillId = prev.night.whiteWolfTargetId
      if (whiteWolfKillId) {
        const wwVictim = updatedPlayers.find(p => p.id === whiteWolfKillId && p.isAlive)
        if (wwVictim) {
          updatedPlayers = updatedPlayers.map(p => p.id === whiteWolfKillId ? { ...p, isAlive: false, deathReason: 'loup_blanc', deathRound: turnLabel } : p)
          if (wwVictim.roleId === 'chasseur') pendingHunter = wwVictim.id
          if (wwVictim.isCaptain) pendingCaptain = true
          newLogs.push({
            id: Math.random().toString(36).substring(2, 9),
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            turnLabel,
            message: `${wwVictim.name} a été égorgé par le Loup-Garou Blanc.`,
            type: 'death'
          })
        }
      }

      // 5. Lovers
      const deadLovers = updatedPlayers.filter(p => p.isLover && !p.isAlive)
      if (deadLovers.length > 0) {
        updatedPlayers.forEach((p, idx) => {
          if (p.isLover && p.isAlive) {
            updatedPlayers[idx] = { ...p, isAlive: false, deathReason: 'chagrin', deathRound: turnLabel }
            if (p.roleId === 'chasseur') pendingHunter = p.id
            if (p.isCaptain) pendingCaptain = true
            newLogs.push({
              id: Math.random().toString(36).substring(2, 9),
              time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
              turnLabel,
              message: `${p.name} meurt de désespoir suite à la disparition de sa moitié.`,
              type: 'death'
            })
          }
        })
      }

      // Bear check
      const bearStatus = getBearGrowlStatus(updatedPlayers)
      if (bearStatus.hasBear && bearStatus.isBearAlive) {
        if (bearStatus.growls) {
          newLogs.push({
            id: Math.random().toString(36).substring(2, 9),
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            turnLabel: `Jour ${prev.roundNumber}`,
            message: `Avis : L'ours grogne ce matin. Un loup est assis à ses côtés.`,
            type: 'alert'
          })
        } else {
          newLogs.push({
            id: Math.random().toString(36).substring(2, 9),
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            turnLabel: `Jour ${prev.roundNumber}`,
            message: `L'ours reste paisible ce matin.`,
            type: 'info'
          })
        }
      }

      return {
        ...prev,
        cycle: 'day',
        players: updatedPlayers,
        pendingHunterShotPlayerId: pendingHunter,
        pendingCaptainSuccessor: pendingCaptain,
        timerRemaining: prev.timerDuration,
        isTimerRunning: false,
        night: {
          ...prev.night,
          infectionUsedThisGame: prev.night.infectionUsedThisGame || !!prev.night.infectedVictimId,
          witchHealUsed: prev.night.witchHealUsed || prev.night.witchSavedVictim,
          witchKillUsed: prev.night.witchKillUsed || !!prev.night.witchKillTargetId,
          wolfVictimId: undefined,
          gmlVictimId: undefined,
          infectedVictimId: undefined,
          witchKillTargetId: undefined,
          witchSavedVictim: false,
          whiteWolfTargetId: undefined,
          charmedTonightIds: [],
          foxTargetId: undefined,
          seerTargetId: undefined,
          completedSteps: {},
          currentStepIndex: 0
        },
        logs: [
          {
            id: Math.random().toString(36).substring(2, 9),
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            turnLabel: `Jour ${prev.roundNumber}`,
            message: `L'aube se lève sur Thiercelieux. Le village se réveille.`,
            type: 'turn'
          },
          ...newLogs,
          ...prev.logs
        ]
      }
    })

    /* disabled auto rooster crow */
  }

  // Night transition
  const advanceToNight = () => {
    setState(prev => {
      const nextRound = prev.cycle === 'day' ? prev.roundNumber + 1 : prev.roundNumber
      return {
        ...prev,
        cycle: 'night',
        roundNumber: nextRound,
        isTimerRunning: false,
        night: {
          ...prev.night,
          completedSteps: {},
          currentStepIndex: 0
        },
        logs: [
          {
            id: Math.random().toString(36).substring(2, 9),
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            turnLabel: `Nuit ${nextRound}`,
            message: `Le crépuscule tombe sur Thiercelieux. Début de la Nuit ${nextRound}.`,
            type: 'turn'
          },
          ...prev.logs
        ]
      }
    })
    /* disabled auto wolf howl */
  }

  const startTimer = () => setState(prev => ({ ...prev, isTimerRunning: true }))
  const pauseTimer = () => setState(prev => ({ ...prev, isTimerRunning: false }))
  const resetTimer = (newDuration?: number) => {
    setState(prev => {
      const duration = newDuration ?? prev.timerDuration
      return {
        ...prev,
        timerDuration: duration,
        timerRemaining: duration,
        isTimerRunning: false
      }
    })
  }
  const setTimerSeconds = (seconds: number) => {
    setState(prev => ({
      ...prev,
      timerDuration: seconds,
      timerRemaining: seconds,
      isTimerRunning: false
    }))
  }

  return (
    <GameContext.Provider
      value={{
        state,
        setupGame,
        resetToSetup,
        togglePlayerLife,
        togglePlayerLover,
        togglePlayerCharmed,
        setPlayerInfected,
        setPlayerCaptain,
        setWildChildModel,
        setDogWolfChoice,
        setFoxLostPower,
        advanceToDay,
        advanceToNight,
        setNightData,
        completeNightStep,
        startTimer,
        pauseTimer,
        resetTimer,
        setTimerSeconds,
        addLog,
        undoLastDeath,
        executeHunterShot,
        assignCaptainSuccessor
      }}
    >
      {children}
    </GameContext.Provider>
  )
}

export const useGame = () => {
  const context = useContext(GameContext)
  if (!context) {
    throw new Error('useGame must be used within a GameProvider')
  }
  return context
}
