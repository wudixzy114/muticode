interface Props {
  agentCount: number
  capacity: number
  atCapacity: boolean
  onAddAgent: () => void
}

export function Toolbar({
  agentCount,
  capacity,
  atCapacity,
  onAddAgent
}: Props): React.JSX.Element {
  return (
    <div className="toolbar">
      <div className="toolbar-brand">muticode</div>
      <div className="toolbar-info">
        {agentCount} / {capacity} {agentCount === 1 ? 'agent' : 'agents'}
      </div>
      <div className="toolbar-spacer" />
      <button
        className="btn-primary"
        disabled={atCapacity}
        title={atCapacity ? '已达当前窗口宽度下的最大 agent 数量' : undefined}
        onClick={onAddAgent}
      >
        + Add agent
      </button>
    </div>
  )
}
