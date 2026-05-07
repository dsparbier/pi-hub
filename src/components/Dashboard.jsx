import { useState, useEffect, useRef } from 'react'
import HealthPanel from './HealthPanel.jsx'
import ServiceCard from './ServiceCard.jsx'
import WidgetPanel from './WidgetPanel.jsx'
import WidgetEditor from './WidgetEditor.jsx'
import { useHealthCheck } from '../hooks/useHealthCheck.js'
import { useWidgetConfig } from '../hooks/useWidgetConfig.js'
import styles from './Dashboard.module.css'

// ── Dashboard root ────────────────────────────────────────────────────────────
export default function Dashboard({ activeView, views, services, onOpenConsole }) {
  const view = views.find(v => v.id === activeView)
  const activeService = services.find(s => s.id === activeView)

  return (
    <div className={styles.dashboard}>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitle}>
          <span className={styles.pageTitleIcon}>{view?.icon}</span>
          <h1>{view?.label ?? 'Dashboard'}</h1>
          {activeService?.category && (
            <span className={styles.categoryBadge}>{activeService.category}</span>
          )}
        </div>
        <div className={styles.pageActions}>
          <button className={styles.btn}>Refresh</button>
          {activeService?.url && (
            <button
              className={`${styles.btn} ${styles.btnConsole}`}
              onClick={() => onOpenConsole(activeService)}
            >
              Open Console ↗
            </button>
          )}
          {activeService && (activeService.homeUrl || activeService.dashboardUrl || activeService.adminUrl || activeService.url) && (
            <a
              href={activeService.homeUrl || activeService.dashboardUrl || activeService.adminUrl || activeService.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.btn} ${styles.btnBrowser}`}
            >
              Open in Browser ↗
            </a>
          )}
          {activeView === 'dashboard' && (
            <button className={`${styles.btn} ${styles.btnPrimary}`}>＋ Add Panel</button>
          )}
        </div>
      </div>

      {activeView === 'dashboard'
        ? <DashboardOverview services={services} onOpenConsole={onOpenConsole} />
        : <ServiceDetail service={activeService} />
      }
    </div>
  )
}

// ── Dashboard overview (all services as cards) ────────────────────────────────
function DashboardOverview({ services, onOpenConsole }) {
  // Group by category for visual separation
  const categories = [...new Set(services.map(s => s.category).filter(Boolean))]
  const uncategorised = services.filter(s => !s.category)

  return (
    <div className={styles.sections}>
      {categories.map(cat => {
        const group = services.filter(s => s.category === cat)
        const online = group.filter(s => s.status === 'online').length
        return (
          <section key={cat} className={styles.categorySection}>
            <div className={styles.categoryHeadingRow}>
              <h2 className={styles.categoryHeading}>{cat.replace('-', ' ')}</h2>
              <span className={styles.categoryCount}>{online} / {group.length} online</span>
            </div>
            <div className={styles.grid}>
              {group.map(service => (
                <ServiceCardWithHealth
                  key={service.id}
                  service={service}
                  onOpenConsole={service.url ? () => onOpenConsole(service) : undefined}
                />
              ))}
            </div>
          </section>
        )
      })}
      {uncategorised.length > 0 && (
        <section className={styles.categorySection}>
          <div className={styles.categoryHeadingRow}>
            <h2 className={styles.categoryHeading}>Other</h2>
            <span className={styles.categoryCount}>{uncategorised.filter(s => s.status === 'online').length} / {uncategorised.length} online</span>
          </div>
          <div className={styles.grid}>
            {uncategorised.map(service => (
              <ServiceCardWithHealth
                key={service.id}
                service={service}
                onOpenConsole={service.url ? () => onOpenConsole(service) : undefined}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── ServiceCardWithHealth (wrapper) ───────────────────────────────────────────
function ServiceCardWithHealth({ service, onOpenConsole }) {
  const { results, checking, run } = useHealthCheck(service, null, onHealthResult)
  const [sparkData, setSparkData] = useState([])
  const historyRef = useRef([])

  function onHealthResult(checkId, result) {
    if (checkId === 'ping' && result.latency !== null) {
      historyRef.current.push(result.latency)
      if (historyRef.current.length > 30) {
        historyRef.current.shift()
      }
      setSparkData([...historyRef.current])
    }
  }

  useEffect(() => {
    run()
    const interval = setInterval(run, 30000)
    return () => clearInterval(interval)
  }, [run])

  const liveStatus = results.ping.status === 'online' ? 'online' : results.ping.status === 'timeout' ? 'offline' : 'unknown'

  return (
    <ServiceCard
      title={service.label}
      icon={service.icon}
      liveStatus={liveStatus}
      latency={results.ping.latency}
      sparkData={sparkData}
      checking={checking}
      url={service.url}
      onOpenConsole={onOpenConsole}
    />
  )
}

// ── Service detail ────────────────────────────────────────────────────────────
function ServiceDetail({ service }) {
  const { getWidgets, setWidgets } = useWidgetConfig()
  const { results, checking, run } = useHealthCheck(service, null, onHealthResult)
  const [latencyHistory, setLatencyHistory] = useState([])
  const [widgetEditorOpen, setWidgetEditorOpen] = useState(false)
  const historyRef = useRef([])

  function onHealthResult(checkId, result) {
    if (checkId === 'ping' && result.latency !== null) {
      historyRef.current.push(result.latency)
      if (historyRef.current.length > 30) {
        historyRef.current.shift()
      }
      setLatencyHistory([...historyRef.current])
    }
  }

  useEffect(() => {
    if (!service) return
    run()
    const interval = setInterval(run, 30000)
    return () => clearInterval(interval)
  }, [run, service])

  if (!service) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}>⬡</span>
        <p>Service not found.</p>
      </div>
    )
  }

  const widgets = getWidgets(service.id)

  return (
    <>
      <div className={styles.widgetBar}>
        <button className={styles.btn} onClick={() => setWidgetEditorOpen(true)}>✎ Edit Widgets</button>
      </div>
      <WidgetPanel widgets={widgets} results={results} latencyHistory={latencyHistory} />
      {widgetEditorOpen && (
        <WidgetEditor
          widgets={widgets}
          onUpdate={w => {
            setWidgets(service.id, w)
          }}
          onClose={() => setWidgetEditorOpen(false)}
        />
      )}
    </>
  )
}
