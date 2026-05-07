import { useState } from 'react'
import styles from './WidgetEditor.module.css'

const WIDGET_TYPES = [
  { type: 'health-checks', label: 'Health Checks', icon: '✓', configurable: false },
  { type: 'latency-chart', label: 'Latency Chart', icon: '📈', configurable: false },
  { type: 'uptime-grid', label: 'Uptime Grid', icon: '⊞', configurable: true },
  { type: 'stat-latency', label: 'Latency Stats', icon: '#', configurable: false },
  { type: 'status-badge', label: 'Status Badge', icon: '●', configurable: false },
]

export default function WidgetEditor({ widgets, onUpdate, onClose }) {
  const [expandedId, setExpandedId] = useState(null)

  function handleRemove(id) {
    onUpdate(widgets.filter(w => w.id !== id))
  }

  function handleAdd(type) {
    const maxId = Math.max(...widgets.map(w => parseInt(w.id.replace('w-', '')) || 0), 0)
    const newWidget = {
      id: `w-${maxId + 1}`,
      type,
      order: widgets.length,
      ...(type === 'uptime-grid' && { config: { cols: 20 } }),
    }
    onUpdate([...widgets, newWidget])
  }

  function handleConfigChange(id, config) {
    onUpdate(widgets.map(w =>
      w.id === id ? { ...w, config: { ...w.config, ...config } } : w
    ))
  }

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <aside className={styles.drawer}>
        <div className={styles.header}>
          <h2 className={styles.title}>Edit Widgets</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.content}>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Current Widgets</h3>
            {widgets.length === 0 ? (
              <p className={styles.emptyText}>No widgets added yet</p>
            ) : (
              <div className={styles.widgetList}>
                {widgets.map(widget => {
                  const wtype = WIDGET_TYPES.find(t => t.type === widget.type)
                  const isExpanded = expandedId === widget.id
                  return (
                    <div key={widget.id} className={styles.widgetListItem}>
                      <div className={styles.widgetListItemRow}>
                        <span className={styles.widgetListIcon}>{wtype?.icon}</span>
                        <span className={styles.widgetListLabel}>{wtype?.label}</span>
                        {wtype?.configurable && (
                          <button
                            className={styles.configBtn}
                            onClick={() => setExpandedId(isExpanded ? null : widget.id)}
                            title="Configure"
                          >
                            ⚙
                          </button>
                        )}
                        <button
                          className={styles.removeBtn}
                          onClick={() => handleRemove(widget.id)}
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>

                      {isExpanded && widget.type === 'uptime-grid' && (
                        <div className={styles.configPanel}>
                          <label className={styles.configLabel}>
                            Columns:
                            <select
                              value={widget.config?.cols ?? 20}
                              onChange={e => handleConfigChange(widget.id, { cols: parseInt(e.target.value) })}
                              className={styles.configSelect}
                            >
                              <option value={10}>10</option>
                              <option value={15}>15</option>
                              <option value={20}>20</option>
                              <option value={30}>30</option>
                            </select>
                          </label>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Add Widget</h3>
            <div className={styles.typeGrid}>
              {WIDGET_TYPES.map(wtype => (
                <button
                  key={wtype.type}
                  className={styles.typeCard}
                  onClick={() => handleAdd(wtype.type)}
                  title={wtype.label}
                >
                  <span className={styles.typeIcon}>{wtype.icon}</span>
                  <span className={styles.typeName}>{wtype.label}</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className={styles.footer}>
          <button className={styles.btnClose} onClick={onClose}>Done</button>
        </div>
      </aside>
    </>
  )
}
