import type { AgentStatus } from '../../../shared/types'

const LABELS: Record<AgentStatus, string> = {
  starting: 'starting',
  busy: 'busy',
  waiting: 'waiting',
  idle: 'idle',
  done: 'done',
  error: 'error'
}

export function StatusBadge({ status }: { status: AgentStatus }): React.JSX.Element {
  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-dot" />
      {LABELS[status]}
    </span>
  )
}
