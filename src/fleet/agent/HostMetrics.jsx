/* Host Metrics view — native replacement for Beszel's host dashboard.
   Gauge row + time-series charts + range selector, all fed by pi-hub-agent. */
import { useEffect, useMemo, useState } from 'react'
import {
  useHostMetricsCurrent, useHostInfo, useHostMetricsRange, useCollectorStatus,
} from '../useAgent.js'
import { Icon } from '../extra-icons.jsx'
import { TimeSeries, fmtBytesRate } from './charts.jsx'
import { Gauge, BarGauge } from './gauges.jsx'
import styles from './agent.module.css'

const RANGES = [
  { id: '1h', label: '1 h', span: 3600, points: 240 },
  { id: '24h', label: '24 h', span: 86400, points: 300 },
  { id: '7d', label: '7 d', span: 7 * 86400, points: 336 },
  { id: '30d', label: '30 d', span: 30 * 86400, points: 360 },
]
const METRICS = 'cpu,mem,load,net,temp,disk'

function fmtUptime(s) {
  if (s == null) return '—'
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`
}
function fmtBytes(v) {
  if (v == null) return '—'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1 }
  return `${v.toFixed(i ? 1 : 0)} ${u[i]}`
}

export default function HostMetrics() {
  const [rangeId, setRangeId] = useState('24h')
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 30000)
    return () => clearInterval(t)
  }, [])

  const range = RANGES.find(r => r.id === rangeId)
  const [from, to] = useMemo(() => {
    const now = Math.floor(Date.now() / 1000)
    return [now - range.span, now]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeId, tick])

  const cur = useHostMetricsCurrent(15000)
  const info = useHostInfo()
  const rng = useHostMetricsRange(from, to, METRICS, range.points)
  const status = useCollectorStatus(30000)

  const s = cur.data?.sample
  const src = cur.data?.sources || {}
  const series = rng.data?.series || {}
  const un = (k) => src[k] === 'unavailable'

  return (
    <>
      <header className="fleet-page-header">
        <div className="eyebrow">console.pi-hub.local · agent</div>
        <h1>Host Metrics</h1>
        <p className="lede">
          Native host telemetry from <code>pi-hub-agent</code> (psutil over a read-only
          host mount) — CPU, memory, load, disk, network and temperature, sampled every
          15&nbsp;s with 48&nbsp;h raw + 90&nbsp;d hourly history.
        </p>
        <div className="meta">
          <span>host <b>{info.data?.hostname || '—'}</b></span>
          <span>kernel <b>{info.data?.kernel || '—'}</b></span>
          <span>cores <b>{info.data?.cpu_cores ?? '—'}</b></span>
          <span>uptime <b>{fmtUptime(s?.uptime_s)}</b></span>
          {cur.error && <span className="fleet-pill stop">agent unreachable</span>}
        </div>
      </header>

      <section className="fleet-section">
        <div className="fleet-sec-head"><h2>Now</h2><span className="rule" /></div>
        <div className={styles.gaugeRow}>
          <Gauge label="CPU" value={un('cpu') ? null : s?.cpu_pct}
            display={un('cpu') ? 'n/a' : undefined}
            sub={s?.load1 != null ? `load ${s.load1.toFixed(2)}` : undefined} />
          <Gauge label="Memory" value={un('mem') ? null : s?.mem_pct}
            display={un('mem') ? 'n/a' : undefined}
            sub={s ? `${fmtBytes(s.mem_used)} / ${fmtBytes(s.mem_total)}` : undefined} />
          <Gauge label="Disk" value={un('disk') ? null : s?.disk_pct}
            display={un('disk') ? 'n/a' : undefined}
            sub={s ? `${fmtBytes(s.disk_used)} / ${fmtBytes(s.disk_total)}` : undefined} />
          <Gauge label="Temp" max={90} unit="°C"
            value={un('temp') ? null : s?.temp_c}
            display={un('temp') ? 'n/a' : (s?.temp_c != null ? `${Math.round(s.temp_c)}°C` : '—')} />
        </div>
        <div className={styles.miniBars}>
          <BarGauge label="Swap" value={un('swap') ? null : s?.swap_pct}
            right={s ? `${fmtBytes(s.swap_used)} / ${fmtBytes(s.swap_total)}` : '—'} />
          <BarGauge label="Net RX" max={100} value={0}
            right={un('net') ? 'n/a' : fmtBytesRate(s?.net_rx_rate)} />
          <BarGauge label="Net TX" max={100} value={0}
            right={un('net') ? 'n/a' : fmtBytesRate(s?.net_tx_rate)} />
          <BarGauge label="Disk IO" max={100} value={0}
            right={un('disk_io') ? 'n/a'
              : `${fmtBytesRate(s?.disk_read_rate)} · ${fmtBytesRate(s?.disk_write_rate)}`} />
        </div>
      </section>

      <section className="fleet-section">
        <div className="fleet-sec-head">
          <h2>History</h2><span className="rule" />
          <div className={styles.rangeTabs}>
            {RANGES.map(r => (
              <button key={r.id} aria-pressed={r.id === rangeId}
                onClick={() => setRangeId(r.id)}>{r.label}</button>
            ))}
          </div>
        </div>
        {rng.error && <div className={styles.chartEmpty}>history unavailable — {String(rng.error.status || '')}</div>}
        <div className={styles.chartGrid}>
          <ChartCard title="CPU %" icon="cpu">
            <TimeSeries points={series.cpu_pct} unit="%" yMax={100} />
          </ChartCard>
          <ChartCard title="Memory %" icon="activity">
            <TimeSeries points={series.mem_pct} unit="%" yMax={100} />
          </ChartCard>
          <ChartCard title="Load (1m)" icon="activity">
            <TimeSeries points={series.load1} />
          </ChartCard>
          <ChartCard title="Network" icon="activity">
            <TimeSeries
              series={[
                { label: 'rx', color: 'var(--accent)', points: series.net_rx_rate },
                { label: 'tx', color: 'var(--warn)', points: series.net_tx_rate },
              ]}
              unit=" B/s"
            />
          </ChartCard>
          <ChartCard title="Disk %" icon="hard-drive">
            <TimeSeries points={series.disk_pct} unit="%" yMax={100} />
          </ChartCard>
          <ChartCard title="Temperature" icon="cpu">
            {un('temp')
              ? <div className={styles.chartEmpty}>no sensor on this host</div>
              : <TimeSeries points={series.temp_c} unit="°C" />}
          </ChartCard>
        </div>
        <div className={styles.resNote}>
          resolution: {rng.data?.resolution || '—'}
          {rng.data ? ` · ${rng.data.bucket_s}s buckets` : ''}
        </div>
      </section>

      {status.data && (
        <section className="fleet-section">
          <div className="fleet-sec-head"><h2>Collector</h2><span className="rule" /></div>
          <dl className={styles.kv}>
            <dt>db size</dt><dd>{fmtBytes(status.data.db_size_bytes)}</dd>
            <dt>host rows</dt><dd>{status.data.rows?.host_samples ?? '—'}</dd>
            <dt>container rows</dt><dd>{status.data.rows?.container_samples ?? '—'}</dd>
            <dt>hourly rollups</dt><dd>{status.data.rows?.rollup_host_1h ?? '—'}</dd>
            <dt>sample lag</dt><dd>{status.data.lag_s == null ? '—' : `${status.data.lag_s}s`}</dd>
            <dt>last prune</dt>
            <dd>{status.data.last_prune_ts
              ? new Date(status.data.last_prune_ts * 1000).toLocaleTimeString() : '—'}</dd>
          </dl>
        </section>
      )}
    </>
  )
}

function ChartCard({ title, icon, children }) {
  return (
    <div className="fleet-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name={icon} size={15} />
        <span className="title" style={{ fontSize: 14 }}>{title}</span>
      </div>
      <div>{children}</div>
    </div>
  )
}
