import styles from './Sidebar.module.css'

export default function Sidebar({
  views,          // [DASHBOARD_VIEW, ...services]
  services,
  groups,
  activeView,
  onSelect,
  open,
  collapsedGroups,
  onToggleGroup,
  onManageServices,
  onEditLayout,
  onOpenLogs,
}) {
  const dashboard = views.find(v => v.id === 'dashboard')

  // Services by group
  const groupedServices = groups.map(g => ({
    ...g,
    items: services.filter(s => s.group === g.id),
  })).filter(g => g.items.length > 0)

  const ungrouped = services.filter(s => !s.group || !groups.find(g => g.id === s.group))

  return (
    <aside className={`${styles.sidebar} ${open ? styles.open : styles.collapsed}`}>
      <nav className={styles.nav}>

        {/* ── Dashboard ── */}
        <div className={styles.section}>
          <NavItem view={dashboard} active={activeView === 'dashboard'} onSelect={onSelect} open={open} />
        </div>

        {/* ── Grouped services ── */}
        {groupedServices.map(group => {
          const isCollapsed = collapsedGroups.has(group.id)
          return (
            <div key={group.id} className={styles.section}>
              {/* Group header */}
              <button
                className={styles.groupHeader}
                onClick={() => onToggleGroup(group.id)}
                title={open ? undefined : group.label}
              >
                <span className={styles.groupIcon}>{group.icon}</span>
                {open && (
                  <>
                    <span className={styles.groupLabel}>{group.label}</span>
                    <span className={`${styles.groupChevron} ${isCollapsed ? styles.chevronCollapsed : ''}`}>›</span>
                  </>
                )}
              </button>

              {/* Group items */}
              {(!isCollapsed || !open) && group.items.map(service => (
                <NavItem
                  key={service.id}
                  view={service}
                  active={activeView === service.id}
                  onSelect={onSelect}
                  open={open}
                  indent={open}
                />
              ))}
            </div>
          )
        })}

        {/* ── Ungrouped ── */}
        {ungrouped.length > 0 && (
          <div className={styles.section}>
            {open && <span className={styles.sectionLabel}>Other</span>}
            {ungrouped.map(service => (
              <NavItem
                key={service.id}
                view={service}
                active={activeView === service.id}
                onSelect={onSelect}
                open={open}
              />
            ))}
          </div>
        )}

        {/* ── Manage ── */}
        <div className={styles.section}>
          {open && <span className={styles.sectionLabel}>Manage</span>}
          <button className={styles.navItem} onClick={onManageServices}>
            <span className={styles.navIcon}>⚙</span>
            {open && <span className={styles.navLabel}>Manage Services</span>}
          </button>
          <button className={styles.navItem} onClick={onEditLayout}>
            <span className={styles.navIcon}>✎</span>
            {open && <span className={styles.navLabel}>Edit Layout</span>}
          </button>
          <button className={styles.navItem} onClick={onOpenLogs}>
            <span className={styles.navIcon}>📋</span>
            {open && <span className={styles.navLabel}>Logs</span>}
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

function NavItem({ view, active, onSelect, open, indent }) {
  return (
    <button
      className={`${styles.navItem} ${active ? styles.active : ''} ${indent ? styles.indent : ''}`}
      onClick={() => onSelect(view.id)}
      title={open ? undefined : view.label}
    >
      <span className={styles.navIcon}>{view.icon}</span>
      {open && <span className={styles.navLabel}>{view.label}</span>}
    </button>
  )
}
