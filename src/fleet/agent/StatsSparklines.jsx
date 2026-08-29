/* Live per-container stats over a WebSocket → rolling sparklines. */
import { useEffect, useRef, useState } from 'react'
import { useStreams } from '../useAgent.js'
import { Sparkline, fmtBytesRate } from './charts.jsx'
import styles from './agent.module.css'

const KEEP = 60

export default function StatsSparklines({ containerId }) {
  const { openStatsStream } = useStreams()
  const [status, setStatus] = useState('connecting')
  const [hist, setHist] = useState({ cpu: [], mem: [], rx: [], tx: [] })
  const latest = useRef(null)
  const [, force] = useState(0)

  useEffect(() => {
    setHist({ cpu: [], mem: [], rx: [], tx: [] })
    const ctl = openStatsStream(containerId, {
      onStatus: setStatus,
      onFrame: (f) => {
        if (f.type !== 'stats') return
        latest.current = f
        force(x => x + 1)
        setHist(h => ({
          cpu: push(h.cpu, f.cpu_pct),
          mem: push(h.mem, f.mem_pct),
          rx: push(h.rx, f.net_rx_rate),
          tx: push(h.tx, f.net_tx_rate),
        }))
      },
    })
    return () => ctl.close()
  }, [containerId, openStatsStream])

  const l = latest.current
  return (
    <div className={styles.statGrid}>
      <span className={`fleet-pill ${status === 'open' ? 'ok' : 'idle'}`}>{status}</span>
      <Metric label="CPU" value={l ? `${(l.cpu_pct ?? 0).toFixed(1)}%` : '—'}
        spark={<Sparkline values={hist.cpu} color="var(--accent)" />} />
      <Metric label="Memory"
        value={l ? `${(l.mem_pct ?? 0).toFixed(1)}%  ·  ${fmtBytes(l.mem_used)}` : '—'}
        spark={<Sparkline values={hist.mem} color="var(--ok)" />} />
      <Metric label="Net RX" value={l ? fmtBytesRate(l.net_rx_rate) : '—'}
        spark={<Sparkline values={hist.rx} color="var(--accent)" />} />
      <Metric label="Net TX" value={l ? fmtBytesRate(l.net_tx_rate) : '—'}
        spark={<Sparkline values={hist.tx} color="var(--warn)" />} />
      <Metric label="PIDs" value={l?.pids ?? '—'} />
    </div>
  )
}

function Metric({ label, value, spark }) {
  return (
    <div className={styles.statCell}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
      {spark}
    </div>
  )
}

function push(arr, v) {
  const next = arr.length >= KEEP ? arr.slice(1) : arr.slice()
  next.push(v ?? 0)
  return next
}
function fmtBytes(v) {
  if (v == null) return '—'
  const u = ['B', 'KB', 'MB', 'GB']
  let i = 0
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1 }
  return `${v.toFixed(i ? 1 : 0)} ${u[i]}`
}
