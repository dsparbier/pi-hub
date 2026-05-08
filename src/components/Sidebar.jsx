import { useState, useRef, useCallback } from 'react'
import styles from './Sidebar.module.css'

const EMPTY_DRAG = { id: null, overId: null, pos: 'after', overGroupId: null }

// ── DragWrapper at module scope — React never sees a new component type ──────
function DragWrapper({ serviceId, drag, onDragStart, onDragOver, onDrop, onDragEnd, flashed, children }) {
  const isDragging   = drag.id     === serviceId
  const isOverBefore = drag.overId === serviceId && drag.pos === 'before'
  const isOverAfter  = drag.overId === serviceId && drag.pos === 'after'
  return (
    <div
      className={[
        styles.dragWrapper,
        isDragging   ? styles.dragging   : '',
        isOverBefore ? styles.dropBefore : '',
        isOverAfter  ? styles.dropAfter  : '',
        flashed      ? styles.flash      : '',
      ].filter(Boolean).join(' ')}
      draggable
      onDragStart={e => onDragStart(e, serviceId)}
      onDragOver={e => onDragOver(e, serviceId)}
      onDrop={e => onDrop(e, serviceId)}
      onDragEnd={onDragEnd}
    >
      {children}
    </div>
  )
}

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
  version,
}) {
  const [drag, _setDrag] = useState(EMPTY_DRAG)
  const dragRef = useRef(EMPTY_DRAG)
  const [flashId, setFlashId] = useState(null)

  // keep a ref in sync so stable callbacks always see current drag state
  function setDrag(next) {
    const value = typeof next === 'function' ? next(dragRef.current) : next
    dragRef.current = value
    _setDrag(value)
  }

  const dashboard = views.find(v => v.id === 'dashboard')

  const groupedServices = groups.map(g => ({
    ...g,
    items: services.filter(s => s.group === g.id),
  })).filter(g => g.items.length > 0)

  const ungrouped = services.filter(s => !s.group || !groups.find(g => g.id === s.group))

  // ── stable drag handlers ───────────────────────────────────────────────────
  const onDragStart = useCallback((e, id) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
    requestAnimationFrame(() => setDrag(d => ({ ...d, id })))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const onDragOver = useCallback((e, id) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const pos  = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    // skip setState when nothing changed to avoid thrashing
    const d = dragRef.current
    if (d.overId !== id || d.pos !== pos) {
      setDrag({ ...d, overId: id, pos, overGroupId: null })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const onDrop = useCallback((e, targetId) => {
    e.preventDefault()
    const srcId = e.dataTransfer.getData('text/plain')
    if (srcId && srcId !== targetId) {
      onReorderService(srcId, targetId, dragRef.current.pos === 'before')
      setFlashId(srcId)
      setTimeout(() => setFlashId(null), 600)
    }
    setDrag(EMPTY_DRAG)
  }, [onReorderService]) // eslint-disable-line react-hooks/exhaustive-deps

  const onDragEnd = useCallback(() => setDrag(EMPTY_DRAG), []) // eslint-disable-line react-hooks/exhaustive-deps

  function onDragOverGroup(e, groupId) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragRef.current.overGroupId !== groupId) {
      setDrag({ ...dragRef.current, overId: null, overGroupId: groupId })
    }
  }

  function onDropGroup(e, groupId) {
    e.preventDefault()
    const srcId = e.dataTransfer.getData('text/plain')
    if (srcId) {
      onMoveServiceToGroup(srcId, groupId)
      setFlashId(srcId)
      setTimeout(() => setFlashId(null), 600)
    }
    setDrag(EMPTY_DRAG)
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
                <DragWrapper
                  key={service.id}
                  serviceId={service.id}
                  drag={drag}
                  onDragStart={onDragStart}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  onDragEnd={onDragEnd}
                  flashed={flashId === service.id}
                >
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
              <DragWrapper
                key={service.id}
                serviceId={service.id}
                drag={drag}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
                flashed={flashId === service.id}
              >
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
          <span className={styles.version}>Pi-Hub v{version}</span>
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
