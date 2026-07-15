// src/main/status-detector.ts
var DEFAULT_PATTERNS = {
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
};
var CSI = /\x1b\[[0-?]*[ -/]*[@-~]/g;
var OSC = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
var OTHER = /\x1b[@-Z\\-_]/g;
function stripAnsi(input) {
  return input.replace(OSC, "").replace(CSI, "").replace(OTHER, "");
}
var TAIL_LEN = 2e3;
var StatusTracker = class {
  constructor(now, patterns = DEFAULT_PATTERNS) {
    this.now = now;
    this.patterns = patterns;
  }
  tail = "";
  lastOutputAt = 0;
  status = "starting";
  exited = null;
  push(chunk) {
    this.lastOutputAt = this.now();
    this.tail = (this.tail + stripAnsi(chunk)).slice(-TAIL_LEN);
    return this.classify();
  }
  /** Re-derive status without new output (drives busy->idle/waiting decay). */
  evaluate() {
    return this.classify();
  }
  markExit(code) {
    this.exited = code === 0 ? "done" : "error";
    this.status = this.exited;
    return this.status;
  }
  get current() {
    return this.status;
  }
  classify() {
    if (this.exited) return this.exited;
    const sinceOutput = this.now() - this.lastOutputAt;
    const recentTail = this.tail.slice(-400);
    if (this.patterns.waiting.some((re) => re.test(recentTail))) {
      this.status = "waiting";
      return this.status;
    }
    const activelyWorking = sinceOutput <= this.patterns.busyWindowMs || this.patterns.working.some((re) => re.test(recentTail));
    if (activelyWorking) {
      this.status = "busy";
      return this.status;
    }
    if (sinceOutput >= this.patterns.idleAfterMs) {
      this.status = "idle";
      return this.status;
    }
    if (this.status === "starting") this.status = "idle";
    return this.status;
  }
};
export {
  DEFAULT_PATTERNS,
  StatusTracker,
  stripAnsi
};
