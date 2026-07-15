import type { AgentStatus } from '../shared/types'

/**
 * Heuristics for classifying an agent's status from its terminal output.
 * Kept in one object so they can be tuned per `claude` version (or any command)
 * without touching the detection loop.
 */
export interface StatusPatterns {
  /** Output within this window (ms) counts as active work. */
  busyWindowMs: number
  /** Silence beyond this (ms) with no work markers => idle. */
  idleAfterMs: number
  /** Tail matches => the agent is blocked on a confirm/permission prompt. */
  waiting: RegExp[]
  /** Tail matches (or recent output) => actively working. */
  working: RegExp[]
}

export const DEFAULT_PATTERNS: StatusPatterns = {
  busyWindowMs: 800,
  idleAfterMs: 1500,
  waiting: [
    /do you want to proceed/i,
    /\ballow\b.*\?/i,
    /\(y\/n\)/i,
    /press\s+enter\s+to/i,
    /❯\s*1\./,
    /\b1\.\s*yes\b/i
  ],
  working: [
    // Braille spinner glyphs used by many TUIs.
    /[⠀-⣿]/,
    /esc to interrupt/i,
    /thinking/i,
    /\btokens\b/i,
    /\(\d+s\b/,
    /working|running|building|compiling/i
  ]
}

// Strip ANSI escape sequences (CSI + OSC + other) so regexes match plain text.
const CSI = /\x1b\[[0-?]*[ -/]*[@-~]/g
const OSC = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g
const OTHER = /\x1b[@-Z\\-_]/g

export function stripAnsi(input: string): string {
  return input.replace(OSC, '').replace(CSI, '').replace(OTHER, '')
}

const TAIL_LEN = 2000

/**
 * Tracks one agent's output over time and derives a status. Call `push` on every
 * chunk of PTY data and `evaluate` on a timer; both return the current status.
 */
export class StatusTracker {
  private tail = ''
  private lastOutputAt = 0
  private status: AgentStatus = 'starting'
  private exited: AgentStatus | null = null

  constructor(
    private now: () => number,
    private patterns: StatusPatterns = DEFAULT_PATTERNS
  ) {}

  push(chunk: string): AgentStatus {
    this.lastOutputAt = this.now()
    this.tail = (this.tail + stripAnsi(chunk)).slice(-TAIL_LEN)
    return this.classify()
  }

  /** Re-derive status without new output (drives busy->idle/waiting decay). */
  evaluate(): AgentStatus {
    return this.classify()
  }

  markExit(code: number): AgentStatus {
    this.exited = code === 0 ? 'done' : 'error'
    this.status = this.exited
    return this.status
  }

  get current(): AgentStatus {
    return this.status
  }

  private classify(): AgentStatus {
    if (this.exited) return this.exited

    const sinceOutput = this.now() - this.lastOutputAt
    const recentTail = this.tail.slice(-400)
    const waiting = this.patterns.waiting.some((re) => re.test(recentTail))

    // Fresh output means actively working — unless a prompt is now on screen,
    // in which case the agent is blocked waiting for the user.
    if (sinceOutput <= this.patterns.busyWindowMs) {
      this.status = waiting ? 'waiting' : 'busy'
      return this.status
    }

    // Output has paused. A visible prompt means we're waiting on input.
    if (waiting) {
      this.status = 'waiting'
      return this.status
    }

    // Within the grace window, live work markers still count as busy. Past the
    // idle threshold we trust silence over stale markers left in the buffer.
    if (
      sinceOutput < this.patterns.idleAfterMs &&
      this.patterns.working.some((re) => re.test(recentTail))
    ) {
      this.status = 'busy'
      return this.status
    }

    if (sinceOutput >= this.patterns.idleAfterMs) {
      this.status = 'idle'
      return this.status
    }

    // Grace window, no markers: keep prior status (or settle to idle).
    if (this.status === 'starting') this.status = 'idle'
    return this.status
  }
}
