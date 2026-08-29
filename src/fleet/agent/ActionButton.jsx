/* Lifecycle action buttons for one container. Every call needs the admin key;
   remove / recreate go through a typed-name ConfirmDialog. */
import { useState } from 'react'
import { useAdminActions } from '../useAgent.js'
import { useLogger } from '../../context/LoggerContext.jsx'
import { Icon } from '../extra-icons.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import styles from './agent.module.css'

const RUN_ACTIONS = [
  { id: 'start', label: 'Start', icon: 'play', when: s => s !== 'running' },
  { id: 'stop', label: 'Stop', icon: 'square', when: s => s === 'running' },
  { id: 'restart', label: 'Restart', icon: 'rotate-cw', when: s => s === 'running' },
  { id: 'kill', label: 'Kill', icon: 'square', when: s => s === 'running', tone: 'warn' },
]

export default function ActionButton({ container, onDone, onTask }) {
  const { runAction } = useAdminActions()
  const log = useLogger()
  const [busy, setBusy] = useState(null)
  const [dialog, setDialog] = useState(null)
  const c = container

  async function fire(action, params) {
    setBusy(action)
    try {
      const res = await runAction(c.id, action, params)
      log.info('pi-hub-agent', `${action} ${c.name} ok`)
      if (action === 'recreate' && res?.task_id) onTask?.(res.task_id, 'recreate')
      onDone?.()
    } catch (err) {
      log.error('pi-hub-agent', `${action} ${c.name} failed`, String(err?.detail || err))
    } finally {
      setBusy(null)
      setDialog(null)
    }
  }

  return (
    <div className={styles.actionRow}>
      {RUN_ACTIONS.filter(a => a.when(c.state)).map(a => (
        <button key={a.id} className={`${styles.actBtn} ${styles['act_' + (a.tone || 'ok')] || ''}`}
          disabled={!!busy} onClick={() => fire(a.id, a.id === 'kill' ? { signal: 'SIGKILL' } : {})}>
          <Icon name={a.icon} size={12} /> {busy === a.id ? '…' : a.label}
        </button>
      ))}
      <button className={`${styles.actBtn} ${styles.act_warn}`} disabled={!!busy}
        onClick={() => setDialog('recreate')}>
        <Icon name="rotate-cw" size={12} /> Recreate…
      </button>
      <button className={`${styles.actBtn} ${styles.act_stop}`} disabled={!!busy}
        onClick={() => setDialog('remove')}>
        <Icon name="trash" size={12} /> Remove…
      </button>

      {dialog === 'remove' && (
        <ConfirmDialog
          title={`Remove ${c.name}`}
          body="The container is deleted. This cannot be undone."
          confirmLabel="Remove" requireText={c.name}
          extra={[
            { key: 'force', label: 'Force (kill if running)' },
            { key: 'volumes', label: 'Also remove anonymous volumes' },
          ]}
          onConfirm={(opts) => fire('remove', { force: !!opts.force, volumes: !!opts.volumes })}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'recreate' && (
        <ConfirmDialog
          title={`Recreate ${c.name} (ad-hoc)`}
          tone="warn" confirmLabel="Recreate" requireText={c.name}
          body={c.compose?.project
            ? `Compose-managed (project "${c.compose.project}"). Prefer that service's own deploy loop — this recreates from the live inspect and docker compose will then see it as created outside its run.`
            : 'Recreates the container from its current inspect output (Config + HostConfig). The old container is renamed and kept for rollback.'}
          extra={[
            { key: 'pull', label: 'Pull the image first' },
            { key: 'force', label: 'Force past guards (anonymous volumes / multi-network)' },
          ]}
          onConfirm={(opts) => fire('recreate', { pull: !!opts.pull, force: !!opts.force })}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}
