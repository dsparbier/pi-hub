import { useState } from 'react'
import styles from './ServiceConsole.module.css'

export default function ServiceConsole({ service, onClose }) {
  const [activeTab, setActiveTab] = useState('service')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const tabs = [
    { id: 'service', label: service.label, url: service.url },
    ...(service.links || []).map(link => ({
      id: link.id,
      label: link.label,
      url: link.url
    }))
  ]

  const activeTabData = tabs.find(t => t.id === activeTab) || tabs[0]

  function handleLoad() {
    setLoading(false)
  }

  function handleError() {
    setLoading(false)
    setLoadError(true)
  }

  function handleTabChange(tabId) {
    setActiveTab(tabId)
    setLoading(true)
    setLoadError(false)
  }

  return (
    <div className={styles.console}>
      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <button className={styles.backBtn} onClick={onClose}>
          <span className={styles.backArrow}>←</span>
          <span>{service.icon}</span>
          <span>{service.label}</span>
        </button>

        <div className={styles.urlBar}>
          <span className={styles.urlIcon}>🔒</span>
          <span className={styles.urlText}>{activeTabData.url}</span>
        </div>

        <div className={styles.toolbarRight}>
          <button
            className={styles.toolbarBtn}
            onClick={() => { setLoading(true); setLoadError(false) }}
            title="Reload"
          >
            ↺
          </button>
          <a
            className={styles.toolbarBtn}
            href={activeTabData.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in new tab"
          >
            ↗
          </a>
        </div>
      </div>

      {/* ── Tabs ── */}
      {tabs.length > 1 && (
        <div className={styles.tabBar}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Frame area ── */}
      <div className={styles.frameWrapper}>
        {loading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.spinner} />
            <span>Loading {activeTabData.label}…</span>
          </div>
        )}

        {loadError && (
          <div className={styles.errorBanner}>
            ⚠ This service may be blocking embedded display (X-Frame-Options).
            Try{' '}
            <a href={activeTabData.url} target="_blank" rel="noopener noreferrer">
              opening it in a new tab
            </a>{' '}
            instead.
          </div>
        )}

        <iframe
          key={activeTabData.id}
          src={activeTabData.url}
          title={activeTabData.label}
          className={styles.frame}
          onLoad={handleLoad}
          onError={handleError}
          allow="fullscreen"
        />
      </div>
    </div>
  )
}
