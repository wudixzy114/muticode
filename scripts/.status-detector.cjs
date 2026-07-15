var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main/status-detector.ts
var status_detector_exports = {};
__export(status_detector_exports, {
  DEFAULT_PATTERNS: () => DEFAULT_PATTERNS,
  StatusTracker: () => StatusTracker,
  stripAnsi: () => stripAnsi
});
module.exports = __toCommonJS(status_detector_exports);
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
    const waiting = this.patterns.waiting.some((re) => re.test(recentTail));
    if (sinceOutput <= this.patterns.busyWindowMs) {
      this.status = waiting ? "waiting" : "busy";
      return this.status;
    }
    if (waiting) {
      this.status = "waiting";
      return this.status;
    }
    if (sinceOutput < this.patterns.idleAfterMs && this.patterns.working.some((re) => re.test(recentTail))) {
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_PATTERNS,
  StatusTracker,
  stripAnsi
});
