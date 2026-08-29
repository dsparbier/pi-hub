/* Inline-SVG chart primitives — no runtime deps. Generalised from the renderers
   in the (now superseded) src/components/WidgetPanel.jsx:
     TimeSeries  ← LatencyChartWidget  (+ area fill, last-value label, multi-series)
     Sparkline   ← LatencyChartWidget (minimal)
     DotGrid     ← UptimeGridWidget
     StatTriplet ← StatLatencyWidget
   All theme-aware: strokes use each series' colour or `currentColor`, surfaces
   use fleet tokens. WidgetPanel.jsx itself is left untouched. */
import styles from './agent.module.css'

const VB_W = 640

function niceMax(v) {
  if (!isFinite(v) || v <= 0) return 1
  const pow = 10 ** Math.floor(Math.log10(v))
  const n = v / pow
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return step * pow
}

export function fmtBytesRate(v) {
  if (v == null) return '—'
  const u = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  let i = 0
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1 }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`
}

/* series: [{ label, color, points: [[ts, value], …] }]  — or pass `points` for one. */
export function TimeSeries({
  series, points, height = 130, unit = '', yMax, area = true, lastLabel = true,
}) {
  const list = series ?? (points ? [{ label: '', color: 'var(--accent)', points }] : [])
  const all = list.flatMap(s => s.points || [])
  if (all.length < 2) {
    return <div className={styles.chartEmpty}>collecting…</div>
  }
  const xs = all.map(p => p[0])
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const span = x1 - x0 || 1
  const dataMax = Math.max(...all.map(p => p[1] ?? 0))
  const top = yMax ?? niceMax(dataMax * 1.15)
  const H = height
  const px = (t) => ((t - x0) / span) * VB_W
  const py = (v) => H - (Math.max(0, Math.min(v, top)) / top) * (H - 6) - 3

  return (
    <div className={styles.chartBox}>
      <svg
        className={styles.chartSvg}
        viewBox={`0 0 ${VB_W} ${H}`}
        preserveAspectRatio="none"
        role="img"
      >
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f} x1="0" x2={VB_W} y1={H * f} y2={H * f}
            stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        {list.map((s, i) => {
          const pts = (s.points || []).map(p => `${px(p[0])},${py(p[1] ?? 0)}`)
          const color = s.color || 'var(--accent)'
          return (
            <g key={s.label || i}>
              {area && (
                <polygon
                  points={`0,${H} ${pts.join(' ')} ${VB_W},${H}`}
                  fill={color} opacity="0.10"
                />
              )}
              <polyline
                points={pts.join(' ')}
                fill="none" stroke={color} strokeWidth="2"
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round" strokeLinecap="round"
              />
            </g>
          )
        })}
      </svg>
      {lastLabel && (
        <div className={styles.chartLegend}>
          {list.map((s, i) => {
            const last = s.points?.[s.points.length - 1]?.[1]
            return (
              <span key={s.label || i}>
                <i style={{ background: s.color || 'var(--accent)' }} />
                {s.label ? `${s.label} ` : ''}
                <b>{last == null ? '—' : `${round(last)}${unit}`}</b>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function Sparkline({ values = [], width = 108, height = 30, color = 'var(--accent)' }) {
  const nums = values.filter(v => v != null)
  if (nums.length < 2) return <svg width={width} height={height} aria-hidden="true" />
  const max = Math.max(...nums, 1e-6)
  const min = Math.min(...nums, 0)
  const span = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((v ?? min) - min) / span * (height - 2) - 1
    return `${x},${y}`
  })
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5"
        vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

/* values: array of 0..1 (or null for "no data"). colorFor(v) → css colour. */
export function DotGrid({ values = [], cols = 24, colorFor }) {
  const tone = colorFor || ((v) => (v == null ? 'var(--line)'
    : v >= 0.85 ? 'var(--stop)' : v >= 0.6 ? 'var(--warn)' : 'var(--ok)'))
  return (
    <div className={styles.dotGrid} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {values.map((v, i) => (
        <span key={i} title={v == null ? 'no data' : `${Math.round(v * 100)}%`}
          style={{ background: tone(v) }} />
      ))}
    </div>
  )
}

/* items: [{label, value}]  — or values:number[] → avg / min / max */
export function StatTriplet({ items, values, unit = '' }) {
  let cells = items
  if (!cells && values?.length) {
    const nums = values.filter(v => v != null)
    const avg = nums.reduce((a, b) => a + b, 0) / (nums.length || 1)
    cells = [
      { label: 'avg', value: round(avg) },
      { label: 'min', value: round(Math.min(...nums)) },
      { label: 'max', value: round(Math.max(...nums)) },
    ]
  }
  if (!cells) return null
  return (
    <div className={styles.triplet}>
      {cells.map(c => (
        <div key={c.label}>
          <div className={styles.tripLabel}>{c.label}</div>
          <div className={styles.tripValue}>{c.value}{unit}</div>
        </div>
      ))}
    </div>
  )
}

function round(v) {
  if (v == null || !isFinite(v)) return '—'
  const a = Math.abs(v)
  return a >= 100 ? Math.round(v) : a >= 10 ? v.toFixed(1) : v.toFixed(2)
}
