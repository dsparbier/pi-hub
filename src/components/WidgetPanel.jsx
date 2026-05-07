import styles from './WidgetPanel.module.css'

export default function WidgetPanel({ widgets, results, latencyHistory, config = {} }) {
  if (!widgets || widgets.length === 0) {
    return <div className={styles.empty}>No widgets configured</div>
  }

  return (
    <div className={styles.panel}>
      {widgets.map(widget => (
        <WidgetRenderer key={widget.id} widget={widget} results={results} latencyHistory={latencyHistory} config={config} />
      ))}
    </div>
  )
}

function WidgetRenderer({ widget, results, latencyHistory, config }) {
  const { type, id, config: widgetConfig = {} } = widget

  const props = { results, latencyHistory, config: widgetConfig }

  switch (type) {
    case 'health-checks':
      return <HealthChecksWidget {...props} />
    case 'latency-chart':
      return <LatencyChartWidget {...props} />
    case 'uptime-grid':
      return <UptimeGridWidget {...props} />
    case 'stat-latency':
      return <StatLatencyWidget {...props} />
    case 'status-badge':
      return <StatusBadgeWidget {...props} />
    default:
      return <div className={styles.unknownWidget}>Unknown widget type: {type}</div>
  }
}

function HealthChecksWidget({ results }) {
  const items = [
    { label: 'Ping', check: results.ping },
    { label: 'DNS', check: results.dns },
    ...(results.custom ?? []).map(c => ({ label: c.label, check: c })),
  ]

  return (
    <div className={styles.widget}>
      <h3 className={styles.widgetTitle}>Health Checks</h3>
      <div className={styles.checkGrid}>
        {items.map(item => (
          <div key={item.label} className={styles.checkItem}>
            <div className={styles.checkLabel}>{item.label}</div>
            <div className={`${styles.checkStatus} ${styles[item.check.status]}`}>
              {item.check.status === 'pending' ? '…' : item.check.status === 'online' ? '✓' : '✗'}
            </div>
            {item.check.latency !== null && (
              <div className={styles.checkLatency}>{item.check.latency}ms</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function LatencyChartWidget({ latencyHistory }) {
  if (!latencyHistory || latencyHistory.length < 2) {
    return <div className={styles.widget}><p className={styles.noData}>Collecting latency data…</p></div>
  }

  const width = 320
  const height = 100
  const maxLatency = Math.max(...latencyHistory, 500)

  const points = latencyHistory.map((val, i) => {
    const x = (i / (latencyHistory.length - 1)) * width
    const y = height - (val / maxLatency) * height
    return `${x},${y}`
  })

  return (
    <div className={styles.widget}>
      <h3 className={styles.widgetTitle}>Latency Chart</h3>
      <svg className={styles.chart} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}

function UptimeGridWidget({ latencyHistory, config }) {
  const cols = config.cols ?? 20
  const rows = Math.ceil(latencyHistory.length / cols)
  const total = rows * cols
  const padded = [...latencyHistory, ...Array(total - latencyHistory.length).fill(null)]

  return (
    <div className={styles.widget}>
      <h3 className={styles.widgetTitle}>Uptime Grid</h3>
      <div className={styles.uptimeGrid} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {padded.map((val, i) => (
          <div
            key={i}
            className={`${styles.uptimeDot} ${val === null ? styles.empty : styles.active}`}
            title={val !== null ? `${val}ms` : 'No data'}
          />
        ))}
      </div>
    </div>
  )
}

function StatLatencyWidget({ latencyHistory }) {
  if (!latencyHistory || latencyHistory.length === 0) {
    return <div className={styles.widget}><p className={styles.noData}>No latency data</p></div>
  }

  const avg = Math.round(latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length)
  const min = Math.min(...latencyHistory)
  const max = Math.max(...latencyHistory)

  return (
    <div className={styles.widget}>
      <h3 className={styles.widgetTitle}>Latency Stats</h3>
      <div className={styles.statGrid}>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Average</div>
          <div className={styles.statValue}>{avg}ms</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Min</div>
          <div className={styles.statValue}>{min}ms</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Max</div>
          <div className={styles.statValue}>{max}ms</div>
        </div>
      </div>
    </div>
  )
}

function StatusBadgeWidget({ results }) {
  const status = results.ping.status
  const statusLabel = {
    online: 'Online',
    offline: 'Offline',
    timeout: 'Timeout',
    pending: 'Checking…',
    idle: 'Unknown',
  }[status] ?? 'Unknown'

  return (
    <div className={styles.widget}>
      <h3 className={styles.widgetTitle}>Status</h3>
      <div className={`${styles.statusBadge} ${styles[status]}`}>{statusLabel}</div>
    </div>
  )
}
