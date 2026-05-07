import { useState, useEffect } from 'react'
import styles from './Navbar.module.css'

const THEMES = [
  { value: 'dark',   icon: '🌙', title: 'Dark'   },
  { value: 'light',  icon: '☀️', title: 'Light'  },
  { value: 'system', icon: '💻', title: 'System' },
]

function useClock() {
  const [time, setTime] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

export default function Navbar({ onMenuToggle, theme, onThemeToggle, services = [], config = {}, onSettingsOpen }) {
  const time = useClock()

  const online  = services.filter(s => s.status === 'online').length
  const warning = services.filter(s => s.status === 'warning').length
  const offline = services.filter(s => s.status === 'offline').length
  const total   = services.length

  const aggColor = offline > 0 ? 'danger' : warning > 0 ? 'warning' : 'success'

  const serviceLabel =
    offline > 0
      ? `${online}/${total} online · ${offline} down`
      : warning > 0
      ? `${online}/${total} online · ${warning} warning`
      : `${total} / ${total} online`

  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })

  const hostname = config.hostname || '—'

  return (
    <header className={styles.navbar}>
      <div className={styles.left}>
        <button className={styles.menuBtn} onClick={onMenuToggle} aria-label="Toggle sidebar">
          ☰
        </button>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>π</span>
          <span className={styles.logoText}>{config.hubName || 'Pi-Hub'}</span>
        </div>
      </div>

      <div className={styles.center}>
        <div className={styles.statusBar}>
          <StatusDot color={aggColor} label={serviceLabel} pulse={aggColor === 'success'} />
          <div className={styles.statusDivider} />
          <div className={styles.hostRow}>
            <span className={styles.hostIcon}>⬡</span>
            <span className={styles.hostLabel}>{hostname}</span>
          </div>
          <div className={styles.statusDivider} />
          <div className={styles.clock}>
            <span className={styles.clockTime}>{timeStr}</span>
            <span className={styles.clockDate}>{dateStr}</span>
          </div>
        </div>
      </div>

      <div className={styles.right}>
        <div className={styles.themeSegment} role="group" aria-label="Theme">
          {THEMES.map(t => (
            <button
              key={t.value}
              className={`${styles.themeSegBtn} ${theme === t.value ? styles.themeSegBtnActive : ''}`}
              onClick={() => onThemeToggle(t.value)}
              title={t.title}
              aria-pressed={theme === t.value}
            >
              {t.icon}
            </button>
          ))}
        </div>
        <button className={styles.iconBtn} title="Notifications">🔔</button>
        <button
          className={`${styles.iconBtn} ${styles.settingsBtn}`}
          title="Settings"
          onClick={onSettingsOpen}
        >
          ⚙
        </button>
        <div className={styles.avatar}>D</div>
      </div>
    </header>
  )
}

function StatusDot({ color, label, pulse }) {
  return (
    <div className={styles.statusDot}>
      <span className={`${styles.dot} ${styles[color]} ${pulse ? styles.pulse : ''}`} />
      <span className={styles.statusLabel}>{label}</span>
    </div>
  )
}
