import styles from './Navbar.module.css'

const THEME_CYCLE = { dark: 'light', light: 'system', system: 'dark' }
const THEME_ICON  = { dark: '🌙', light: '☀️', system: '💻' }
const THEME_TITLE = { dark: 'Dark mode — click for Light', light: 'Light mode — click for System', system: 'System mode — click for Dark' }

export default function Navbar({ onMenuToggle, theme, onThemeToggle }) {
  return (
    <header className={styles.navbar}>
      <div className={styles.left}>
        <button className={styles.menuBtn} onClick={onMenuToggle} aria-label="Toggle sidebar">
          ☰
        </button>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>π</span>
          <span className={styles.logoText}>Pi-Hub</span>
        </div>
      </div>

      <div className={styles.center}>
        <div className={styles.statusBar}>
          <StatusDot color="success" label="192.168.1.100" />
          <StatusDot color="success" label="Online" />
          <StatusDot color="warning" label="3 services" />
        </div>
      </div>

      <div className={styles.right}>
        <button
          className={`${styles.iconBtn} ${styles.themeBtn}`}
          onClick={() => onThemeToggle(THEME_CYCLE[theme] ?? 'dark')}
          title={THEME_TITLE[theme]}
          aria-label="Toggle theme"
        >
          {THEME_ICON[theme] ?? '🌙'}
        </button>
        <button className={styles.iconBtn} title="Notifications">🔔</button>
        <button className={styles.iconBtn} title="Settings">⚙</button>
        <div className={styles.avatar}>D</div>
      </div>
    </header>
  )
}

function StatusDot({ color, label }) {
  return (
    <div className={styles.statusDot}>
      <span className={`${styles.dot} ${styles[color]}`} />
      <span className={styles.statusLabel}>{label}</span>
    </div>
  )
}
