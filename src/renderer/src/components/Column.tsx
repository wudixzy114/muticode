import { useRef, useState } from 'react'
import type { Agent, AgentStatus } from '../../../shared/types'
import { ConfirmDialog } from './ConfirmDialog'
import { StatusBadge } from './StatusBadge'
import { TerminalView } from './TerminalView'
import type { TerminalHandle } from './TerminalView'

interface Props {
  agent: Agent
  status: AgentStatus
  focused: boolean
  onRestart: (id: string) => void
  onRemove: (id: string) => void
  onFocusChange: (focused: boolean) => void
}

type Pending = 'remove' | 'restart' | null

export function Column({
  agent,
  status,
  focused,
  onRestart,
  onRemove,
  onFocusChange
}: Props): React.JSX.Element {
  const [pending, setPending] = useState<Pending>(null)
  const termRef = useRef<TerminalHandle>(null)

  const confirm = (): void => {
    const action = pending
    setPending(null)
    if (action === 'remove') onRemove(agent.id)
    else if (action === 'restart') onRestart(agent.id)
  }

  return (
    <div
      className={focused ? 'column focused' : 'column'}
      onMouseDown={() => termRef.current?.focus()}
    >
      <header className="column-header">
        <div className="column-title">
          <span className="column-name" title={agent.name}>
            {agent.name}
          </span>
          <span className={`kind-badge kind-${agent.kind}`}>
            {agent.kind === 'codex' ? 'Codex' : 'Claude'}
          </span>
          <StatusBadge status={status} />
        </div>
        <div className="column-meta">
          <span className="column-cwd" title={agent.cwd}>
            {agent.cwd}
          </span>
          <div className="column-actions">
            <button
              className="icon-btn"
              title="Restart agent"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setPending('restart')}
            >
              ↻
            </button>
            <button
              className="icon-btn"
              title="Remove agent"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setPending('remove')}
            >
              ✕
            </button>
          </div>
        </div>
      </header>
      <div className="column-body">
        <TerminalView ref={termRef} agentId={agent.id} onFocusChange={onFocusChange} />
      </div>

      {pending === 'remove' && (
        <ConfirmDialog
          title={`关闭 agent「${agent.name}」?`}
          message="该终端会话将被终止,正在运行的任务会中断。此操作不可撤销。"
          confirmLabel="关闭"
          danger
          onConfirm={confirm}
          onCancel={() => setPending(null)}
        />
      )}
      {pending === 'restart' && (
        <ConfirmDialog
          title={`重试 agent「${agent.name}」?`}
          message="当前终端会话将被终止并重启,正在运行的任务会中断。"
          confirmLabel="确认重试"
          danger
          onConfirm={confirm}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  )
}
