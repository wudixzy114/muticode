// Throwaway smoke test (CommonJS — Electron main's native format). Proves
// (1) node-pty works under Electron's ABI and (2) status detection classifies
// real PTY output. Run: electron scripts/smoke.cjs ; then delete.
const { app } = require('electron')
const pty = require('node-pty')
const { StatusTracker, stripAnsi } = require('./.status-detector.cjs')

let failed = false
function assert(cond, msg) {
  if (!cond) {
    failed = true
    console.error('FAIL:', msg)
  } else {
    console.log('ok  -', msg)
  }
}

app.whenReady().then(async () => {
  let t = 1000
  const clock = () => t
  const tr = new StatusTracker(clock)

  assert(tr.current === 'starting', 'tracker starts in "starting"')

  tr.push('Thinking… (esc to interrupt)')
  assert(tr.current === 'busy', 'work markers => busy')

  t += 5000
  assert(tr.evaluate() === 'idle', 'silence past idle threshold => idle')

  tr.push('Do you want to proceed? ❯ 1. Yes')
  assert(tr.current === 'waiting', 'permission prompt => waiting')

  assert(stripAnsi('\x1b[31mred\x1b[0m') === 'red', 'stripAnsi removes CSI colors')

  assert(tr.markExit(0) === 'done', 'exit 0 => done')
  const tr2 = new StatusTracker(clock)
  assert(tr2.markExit(1) === 'error', 'exit 1 => error')

  // node-pty real spawn under Electron ABI (the native-module risk).
  const shell = process.env.SHELL || 'zsh'
  const proc = pty.spawn(shell, ['-lc', 'echo PTY_OK && pwd'], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: process.env.HOME
  })

  let out = ''
  proc.onData((d) => {
    out += d
  })

  const code = await new Promise((resolve) => {
    proc.onExit(({ exitCode }) => resolve(exitCode))
  })

  assert(out.includes('PTY_OK'), 'node-pty spawned a real shell and captured output')
  assert(code === 0, 'pty process exited cleanly under Electron')

  console.log(failed ? '\nSMOKE CHECKS FAILED' : '\nALL SMOKE CHECKS PASSED')
  app.exit(failed ? 1 : 0)
})
