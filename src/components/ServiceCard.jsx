import styles from './ServiceCard.module.css'

export default function ServiceCard({ title, icon, status = 'online', description, children, size = 'medium', url, onOpenConsole }) {
  return (
    <div className={`${styles.card} ${styles[size]}`}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.icon}>{icon}</span>
          <h3 className={styles.title}>{title}</h3>
        </div>
        <div className={styles.headerRight}>
          <StatusBadge status={status} />
          {url && onOpenConsole && (
            <button
              className={styles.consoleBtn}
              onClick={onOpenConsole}
              title={`Open ${title} console`}
            >
              Open ↗
            </button>
          )}
          <button className={styles.menuBtn} title="Options">⋯</button>
        </div>
      </div>

      <div className={styles.body}>
        {children ?? (
          <div className={styles.placeholder}>
            <span className={styles.placeholderIcon}>⬡</span>
            <p className={styles.placeholderText}>{description ?? 'Service view — placeholder'}</p>
            {url && onOpenConsole && (
              <button className={styles.placeholderConsoleBtn} onClick={onOpenConsole}>
                Open Console ↗
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    online:  { label: 'Online',  cls: 'online' },
    offline: { label: 'Offline', cls: 'offline' },
    warning: { label: 'Warning', cls: 'warning' },
    loading: { label: 'Loading', cls: 'loading' },
  }
  const { label, cls } = map[status] ?? map.loading
  return <span className={`${styles.badge} ${styles[cls]}`}>{label}</span>
}
