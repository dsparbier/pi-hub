import styles from './WidgetPlaceholder.module.css'

// ── Public API ────────────────────────────────────────────────────────────────
// Use: <WidgetPlaceholder type="stat|bar|chart|grid|list" {...props} />
// Each type also exported individually for direct use.

export default function WidgetPlaceholder({ type, ...props }) {
  const MAP = { stat: StatWidget, bar: BarWidget, chart: ChartWidget, grid: GridWidget, list: ListWidget }
  const W = MAP[type] ?? StatWidget
  return <W {...props} />
}

// ── Stat ─────────────────────────────────────────────────────────────────────
export function StatWidget({ label, unit = '', sublabel }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statValue}>
        <span className={styles.statNumber}>—</span>
        {unit && <span className={styles.statUnit}>{unit}</span>}
      </div>
      {sublabel && <div className={styles.statSub}>{sublabel}</div>}
      <PhaseBadge />
    </div>
  )
}

// ── Bar ──────────────────────────────────────────────────────────────────────
export function BarWidget({ segments = 1, labels }) {
  const bars = Array.from({ length: segments }, (_, i) => ({
    label: labels?.[i] ?? `Segment ${i + 1}`,
    pct: 0,
  }))
  return (
    <div className={styles.bars}>
      {bars.map(b => (
        <div key={b.label} className={styles.barRow}>
          <span className={styles.barLabel}>{b.label}</span>
          <div className={styles.barTrack}>
            <div className={`${styles.barFill} ${styles.shimmer}`} style={{ width: '0%' }} />
          </div>
          <span className={styles.barPct}>—%</span>
        </div>
      ))}
      <PhaseBadge />
    </div>
  )
}

// ── Chart ────────────────────────────────────────────────────────────────────
export function ChartWidget({ series = 1 }) {
  return (
    <div className={styles.chart}>
      <svg className={styles.chartSvg} viewBox="0 0 300 80" preserveAspectRatio="none">
        {/* Grid lines */}
        {[20, 40, 60].map(y => (
          <line key={y} x1="0" y1={y} x2="300" y2={y} className={styles.gridLine} />
        ))}
        {/* Placeholder flat line at bottom */}
        {Array.from({ length: series }, (_, i) => (
          <polyline
            key={i}
            className={`${styles.chartLine} ${styles[`line${i}`]}`}
            points={flatPoints(300, 72, i)}
          />
        ))}
      </svg>
      <div className={styles.chartAxes}>
        <span>—</span><span>—</span><span>—</span><span>—</span><span>Now</span>
      </div>
      <PhaseBadge />
    </div>
  )
}

// ── Grid (uptime dots) ────────────────────────────────────────────────────────
export function GridWidget({ rows = 5, cols = 18 }) {
  return (
    <div className={styles.grid}>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className={styles.gridRow}>
          {Array.from({ length: cols }, (_, c) => (
            <span key={c} className={`${styles.dot} ${styles.dotEmpty}`} />
          ))}
        </div>
      ))}
      <div className={styles.gridLegend}>
        <span className={`${styles.dot} ${styles.dotOnline}`} /> Online
        <span className={`${styles.dot} ${styles.dotOffline}`} /> Offline
        <span className={`${styles.dot} ${styles.dotEmpty}`} /> No data
      </div>
      <PhaseBadge />
    </div>
  )
}

// ── List ─────────────────────────────────────────────────────────────────────
export function ListWidget({ rows = 4 }) {
  const widths = [65, 80, 55, 72]
  return (
    <div className={styles.list}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={styles.listRow}>
          <span className={`${styles.listDot} ${styles.shimmer}`} />
          <span className={`${styles.listBar} ${styles.shimmer}`} style={{ width: `${widths[i % widths.length]}%` }} />
          <span className={`${styles.listTag} ${styles.shimmer}`} />
        </div>
      ))}
      <PhaseBadge />
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function PhaseBadge() {
  return <span className={styles.phaseBadge}>Phase 2</span>
}

function flatPoints(width, y, offset) {
  const pts = []
  for (let x = 0; x <= width; x += 30) pts.push(`${x},${y - offset * 6}`)
  return pts.join(' ')
}
