/* Container detail — action buttons + tabs: logs / stats / exec / inspect JSON.
   Plan 2 adds the lifecycle buttons and the (lazy-loaded) exec terminal. */
import { Suspense, lazy, useState } from 'react'
import { useContainerInspect } from '../useAgent.js'
import { Icon } from '../extra-icons.jsx'
import ActionButton from './ActionButton.jsx'
import LogStream from './LogStream.jsx'
import StatsSparklines from './StatsSparklines.jsx'
import TaskProgress from './TaskProgress.jsx'
import styles from './agent.module.css'

const ExecTerminal = lazy(() => import('./ExecTerminal.jsx'))

const TABS = [
  { id: 'logs', label: 'Logs', icon: 'terminal' },
  { id: 'stats', label: 'Stats', icon: 'activity' },
  { id: 'exec', label: 'Exec', icon: 'terminal' },
  { id: 'inspect', label: 'Inspect', icon: 'search' },
]

export default function ContainerDetail({ container, onClose, onDone }) {
  const [tab, setTab] = useState('logs')
  const [task, setTask] = useState(null)
  const inspect = useContainerInspect(tab === 'inspect' ? container.id : null)
  const running = container.state === 'running'

  return (
    <div className={styles.detail}>
      <div className={styles.detailHead}>
        <Icon name="box" size={16} />
        <span className="title">{container.name}</span>
        <span className={`fleet-pill ${running ? 'ok' : 'idle'}`}>{container.state}</span>
        {container.health && (
          <span className={`fleet-pill ${container.health === 'healthy' ? 'ok'
            : container.health === 'unhealthy' ? 'stop' : 'idle'}`}>{container.health}</span>
        )}
        <span className={styles.detailImage}>{container.image}</span>
        <span style={{ flex: 1 }} />
        <button className={styles.iconBtn} onClick={onClose} aria-label="Close detail">
          <Icon name="x" size={16} />
        </button>
      </div>

      <div className={styles.detailActions}>
        <ActionButton container={container} onDone={onDone}
          onTask={(id) => { setTask(id); setTab('logs') }} />
      </div>

      {task && (
        <div className={styles.detailActions}>
          <TaskProgress taskId={task} title={`recreate ${container.name}`}
            onDone={(status) => { if (status === 'done') onDone?.() }} />
        </div>
      )}

      <div className={styles.tabRow}>
        {TABS.map(t => (
          <button key={t.id} aria-pressed={t.id === tab} onClick={() => setTab(t.id)}>
            <Icon name={t.icon} size={13} /> {t.label}
          </button>
        ))}
      </div>

      <div className={styles.tabBody}>
        {tab === 'logs' && <LogStream containerId={container.id} />}
        {tab === 'stats' && (
          running ? <StatsSparklines containerId={container.id} />
            : <div className={styles.chartEmpty}>container is not running</div>
        )}
        {tab === 'exec' && (
          running
            ? <Suspense fallback={<div className={styles.chartEmpty}>loading terminal…</div>}>
                <ExecTerminal containerId={container.id} />
              </Suspense>
            : <div className={styles.chartEmpty}>container is not running</div>
        )}
        {tab === 'inspect' && (
          inspect.loading ? <div className={styles.chartEmpty}>loading…</div>
            : inspect.error
              ? <div className={styles.chartEmpty}>inspect failed — HTTP {inspect.error.status}</div>
              : <pre className={styles.jsonBody}>{JSON.stringify(inspect.data, null, 2)}</pre>
        )}
      </div>
    </div>
  )
}
