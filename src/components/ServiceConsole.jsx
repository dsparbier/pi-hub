import { useState } from 'react'
import styles from './ServiceConsole.module.css'

export default function ServiceConsole({ service, onClose }) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  function handleLoad() {
    setLoading(false)
  }

  // iframes blocked by X-Frame-Options appear as a load event with no content
  // we can't detect this reliably cross-origin, so we surface a soft warning
  function handleError() {
    setLoading(false)
    setLoadError(true)
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
          <span className={styles.urlText}>{service.url}</span>
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
            href={service.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in new tab"
          >
            ↗
          </a>
        </div>
      </div>

      {/* ── Frame area ── */}
      <div className={styles.frameWrapper}>
        {loading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.spinner} />
            <span>Loading {service.label}…</span>
          </div>
        )}

        {loadError && (
          <div className={styles.errorBanner}>
            ⚠ This service may be blocking embedded display (X-Frame-Options).
            Try{' '}
            <a href={service.url} target="_blank" rel="noopener noreferrer">
              opening it in a new tab
            </a>{' '}
            instead.
          </div>
        )}

        <iframe
          key={service.url}
          src={service.url}
          title={service.label}
          className={styles.frame}
          onLoad={handleLoad}
          onError={handleError}
          allow="fullscreen"
        />
      </div>
    </div>
  )
}
