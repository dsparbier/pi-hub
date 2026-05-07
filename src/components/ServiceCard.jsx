import styles from './ServiceCard.module.css'

export default function ServiceCard({
  title,
  icon,
  liveStatus = 'unknown',
  latency = null,
  sparkData = [],
  checking = false,
  url,
  onOpenConsole,
}) {
  const statusColor = {
    online:   '#10b981',
    warning:  '#f59e0b',
    offline:  '#ef4444',
    unknown:  '#6b7280',
  }[liveStatus] ?? '#6b7280'

  return (
    <div className={styles.card} style={{ borderLeftColor: statusColor }}>
      <span className={styles.icon}>{icon}</span>

      <div className={styles.title}>{title}</div>

      <div className={styles.statusDot} style={{ backgroundColor: statusColor }} />

      <div className={styles.latency}>
        {checking ? '⏳' : latency !== null ? `${latency}ms` : '—'}
      </div>

      <Sparkline data={sparkData} status={liveStatus} width={60} height={22} />

      {onOpenConsole && (
        <button className={styles.openBtn} onClick={onOpenConsole} title={`Open ${title} console`}>
          ↗
        </button>
      )}
    </div>
  )
}

function Sparkline({ data, status, width = 60, height = 22 }) {
  if (!data || data.length < 2) {
    return <svg className={styles.sparkline} width={width} height={height} />
  }

  const maxLatency = 3000
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width
    const clamped = Math.min(val ?? 0, maxLatency)
    const y = height - (clamped / maxLatency) * (height - 4)
    return `${x},${y}`
  })

  const statusColor = {
    online: '#10b981',
    warning: '#f59e0b',
    offline: '#ef4444',
  }[status] ?? '#6b7280'

  const lastX = (width * (data.length - 1)) / (data.length - 1)
  const lastVal = Math.min(data[data.length - 1] ?? 0, maxLatency)
  const lastY = height - (lastVal / maxLatency) * (height - 4)

  return (
    <svg className={styles.sparkline} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r="2.5" fill={statusColor} />
    </svg>
  )
}
