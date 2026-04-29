import { useState, useEffect, useRef } from 'react'
import { useLogger, LOG_LEVELS } from '../context/LoggerContext.jsx'
import styles from './LogViewer.module.css'

const LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR']
const LEVEL_LABELS = { DEBUG: 'DBG', INFO: 'INF', WARN: 'WRN', ERROR: 'ERR' }

export default function LogViewer({ onClose, services }) {
  const { logs, minLevel, setMinLevel, clear } = useLogger()
  const [filterLevel,   setFilterLevel]   = useState('DEBUG')
  const [filterService, setFilterService] = useState('all')
  const [filterText,    setFilterText]    = useState('')
  const [autoScroll,    setAutoScroll]    = useState(true)
  const bottomRef = useRef(null)

  const serviceIds = ['all', ...new Set(logs.map(l => l.service))]

  const visible = logs.filter(l =>
    LOG_LEVELS[l.level] >= LOG_LEVELS[filterLevel] &&
    (filterService === 'all' || l.service === filterService) &&
    (filterText === '' || l.message.toLowerCase().includes(filterText.toLowerCase()) || l.service.toLowerCase().includes(filterText.toLowerCase()))
  )

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [visible.length, autoScroll])

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <aside className={styles.drawer}>
        {/* Header */}
        <div className={styles.drawerHeader}>
          <div className={styles.headerLeft}>
            <h2 className={styles.drawerTitle}>📋 Pi-Hub Logs</h2>
            <span className={styles.countBadge}>{visible.length} / {logs.length}</span>
          </div>
          <div className={styles.headerRight}>
            <button className={styles.clearBtn} onClick={clear} title="Clear all logs">Clear</button>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Controls */}
        <div className={styles.controls}>
          <div className={styles.controlRow}>
            <label className={styles.controlLabel}>Min level (emit)</label>
            <div className={styles.levelBtns}>
              {LEVELS.map(l => (
                <button
                  key={l}
                  className={`${styles.levelBtn} ${styles[`lvl_${l}`]} ${minLevel === l ? styles.levelBtnActive : ''}`}
                  onClick={() => setMinLevel(l)}
                  title={`Emit ${l} and above`}
                >
                  {LEVEL_LABELS[l]}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.controlRow}>
            <label className={styles.controlLabel}>Filter view</label>
            <div className={styles.levelBtns}>
              {LEVELS.map(l => (
                <button
                  key={l}
                  className={`${styles.levelBtn} ${styles[`lvl_${l}`]} ${filterLevel === l ? styles.levelBtnActive : ''}`}
                  onClick={() => setFilterLevel(l)}
                >
                  {LEVEL_LABELS[l]}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterRow}>
            <select
              className={styles.serviceSelect}
              value={filterService}
              onChange={e => setFilterService(e.target.value)}
            >
              {serviceIds.map(id => (
                <option key={id} value={id}>{id === 'all' ? 'All services' : id}</option>
              ))}
            </select>
            <input
              className={styles.search}
              placeholder="Search…"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
            />
            <label className={styles.autoScrollLabel}>
              <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} />
              Auto-scroll
            </label>
          </div>
        </div>

        {/* Log entries */}
        <div className={styles.logBody}>
          {visible.length === 0 && (
            <div className={styles.empty}>No log entries match the current filters.</div>
          )}
          {visible.map(entry => (
            <LogEntry key={entry.id} entry={entry} />
          ))}
          <div ref={bottomRef} />
        </div>
      </aside>
    </>
  )
}

function LogEntry({ entry }) {
  const [expanded, setExpanded] = useState(false)
  const ts = entry.timestamp.replace('T', ' ').slice(0, 23)

  return (
    <div
      className={`${styles.entry} ${styles[`entry_${entry.level}`]}`}
      onClick={() => entry.data && setExpanded(e => !e)}
      style={{ cursor: entry.data ? 'pointer' : 'default' }}
    >
      <span className={styles.entryTs}>{ts}</span>
      <span className={`${styles.entryLevel} ${styles[`lvl_${entry.level}`]}`}>
        {LEVEL_LABELS[entry.level]}
      </span>
      <span className={styles.entrySvc}>{entry.service}</span>
      <span className={styles.entryMsg}>{entry.message}</span>
      {entry.data && <span className={styles.entryExpand}>{expanded ? '▲' : '▼'}</span>}
      {expanded && entry.data && (
        <pre className={styles.entryData}>{JSON.stringify(entry.data, null, 2)}</pre>
      )}
    </div>
  )
}
