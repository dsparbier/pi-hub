import { useEffect } from 'react'
import { useHealthCheck } from '../hooks/useHealthCheck.js'
import { useLogger } from '../context/LoggerContext.jsx'
import styles from './HealthPanel.module.css'

export default function HealthPanel({ service }) {
  const logger = useLogger()
  const { results, checking, run } = useHealthCheck(service, logger)

  useEffect(() => { run() }, [service.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const host = urlHost(service.url)
  const ip   = urlIP(service.url)

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Health Checks</span>
        <button
          className={`${styles.recheck} ${checking ? styles.spinning : ''}`}
          onClick={run}
          disabled={checking}
          title="Re-run checks"
        >
          ↺
        </button>
      </div>

      <div className={styles.grid}>
        <CheckCard
          label="IP Ping"
          sublabel={ip || host}
          result={results.ping}
          icon="📡"
        />
        <CheckCard
          label="DNS Resolve"
          sublabel={host}
          result={results.dns}
          icon="🔍"
        />
        {results.custom.map(c => (
          <CheckCard
            key={c.id}
            label={`${c.method} — ${c.label}`}
            sublabel={shortUrl(c.url)}
            result={c}
            icon={c.method === 'POST' ? '📤' : '📥'}
          />
        ))}
        {results.custom.length < 2 &&
          Array.from({ length: 2 - results.custom.length }, (_, i) => (
            <CheckCard
              key={`empty-${i}`}
              label={`Custom ${results.custom.length + i + 1}`}
              sublabel="Not configured"
              result={{ status: 'unconfigured' }}
              icon="⚙"
            />
          ))
        }
      </div>
    </div>
  )
}

function CheckCard({ label, sublabel, result, icon }) {
  const { status, latency } = result
  return (
    <div className={`${styles.card} ${styles[status] ?? ''}`}>
      <div className={styles.cardHeader}>
        <span className={styles.cardIcon}>{icon}</span>
        <span className={styles.cardLabel}>{label}</span>
        <StatusDot status={status} />
      </div>
      <div className={styles.cardSub}>{sublabel}</div>
      <div className={styles.cardResult}>
        {status === 'pending'      && <span className={styles.resultPending}>Checking…</span>}
        {status === 'online'       && <span className={styles.resultOnline}>Online {latency != null ? `· ${latency}ms` : ''}</span>}
        {status === 'offline'      && <span className={styles.resultOffline}>Offline</span>}
        {status === 'timeout'      && <span className={styles.resultTimeout}>Timeout</span>}
        {status === 'unconfigured' && <span className={styles.resultMuted}>Configure in Manage Services</span>}
        {status === 'idle'         && <span className={styles.resultMuted}>—</span>}
      </div>
    </div>
  )
}

function StatusDot({ status }) {
  return <span className={`${styles.dot} ${styles[`dot_${status}`] ?? styles.dot_idle}`} />
}

function urlHost(url) {
  try { return new URL(url).hostname } catch { return url }
}

function urlIP(url) {
  try {
    const h = new URL(url).hostname
    return /^\d+\.\d+\.\d+\.\d+$/.test(h) ? h : null
  } catch { return null }
}

function shortUrl(url) {
  try {
    const u = new URL(url)
    return u.pathname.length > 1 ? u.hostname + u.pathname : u.hostname
  } catch { return url }
}
