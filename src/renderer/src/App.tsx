import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import type { Layout } from 'react-resizable-panels'
import type { CreateAgentInput } from '../../shared/types'
import { AddAgentDialog } from './components/AddAgentDialog'
import { Column } from './components/Column'
import { Toolbar } from './components/Toolbar'
import { useAgents } from './state/agents'
import { capacity, columnCount, toGrid } from './state/grid'

/** The screen's larger dimension in CSS px — drives how many columns fit. */
function screenExtent(): number {
  return Math.max(window.screen.width, window.screen.height)
}

export function App(): React.JSX.Element {
  const { agents, statuses, loaded, load, addAgent, removeAgent, restartAgent, setStatus } =
    useAgents()
  const [showDialog, setShowDialog] = useState(false)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [defaultLayout, setDefaultLayout] = useState<Layout | null>(null)
  const [extent, setExtent] = useState(screenExtent)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    void load()
    void window.muti.getColumnLayout().then((layout) => setDefaultLayout(layout ?? {}))
  }, [load])

  useEffect(() => {
    const off = window.muti.onStatus((id, status) => setStatus(id, status))
    return off
  }, [setStatus])

  // Screen resolution is effectively fixed, but re-read on resize so moving the
  // window to a different-sized display still adapts the column count.
  useEffect(() => {
    const onResize = (): void => setExtent(screenExtent())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

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

  const atCapacity = agents.length >= capacity(extent)
  const cols = columnCount(extent, agents.length)
  const grid = toGrid(agents, cols)

  const renderColumn = (agent: (typeof agents)[number]): React.JSX.Element => (
    <Column
      agent={agent}
      status={statuses[agent.id] ?? 'starting'}
      focused={focusedId === agent.id}
      onRestart={restartAgent}
      onRemove={removeAgent}
      onFocusChange={(focused) =>
        setFocusedId((cur) => (focused ? agent.id : cur === agent.id ? null : cur))
      }
    />
  )

  return (
    <div className="app">
      <Toolbar
        agentCount={agents.length}
        capacity={capacity(extent)}
        atCapacity={atCapacity}
        onAddAgent={() => setShowDialog(true)}
      />

      <div className="grid-wrap">
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
            id="columns"
            defaultLayout={defaultLayout}
            onLayoutChanged={handleLayoutChanged}
          >
            {grid.map((col, i) => (
              <Fragment key={`col-${i}`}>
                {i > 0 && <Separator className="resize-handle" />}
                <Panel id={`col-${i}`} minSize="12%" className="panel">
                  <Group orientation="vertical" className="column-stack" id={`stack-${i}`}>
                    <Panel id={col.top.id} minSize="15%" className="panel">
                      {renderColumn(col.top)}
                    </Panel>
                    {col.bottom && (
                      <Fragment>
                        <Separator className="resize-handle resize-handle-h" />
                        <Panel id={col.bottom.id} minSize="15%" className="panel">
                          {renderColumn(col.bottom)}
                        </Panel>
                      </Fragment>
                    )}
                  </Group>
                </Panel>
              </Fragment>
            ))}
          </Group>
        )}
      </div>

      {showDialog && (
        <AddAgentDialog onSubmit={handleAdd} onCancel={() => setShowDialog(false)} />
      )}
    </div>
  )
}
