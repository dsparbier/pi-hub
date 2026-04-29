import HealthPanel from './HealthPanel.jsx'
import ServiceCard from './ServiceCard.jsx'
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
        return (
          <section key={cat} className={styles.categorySection}>
            <h2 className={styles.categoryHeading}>{cat.replace('-', ' ')}</h2>
            <div className={styles.grid}>
              {group.map(service => (
                <ServiceCard
                  key={service.id}
                  title={service.label}
                  icon={service.icon}
                  status={service.status}
                  description={service.description}
                  url={service.url}
                  onOpenConsole={service.url ? () => onOpenConsole(service) : undefined}
                />
              ))}
            </div>
          </section>
        )
      })}
      {uncategorised.length > 0 && (
        <section className={styles.categorySection}>
          <h2 className={styles.categoryHeading}>Other</h2>
          <div className={styles.grid}>
            {uncategorised.map(service => (
              <ServiceCard
                key={service.id}
                title={service.label}
                icon={service.icon}
                status={service.status}
                description={service.description}
                url={service.url}
                onOpenConsole={service.url ? () => onOpenConsole(service) : undefined}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Service detail ────────────────────────────────────────────────────────────
function ServiceDetail({ service }) {
  if (!service) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}>⬡</span>
        <p>Service not found.</p>
      </div>
    )
  }

  return <HealthPanel service={service} />
}
