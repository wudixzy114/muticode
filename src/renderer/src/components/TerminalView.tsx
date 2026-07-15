import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'

interface Props {
  agentId: string
}

/**
 * Imperative xterm terminal bound to one agent's PTY. Kept outside React's
 * render cycle so status re-renders never touch the terminal buffer. A
 * ResizeObserver refits the terminal and pushes new dimensions to the PTY,
 * which is what makes column drag-resize reflow correctly.
 */
export function TerminalView({ agentId }: Props): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)

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
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon())
    term.open(host)

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

    const offData = window.muti.onData(agentId, (data) => term.write(data))
    const inputSub = term.onData((data) => window.muti.writeToAgent(agentId, data))

    const ro = new ResizeObserver(() => sendResize())
    ro.observe(host)

    return () => {
      ro.disconnect()
      offData()
      inputSub.dispose()
      term.dispose()
    }
  }, [agentId])

  return <div className="terminal-host" ref={hostRef} />
}
