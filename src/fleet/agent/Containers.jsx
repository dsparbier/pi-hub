/* Containers view — tabs: Containers / Images / Audit. The container table is
   selectable → detail pane with lifecycle actions + exec (Plan 2). */
import { useMemo, useState } from 'react'
import { useContainers, useAdminActions } from '../useAgent.js'
import { useLogger } from '../../context/LoggerContext.jsx'
import { Icon } from '../extra-icons.jsx'
import ContainerDetail from './ContainerDetail.jsx'
import ImagePanel from './ImagePanel.jsx'
import AuditView from './AuditView.jsx'
import styles from './agent.module.css'

function fmtBytes(v) {
  if (v == null) return '—'
  const u = ['B', 'KB', 'MB', 'GB']
  let i = 0
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1 }
  return `${v.toFixed(i ? 1 : 0)} ${u[i]}`
}
function portList(ports) {
  if (!ports?.length) return '—'
  return ports.filter(p => p.private)
    .map(p => (p.public ? `${p.public}:${p.private}` : `${p.private}`)).join(', ') || '—'
}

const TABS = [
  { id: 'containers', label: 'Containers', icon: 'box' },
  { id: 'images', label: 'Images', icon: 'hard-drive' },
  { id: 'audit', label: 'Audit', icon: 'search' },
]

export default function Containers() {
  const { data, error, loading, refresh } = useContainers(10000)
  const { pruneContainers } = useAdminActions()
  const log = useLogger()
  const [tab, setTab] = useState('containers')
  const [selId, setSelId] = useState(null)

  const containers = data?.containers || []
  const selected = useMemo(() => containers.find(c => c.id === selId) || null, [containers, selId])
  const running = containers.filter(c => c.state === 'running').length

  async function doPrune() {
    try {
      const res = await pruneContainers()
      log.info('pi-hub-agent', `pruned ${(res.ContainersDeleted || []).length} stopped containers`)
      refresh()
    } catch (err) {
      log.error('pi-hub-agent', 'container prune failed', String(err?.detail || err))
    }
  }

  return (
    <>
      <header className="fleet-page-header">
        <div className="eyebrow">console.pi-hub.local · agent</div>
        <h1>Containers</h1>
        <p className="lede">
          Native Docker management via <code>pi-hub-agent</code> — state, health, ports,
          logs, live stats, lifecycle control, an in-browser shell, image management and a
          full audit trail. Control actions need the admin key.
        </p>
        <div className="meta">
          <span>containers <b>{containers.length}</b></span>
          <span>running <b>{running}</b></span>
          {error && <span className="fleet-pill stop">agent unreachable</span>}
        </div>
      </header>

      <section className="fleet-section">
        <div className="fleet-sec-head">
          <div className={styles.rangeTabs}>
            {TABS.map(t => (
              <button key={t.id} aria-pressed={t.id === tab} onClick={() => setTab(t.id)}>
                <Icon name={t.icon} size={12} /> {t.label}
              </button>
            ))}
          </div>
          <span className="rule" />
          {tab === 'containers' && (
            <button className={styles.btnGhost} onClick={doPrune}>
              <Icon name="trash" size={12} /> Prune stopped
            </button>
          )}
        </div>

        {tab === 'images' && <ImagePanel />}
        {tab === 'audit' && <AuditView />}

        {tab === 'containers' && (
          <>
            {loading && !containers.length && <div className={styles.chartEmpty}>loading…</div>}
            {error && !containers.length && (
              <div className={styles.chartEmpty}>
                could not reach the agent (HTTP {error.status || '—'}) — check
                <code> fleet.console.keys</code> and that <code>pi-hub-agent</code> is up.
              </div>
            )}
            {!!containers.length && (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Name</th><th>State</th><th>Health</th><th>Image</th>
                      <th>Ports</th><th className={styles.num}>CPU</th><th className={styles.num}>Mem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {containers.map(c => (
                      <tr key={c.id} aria-selected={c.id === selId}
                        onClick={() => setSelId(id => (id === c.id ? null : c.id))}>
                        <td>
                          <Icon name="box" size={13} /> {c.name}
                          {c.compose?.project && (
                            <span className={styles.composeTag}>{c.compose.project}</span>
                          )}
                        </td>
                        <td><span className={`${styles.dot} ${styles[c.state] || ''}`} />{c.state}</td>
                        <td>
                          {c.health
                            ? <span className={`fleet-pill ${c.health === 'healthy' ? 'ok'
                              : c.health === 'unhealthy' ? 'stop' : 'idle'}`}>{c.health}</span>
                            : <span className={styles.muted}>—</span>}
                        </td>
                        <td className={styles.imageCell} title={c.image}>{c.image}</td>
                        <td className={styles.muted}>{portList(c.ports)}</td>
                        <td className={styles.num}>{c.cpu_pct == null ? '—' : `${c.cpu_pct.toFixed(1)}%`}</td>
                        <td className={styles.num}>{fmtBytes(c.mem_used)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {tab === 'containers' && selected && (
        <section className="fleet-section">
          <ContainerDetail container={selected} onDone={refresh}
            onClose={() => setSelId(null)} />
        </section>
      )}
    </>
  )
}
