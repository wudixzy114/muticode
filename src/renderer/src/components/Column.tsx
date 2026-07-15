import type { Agent, AgentStatus } from '../../../shared/types'
import { StatusBadge } from './StatusBadge'
import { TerminalView } from './TerminalView'

interface Props {
  agent: Agent
  status: AgentStatus
  onRestart: (id: string) => void
  onRemove: (id: string) => void
}

export function Column({ agent, status, onRestart, onRemove }: Props): React.JSX.Element {
  return (
    <div className="column">
      <header className="column-header">
        <div className="column-title">
          <span className="column-name" title={agent.name}>
            {agent.name}
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
              onClick={() => onRestart(agent.id)}
            >
              ↻
            </button>
            <button
              className="icon-btn"
              title="Remove agent"
              onClick={() => onRemove(agent.id)}
            >
              ✕
            </button>
          </div>
        </div>
      </header>
      <div className="column-body">
        <TerminalView agentId={agent.id} />
      </div>
    </div>
  )
}
