import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { initialGameState, reduce, RuleError } from '../shared/reducer'
import { ActionContext, GameAction, GameState } from '../shared/types'

type JournalEntry =
  | { kind: 'action'; action: GameAction; ctx: ActionContext }
  | { kind: 'undo' }
  | { kind: 'redo' }

/**
 * Canonical game state with unlimited undo/redo.
 * Every accepted change is appended to a JSONL journal; replaying it rebuilds the exact same history.
 * Each new game starts a fresh journal: the previous one is moved to `games/` next to it.
 */
export class GameStore {
  private past: GameState[] = []
  private future: GameState[] = []
  private current: GameState = structuredClone(initialGameState)
  private seq = 0

  constructor(private readonly journalPath?: string, private readonly clock: () => number = Date.now) {
    if (journalPath && existsSync(journalPath)) this.replay(journalPath)
  }

  get state(): GameState {
    return this.current
  }

  get canUndo(): boolean {
    return this.past.length > 0
  }

  get canRedo(): boolean {
    return this.future.length > 0
  }

  /** Applies an action; throws RuleError and leaves the state untouched if the rules refuse it. */
  dispatch(action: GameAction): GameState {
    const ctx: ActionContext = { now: this.clock(), seq: this.seq + 1 }
    this.applyAction(action, ctx)
    if (action.type === 'SETUP_GAME') this.archive(ctx.now)
    this.write({ kind: 'action', action, ctx })
    return this.current
  }

  undo(): boolean {
    if (!this.applyUndo()) return false
    this.write({ kind: 'undo' })
    return true
  }

  redo(): boolean {
    if (!this.applyRedo()) return false
    this.write({ kind: 'redo' })
    return true
  }

  private applyAction(action: GameAction, ctx: ActionContext): void {
    const next = reduce(this.current, action, ctx)
    this.past.push(this.current)
    this.future = []
    this.current = next
    this.seq = ctx.seq
    // Undo stops at the composition screen: the previous game is archived, not part of this one.
    if (action.type === 'SETUP_GAME') this.past = this.past.slice(-1)
  }

  private applyUndo(): boolean {
    const prev = this.past.pop()
    if (!prev) return false
    this.future.push(this.current)
    this.current = prev
    return true
  }

  private applyRedo(): boolean {
    const next = this.future.pop()
    if (!next) return false
    this.past.push(this.current)
    this.current = next
    return true
  }

  private archive(now: number): void {
    if (!this.journalPath || !existsSync(this.journalPath) || statSync(this.journalPath).size === 0) return
    const dir = join(dirname(this.journalPath), 'games')
    mkdirSync(dir, { recursive: true })
    renameSync(this.journalPath, join(dir, `${new Date(now).toISOString().replace(/[:.]/g, '-')}.jsonl`))
  }

  private write(entry: JournalEntry): void {
    if (this.journalPath) appendFileSync(this.journalPath, JSON.stringify(entry) + '\n')
  }

  private replay(path: string): void {
    const lines = readFileSync(path, 'utf8').split('\n')
    let skipped = 0
    for (const line of lines) {
      if (!line.trim()) continue
      let entry: JournalEntry
      try {
        entry = JSON.parse(line) as JournalEntry
      } catch {
        // A crash mid-write can leave a truncated last line.
        skipped++
        continue
      }
      try {
        if (entry.kind === 'action') this.applyAction(entry.action, entry.ctx)
        else if (entry.kind === 'undo') this.applyUndo()
        else this.applyRedo()
      } catch (err) {
        if (!(err instanceof RuleError)) throw err
        skipped++
      }
    }
    if (skipped > 0) console.warn(`[store] ${skipped} entrée(s) du journal ignorée(s) au rechargement.`)
  }
}
