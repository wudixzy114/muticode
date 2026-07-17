import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'

interface Props {
  agentId: string
  onFocusChange?: (focused: boolean) => void
}

export interface TerminalHandle {
  focus: () => void
}

/**
 * Imperative xterm terminal bound to one agent's PTY. Kept outside React's
 * render cycle so status re-renders never touch the terminal buffer. A
 * ResizeObserver refits the terminal and pushes new dimensions to the PTY,
 * which is what makes column drag-resize reflow correctly.
 *
 * Exposes an imperative focus() so a click anywhere in the column can route
 * the keyboard here, and reports focus/blur so the UI can highlight the column
 * that currently owns keyboard input.
 */
export const TerminalView = forwardRef<TerminalHandle, Props>(function TerminalView(
  { agentId, onFocusChange },
  ref
): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)

  useImperativeHandle(ref, () => ({
    focus: () => termRef.current?.focus()
  }))

  // Keep the latest callback without re-running the terminal setup effect.
  const onFocusChangeRef = useRef(onFocusChange)
  onFocusChangeRef.current = onFocusChange

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const term = new Terminal({
      fontFamily: 'Menlo, Monaco, "SF Mono", "Courier New", monospace',
      fontSize: 13,
      cursorBlink: true,
      allowProposedApi: true,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4'
      }
    })
    termRef.current = term
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon())
    term.open(host)

    // xterm routes keystrokes through a hidden textarea; its focus/blur is the
    // real signal for "does the keyboard go here right now".
    const textarea = term.textarea
    const onFocus = (): void => onFocusChangeRef.current?.(true)
    const onBlur = (): void => onFocusChangeRef.current?.(false)
    textarea?.addEventListener('focus', onFocus)
    textarea?.addEventListener('blur', onBlur)

    const sendResize = (): void => {
      try {
        fit.fit()
      } catch {
        /* host not measurable yet */
      }
      window.muti.resizeAgent(agentId, term.cols, term.rows)
    }
    // Initial fit after layout settles.
    requestAnimationFrame(sendResize)

    // Repaint prior output first so a remounted/reflowed terminal isn't blank.
    // Live chunks arriving during the async backlog fetch are queued, then
    // flushed after the backlog so nothing is lost or reordered.
    let replayed = false
    let disposed = false
    const queue: string[] = []
    const offData = window.muti.onData(agentId, (data) => {
      if (replayed) term.write(data)
      else queue.push(data)
    })
    void window.muti.getBacklog(agentId).then((backlog) => {
      if (disposed) return
      if (backlog) term.write(backlog)
      for (const chunk of queue) term.write(chunk)
      queue.length = 0
      replayed = true
    })

    const inputSub = term.onData((data) => window.muti.writeToAgent(agentId, data))

    const ro = new ResizeObserver(() => sendResize())
    ro.observe(host)

    return () => {
      disposed = true
      ro.disconnect()
      offData()
      inputSub.dispose()
      textarea?.removeEventListener('focus', onFocus)
      textarea?.removeEventListener('blur', onBlur)
      termRef.current = null
      term.dispose()
    }
  }, [agentId])

  return <div className="terminal-host" ref={hostRef} />
})
