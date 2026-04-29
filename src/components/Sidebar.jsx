import { useState } from 'react'
import styles from './Sidebar.module.css'

const EMPTY_DRAG = { id: null, overId: null, pos: 'after', overGroupId: null }

export default function Sidebar({
  views,
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
  onReorderService,
  onMoveServiceToGroup,
}) {
  const [drag, setDrag] = useState(EMPTY_DRAG)

  const dashboard = views.find(v => v.id === 'dashboard')

  const groupedServices = groups.map(g => ({
    ...g,
    items: services.filter(s => s.group === g.id),
  })).filter(g => g.items.length > 0)

  const ungrouped = services.filter(s => !s.group || !groups.find(g => g.id === s.group))

  // ── drag handlers ──────────────────────────────────────────────────────────
  function onDragStart(e, id) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
    // slight delay so the browser renders the ghost before we fade the source
    requestAnimationFrame(() => setDrag(d => ({ ...d, id })))
  }

  function onDragOver(e, id) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const pos = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    setDrag(d => ({ ...d, overId: id, pos, overGroupId: null }))
  }

  function onDragOverGroup(e, groupId) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDrag(d => ({ ...d, overId: null, overGroupId: groupId }))
  }

  function onDrop(e, targetId) {
    e.preventDefault()
    const srcId = drag.id || e.dataTransfer.getData('text/plain')
    if (srcId && srcId !== targetId) {
      onReorderService(srcId, targetId, drag.pos === 'before')
    }
    setDrag(EMPTY_DRAG)
  }

  function onDropGroup(e, groupId) {
    e.preventDefault()
    const srcId = drag.id || e.dataTransfer.getData('text/plain')
    if (srcId) onMoveServiceToGroup(srcId, groupId)
    setDrag(EMPTY_DRAG)
  }

  function onDragEnd() {
    setDrag(EMPTY_DRAG)
  }

  // ── drag wrapper helper ────────────────────────────────────────────────────
  function DragWrapper({ service, indent, children }) {
    const isDragging = drag.id === service.id
    const isOverBefore = drag.overId === service.id && drag.pos === 'before'
    const isOverAfter  = drag.overId === service.id && drag.pos === 'after'
    return (
      <div
        className={[
          styles.dragWrapper,
          isDragging   ? styles.dragging   : '',
          isOverBefore ? styles.dropBefore : '',
          isOverAfter  ? styles.dropAfter  : '',
        ].join(' ')}
        draggable
        onDragStart={e => onDragStart(e, service.id)}
        onDragOver={e => onDragOver(e, service.id)}
        onDrop={e => onDrop(e, service.id)}
        onDragEnd={onDragEnd}
      >
        {children}
      </div>
    )
  }

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
          const isGroupOver = drag.overGroupId === group.id
          return (
            <div key={group.id} className={styles.section}>
              <button
                className={`${styles.groupHeader} ${isGroupOver ? styles.groupDragOver : ''}`}
                onClick={() => onToggleGroup(group.id)}
                onDragOver={e => onDragOverGroup(e, group.id)}
                onDragLeave={() => setDrag(d => ({ ...d, overGroupId: null }))}
                onDrop={e => onDropGroup(e, group.id)}
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

              {(!isCollapsed || !open) && group.items.map(service => (
                <DragWrapper key={service.id} service={service} indent={open}>
                  <NavItem
                    view={service}
                    active={activeView === service.id}
                    onSelect={onSelect}
                    open={open}
                    indent={open}
                  />
                </DragWrapper>
              ))}
            </div>
          )
        })}

        {/* ── Ungrouped ── */}
        {ungrouped.length > 0 && (
          <div className={styles.section}>
            {open && <span className={styles.sectionLabel}>Other</span>}
            {ungrouped.map(service => (
              <DragWrapper key={service.id} service={service}>
                <NavItem
                  view={service}
                  active={activeView === service.id}
                  onSelect={onSelect}
                  open={open}
                />
              </DragWrapper>
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
