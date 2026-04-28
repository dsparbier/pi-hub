import styles from './ServiceCard.module.css'

export default function ServiceCard({ title, icon, status = 'online', description, children, size = 'medium' }) {
  return (
    <div className={`${styles.card} ${styles[size]}`}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.icon}>{icon}</span>
          <h3 className={styles.title}>{title}</h3>
        </div>
        <div className={styles.headerRight}>
          <StatusBadge status={status} />
          <button className={styles.menuBtn} title="Options">⋯</button>
        </div>
      </div>

      <div className={styles.body}>
        {children ?? (
          <div className={styles.placeholder}>
            <span className={styles.placeholderIcon}>⬡</span>
            <p className={styles.placeholderText}>{description ?? 'Service view — placeholder'}</p>
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
