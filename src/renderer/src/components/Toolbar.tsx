interface Props {
  agentCount: number
  onAddAgent: () => void
}

export function Toolbar({ agentCount, onAddAgent }: Props): React.JSX.Element {
  return (
    <div className="toolbar">
      <div className="toolbar-brand">muticode</div>
      <div className="toolbar-info">
        {agentCount} {agentCount === 1 ? 'agent' : 'agents'}
      </div>
      <div className="toolbar-spacer" />
      <button className="btn-primary" onClick={onAddAgent}>
        + Add agent
      </button>
    </div>
  )
}
