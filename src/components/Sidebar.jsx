import styles from './Sidebar.module.css'

export default function Sidebar({ views, activeView, onSelect, open, onManageServices }) {
  return (
    <aside className={`${styles.sidebar} ${open ? styles.open : styles.collapsed}`}>
      <nav className={styles.nav}>
        <div className={styles.section}>
          <span className={styles.sectionLabel}>Navigation</span>
          {views.map(view => (
            <button
              key={view.id}
              className={`${styles.navItem} ${activeView === view.id ? styles.active : ''}`}
              onClick={() => onSelect(view.id)}
            >
              <span className={styles.navIcon}>{view.icon}</span>
              {open && <span className={styles.navLabel}>{view.label}</span>}
            </button>
          ))}
        </div>

        <div className={styles.section}>
          <span className={styles.sectionLabel}>Manage</span>
          <button className={styles.navItem} onClick={onManageServices}>
            <span className={styles.navIcon}>⚙</span>
            {open && <span className={styles.navLabel}>Manage Services</span>}
          </button>
          <button className={styles.navItem}>
            <span className={styles.navIcon}>✎</span>
            {open && <span className={styles.navLabel}>Edit Layout</span>}
          </button>
        </div>
      </nav>

      {open && (
        <div className={styles.footer}>
          <span className={styles.version}>Pi-Hub v0.0.0</span>
        </div>
      )}
    </aside>
  )
}
