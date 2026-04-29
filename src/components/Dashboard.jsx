import ServiceCard from './ServiceCard.jsx'
import WidgetPlaceholder from './WidgetPlaceholder.jsx'
import HealthPanel from './HealthPanel.jsx'
import styles from './Dashboard.module.css'

// ── Widget layouts per service category ──────────────────────────────────────
const CATEGORY_WIDGETS = {
  security: [
    { id: 'queries',  title: 'DNS Queries',    icon: '🔍', size: 'medium', type: 'stat' },
    { id: 'blocked',  title: 'Blocked',        icon: '🛡',  size: 'medium', type: 'stat',  sublabel: 'Today' },
    { id: 'clients',  title: 'Active Clients', icon: '💻', size: 'medium', type: 'stat' },
    { id: 'history',  title: 'Query Log',      icon: '📈', size: 'wide',   type: 'chart', series: 2 },
  ],
  monitoring: [
    { id: 'uptime',   title: 'Service Uptime',  icon: '📈', size: 'wide',   type: 'grid', rows: 4, cols: 20 },
    { id: 'response', title: 'Response Times',  icon: '⏱',  size: 'wide',   type: 'chart' },
    { id: 'incidents',title: 'Incidents',       icon: '🚨', size: 'medium', type: 'list', rows: 3 },
  ],
  system: [
    { id: 'cpu',   title: 'CPU',          icon: '⚡',  size: 'medium', type: 'stat',  unit: '%' },
    { id: 'mem',   title: 'Memory',       icon: '💾',  size: 'medium', type: 'bar',   segments: 1, labels: ['RAM'] },
    { id: 'disk',  title: 'Disk',         icon: '💿',  size: 'medium', type: 'bar',   segments: 2, labels: ['/', '/data'] },
    { id: 'temp',  title: 'Temperature',  icon: '🌡',  size: 'medium', type: 'stat',  unit: '°C' },
    { id: 'net',   title: 'Network I/O',  icon: '🌐',  size: 'wide',   type: 'chart', series: 2 },
  ],
  network: [
    { id: 'dl',      title: 'Download',      icon: '⬇',  size: 'medium', type: 'stat',  unit: 'Mbps' },
    { id: 'ul',      title: 'Upload',        icon: '⬆',  size: 'medium', type: 'stat',  unit: 'Mbps' },
    { id: 'ping',    title: 'Ping',          icon: '📡', size: 'medium', type: 'stat',  unit: 'ms' },
    { id: 'history', title: 'Speed History', icon: '📊', size: 'wide',   type: 'chart', series: 2 },
  ],
  containers: [
    { id: 'running', title: 'Running',    icon: '✅', size: 'medium', type: 'stat' },
    { id: 'stopped', title: 'Stopped',   icon: '⏹',  size: 'medium', type: 'stat' },
    { id: 'images',  title: 'Images',    icon: '📦', size: 'medium', type: 'stat' },
    { id: 'list',    title: 'Containers',icon: '🐳', size: 'wide',   type: 'list', rows: 5 },
  ],
  automation: [
    { id: 'active',  title: 'Active Workflows',  icon: '⚡', size: 'medium', type: 'stat' },
    { id: 'runs',    title: 'Executions Today',  icon: '▶',  size: 'medium', type: 'stat' },
    { id: 'errors',  title: 'Errors',            icon: '🚨', size: 'medium', type: 'stat' },
    { id: 'log',     title: 'Execution Log',     icon: '📋', size: 'wide',   type: 'list', rows: 5 },
  ],
  ai: [
    { id: 'models',   title: 'Loaded Models',   icon: '🧠', size: 'medium', type: 'stat' },
    { id: 'sessions', title: 'Active Sessions', icon: '💬', size: 'medium', type: 'stat' },
    { id: 'vram',     title: 'VRAM Usage',      icon: '🎮', size: 'medium', type: 'bar',  segments: 1, labels: ['GPU'] },
    { id: 'history',  title: 'Request Volume',  icon: '📈', size: 'wide',   type: 'chart' },
  ],
  'ai-agent': [
    { id: 'status',   title: 'Agent Status',   icon: '💡', size: 'medium', type: 'stat' },
    { id: 'messages', title: 'Messages Today', icon: '💬', size: 'medium', type: 'stat' },
    { id: 'memory',   title: 'Memory',         icon: '🧠', size: 'medium', type: 'bar',  segments: 1, labels: ['Heap'] },
    { id: 'log',      title: 'Activity Log',   icon: '📋', size: 'wide',   type: 'list', rows: 4 },
  ],
  database: [
    { id: 'tables',   title: 'Collections',   icon: '📊', size: 'medium', type: 'stat' },
    { id: 'records',  title: 'Total Records', icon: '📝', size: 'medium', type: 'stat' },
    { id: 'storage',  title: 'Storage',       icon: '💿', size: 'medium', type: 'bar',  segments: 1, labels: ['Used'] },
    { id: 'activity', title: 'Query Activity',icon: '📈', size: 'wide',   type: 'chart' },
  ],
  proxy: [
    { id: 'hosts',    title: 'Proxy Hosts',  icon: '🌐', size: 'medium', type: 'stat' },
    { id: 'reqs',     title: 'Req / min',    icon: '📈', size: 'medium', type: 'stat' },
    { id: 'certs',    title: 'SSL Certs',    icon: '🔒', size: 'medium', type: 'stat' },
    { id: 'traffic',  title: 'Traffic',      icon: '📊', size: 'wide',   type: 'chart', series: 2 },
  ],
}

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
        : <ServiceDetail service={activeService} onOpenConsole={onOpenConsole} />
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

// ── Service detail (single service + category widgets) ────────────────────────
function ServiceDetail({ service, onOpenConsole }) {
  if (!service) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}>⬡</span>
        <p>Service not found.</p>
      </div>
    )
  }

  const widgets = CATEGORY_WIDGETS[service.category] ?? []

  return (
    <div className={styles.grid}>
      {/* Top-of-page overview card */}
      <ServiceCard
        title={`${service.label} — Overview`}
        icon={service.icon}
        status={service.status}
        description={service.description}
        size="wide"
        url={service.url}
        onOpenConsole={service.url ? () => onOpenConsole(service) : undefined}
      />

      {/* Health check panel — spans full grid width */}
      <div className={styles.fullWidth}>
        <HealthPanel service={service} />
      </div>

      {/* Category-driven monitoring widget placeholders */}
      {widgets.map(w => (
        <ServiceCard
          key={w.id}
          title={w.title}
          icon={w.icon}
          status={service.status}
          size={w.size}
        >
          <WidgetPlaceholder
            type={w.type}
            unit={w.unit}
            sublabel={w.sublabel}
            segments={w.segments}
            labels={w.labels}
            series={w.series}
            rows={w.rows}
            cols={w.cols}
          />
        </ServiceCard>
      ))}

      {/* Default fallback cards when no category widgets defined */}
      {widgets.length === 0 && (
        <>
          <ServiceCard title="Status"  icon="🔍" status={service.status} description="Health checks and uptime" />
          <ServiceCard title="Actions" icon="⚙"  status="online"         description="Restart, stop, configure" />
        </>
      )}
    </div>
  )
}
