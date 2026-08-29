/* audit_log table. Also mounted as a tab in Containers.jsx. Read tier. */
import { useState } from 'react'
import { useAudit } from '../useAgent.js'
import styles from './agent.module.css'

const FILTERS = [
  '', 'container.start', 'container.stop', 'container.restart', 'container.kill',
  'container.remove', 'container.recreate', 'container.exec.open', 'image.pull',
  'images.prune', 'containers.prune',
]

function fmtParams(p) {
  if (!p) return ''
  try {
    const obj = JSON.parse(p)
    return Object.entries(obj).map(([k, v]) =>
      `${k}=${Array.isArray(v) ? `[${v.join(',')}]` : v}`).join('  ')
  } catch { return p }
}

export default function AuditView() {
  const [action, setAction] = useState('')
  const { data, error, loading } = useAudit(action, 15000)
  const rows = data?.entries || []

  return (
    <>
      <div className={styles.auditBar}>
        <label className={styles.selWrap}>
          action
          <select value={action} onChange={e => setAction(e.target.value)}>
            {FILTERS.map(f => <option key={f} value={f}>{f || 'all'}</option>)}
          </select>
        </label>
        <span className={styles.muted}>{rows.length} entries</span>
      </div>
      {error && <div className={styles.chartEmpty}>audit unavailable (HTTP {error.status || '—'})</div>}
      {loading && !rows.length && <div className={styles.chartEmpty}>loading…</div>}
      {!!rows.length && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Time</th><th>Action</th><th>Target</th><th>Params</th>
                <th>Result</th><th className={styles.num}>ms</th><th>Actor / IP</th></tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td className={styles.muted}>{new Date(r.ts * 1000).toLocaleString()}</td>
                  <td>{r.action}</td>
                  <td className={styles.muted}>{(r.target || '').slice(0, 12) || '—'}</td>
                  <td className={styles.muted} style={{ maxWidth: 280, whiteSpace: 'normal' }}>
                    {fmtParams(r.params)}
                  </td>
                  <td>
                    <span className={`fleet-pill ${r.result === 'ok' ? 'ok' : 'stop'}`}>{r.result}</span>
                  </td>
                  <td className={styles.num}>{r.duration_ms ?? '—'}</td>
                  <td className={styles.muted}>{r.actor} · {r.client_ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
