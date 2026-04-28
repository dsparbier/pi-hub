import styles from './Navbar.module.css'

export default function Navbar({ onMenuToggle }) {
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
