/* Radial + bar gauges for cpu / mem / disk / temp. Inline SVG, no deps. */
import styles from './agent.module.css'

function toneFor(pct) {
  if (pct == null) return 'var(--idle)'
  if (pct >= 90) return 'var(--stop)'
  if (pct >= 75) return 'var(--warn)'
  return 'var(--ok)'
}

const R = 52
const CIRC = 2 * Math.PI * R
const ARC = 0.75 // 270°

/* value 0..max → 270° arc. `display` overrides the centre text (e.g. "48°C"). */
export function Gauge({ value, max = 100, label, unit = '%', display, sub }) {
  const pct = value == null ? null : Math.max(0, Math.min(100, (value / max) * 100))
  const filled = pct == null ? 0 : (pct / 100) * CIRC * ARC
  const track = CIRC * ARC
  const color = toneFor(pct)
  return (
    <div className={styles.gauge}>
      <svg viewBox="0 0 130 130" className={styles.gaugeSvg}>
        <g transform="rotate(135 65 65)">
          <circle cx="65" cy="65" r={R} fill="none" stroke="var(--line)" strokeWidth="10"
            strokeDasharray={`${track} ${CIRC}`} strokeLinecap="round" />
          <circle cx="65" cy="65" r={R} fill="none" stroke={color} strokeWidth="10"
            strokeDasharray={`${filled} ${CIRC}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray .4s ease' }} />
        </g>
        <text x="65" y="62" textAnchor="middle" className={styles.gaugeVal}>
          {display ?? (value == null ? '—' : `${Math.round(value)}${unit}`)}
        </text>
        {sub && <text x="65" y="80" textAnchor="middle" className={styles.gaugeSub}>{sub}</text>}
      </svg>
      <div className={styles.gaugeLabel}>{label}</div>
    </div>
  )
}

export function BarGauge({ label, value, max = 100, unit = '%', right }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className={styles.barGauge}>
      <div className={styles.barGaugeHead}>
        <span>{label}</span>
        <span>{right ?? (value == null ? '—' : `${Math.round(value)}${unit}`)}</span>
      </div>
      <div className={styles.barTrack}>
        <div className={styles.barFill} style={{ width: `${pct}%`, background: toneFor(pct) }} />
      </div>
    </div>
  )
}
