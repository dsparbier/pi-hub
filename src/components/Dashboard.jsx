import ServiceCard from './ServiceCard.jsx'
import styles from './Dashboard.module.css'

export default function Dashboard({ activeView, views, services, onOpenConsole }) {
  const view = views.find(v => v.id === activeView)
  const activeService = services.find(s => s.id === activeView)

  return (
    <div className={styles.dashboard}>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitle}>
          <span className={styles.pageTitleIcon}>{view?.icon}</span>
          <h1>{view?.label ?? 'Dashboard'}</h1>
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
          {activeView === 'dashboard' && (
            <button className={`${styles.btn} ${styles.btnPrimary}`}>＋ Add Panel</button>
          )}
        </div>
      </div>

      {activeView === 'dashboard'
        ? <DashboardOverview services={services} onOpenConsole={onOpenConsole} />
        : <ServiceDetail service={activeService} onOpenConsole={onOpenConsole} />
      }
    </div>
  )
}

function DashboardOverview({ services, onOpenConsole }) {
  return (
    <div className={styles.grid}>
      {services.map(service => (
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
  )
}

function ServiceDetail({ service, onOpenConsole }) {
  if (!service) return <EmptyState />

  return (
    <div className={styles.grid}>
      <ServiceCard
        title={`${service.label} — Overview`}
        icon={service.icon}
        status={service.status}
        description={service.description}
        size="wide"
        url={service.url}
        onOpenConsole={service.url ? () => onOpenConsole(service) : undefined}
      />
      <ServiceCard
        title="Status"
        icon="🔍"
        status={service.status}
        description="Health checks and uptime"
      />
      <ServiceCard
        title="Actions"
        icon="⚙"
        status="online"
        description="Restart, stop, configure"
      />
    </div>
  )
}

function EmptyState() {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon}>⬡</span>
      <p>No service found. Check your services config.</p>
    </div>
  )
}
