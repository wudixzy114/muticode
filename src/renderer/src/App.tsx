import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import type { Layout } from 'react-resizable-panels'
import type { CreateAgentInput } from '../../shared/types'
import { AddAgentDialog } from './components/AddAgentDialog'
import { Column } from './components/Column'
import { Toolbar } from './components/Toolbar'
import { useAgents } from './state/agents'

export function App(): React.JSX.Element {
  const { agents, statuses, loaded, load, addAgent, removeAgent, restartAgent, setStatus } =
    useAgents()
  const [showDialog, setShowDialog] = useState(false)
  const [defaultLayout, setDefaultLayout] = useState<Layout | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    void load()
    void window.muti.getColumnLayout().then((layout) => setDefaultLayout(layout ?? {}))
  }, [load])

  useEffect(() => {
    const off = window.muti.onStatus((id, status) => setStatus(id, status))
    return off
  }, [setStatus])

  // Persist layout only on user-driven resizes, debounced.
  const handleLayoutChanged = useCallback((layout: Layout, meta: { isUserInteraction: boolean }) => {
    if (!meta.isUserInteraction) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => window.muti.saveColumnLayout(layout), 300)
  }, [])

  const handleAdd = useCallback(
    async (input: CreateAgentInput) => {
      setShowDialog(false)
      await addAgent(input)
    },
    [addAgent]
  )

  if (!loaded || defaultLayout === null) {
    return <div className="loading">Loading…</div>
  }

  return (
    <div className="app">
      <Toolbar agentCount={agents.length} onAddAgent={() => setShowDialog(true)} />

      {agents.length === 0 ? (
        <div className="empty-state">
          <p>No agents yet.</p>
          <button className="btn-primary" onClick={() => setShowDialog(true)}>
            + Add your first agent
          </button>
        </div>
      ) : (
        <Group
          orientation="horizontal"
          className="panel-group"
          defaultLayout={defaultLayout}
          onLayoutChanged={handleLayoutChanged}
        >
          {agents.map((agent, i) => (
            <Fragment key={agent.id}>
              {i > 0 && <Separator className="resize-handle" />}
              <Panel id={agent.id} minSize="10%" className="panel">
                <Column
                  agent={agent}
                  status={statuses[agent.id] ?? 'starting'}
                  onRestart={restartAgent}
                  onRemove={removeAgent}
                />
              </Panel>
            </Fragment>
          ))}
        </Group>
      )}

      {showDialog && (
        <AddAgentDialog onSubmit={handleAdd} onCancel={() => setShowDialog(false)} />
      )}
    </div>
  )
}
