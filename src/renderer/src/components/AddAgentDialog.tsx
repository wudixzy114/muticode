import { useEffect, useState } from 'react'
import type { CreateAgentInput } from '../../../shared/types'

interface Props {
  onSubmit: (input: CreateAgentInput) => void
  onCancel: () => void
}

export function AddAgentDialog({ onSubmit, onCancel }: Props): React.JSX.Element {
  const [name, setName] = useState('')
  const [cwd, setCwd] = useState('')
  const [command, setCommand] = useState('claude')

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const pickDir = async (): Promise<void> => {
    const dir = await window.muti.pickDirectory()
    if (dir) {
      setCwd(dir)
      if (!name.trim()) {
        const base = dir.split('/').filter(Boolean).pop()
        if (base) setName(base)
      }
    }
  }

  const canSubmit = cwd.trim().length > 0

  const submit = (): void => {
    if (!canSubmit) return
    onSubmit({
      name: name.trim() || (cwd.split('/').filter(Boolean).pop() ?? 'agent'),
      cwd: cwd.trim(),
      command: command.trim() || 'claude'
    })
  }

  return (
    <div className="dialog-backdrop" onMouseDown={onCancel}>
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()}>
        <h2>Add agent</h2>

        <label className="field">
          <span>Working directory</span>
          <div className="field-row">
            <input
              type="text"
              value={cwd}
              placeholder="/path/to/project"
              onChange={(e) => setCwd(e.target.value)}
            />
            <button className="btn-secondary" onClick={pickDir}>
              Browse…
            </button>
          </div>
        </label>

        <label className="field">
          <span>Name</span>
          <input
            type="text"
            value={name}
            placeholder="(defaults to folder name)"
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="field">
          <span>Command</span>
          <input
            type="text"
            value={command}
            placeholder="claude"
            onChange={(e) => setCommand(e.target.value)}
          />
          <small className="field-hint">
            Runs in a login shell, so aliases and PATH resolve as in your terminal.
          </small>
        </label>

        <div className="dialog-actions">
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-primary" disabled={!canSubmit} onClick={submit}>
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
