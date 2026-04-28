import ServiceCard from './ServiceCard.jsx'
import styles from './Dashboard.module.css'

const SERVICE_CARDS = {
  dashboard: [
    { id: 'pihole',   title: 'Pi-hole',        icon: '🛡', status: 'online',  size: 'medium', description: 'DNS blocking stats and controls' },
    { id: 'ha',       title: 'Home Assistant', icon: '🏠', status: 'online',  size: 'medium', description: 'Home automation overview' },
    { id: 'jellyfin', title: 'Jellyfin',       icon: '▶', status: 'warning', size: 'medium', description: 'Media server status' },
    { id: 'portainer',title: 'Portainer',      icon: '🐳', status: 'online',  size: 'medium', description: 'Docker container management' },
    { id: 'system',   title: 'System',         icon: '📊', status: 'online',  size: 'wide',   description: 'CPU / Memory / Disk / Temp' },
  ],
  pihole: [
    { id: 'pihole-stats',  title: 'Pi-hole Stats',   icon: '🛡', status: 'online', size: 'wide',   description: 'Queries blocked, DNS activity' },
    { id: 'pihole-lists',  title: 'Blocklists',      icon: '📋', status: 'online', size: 'medium', description: 'Manage block/allow lists' },
    { id: 'pihole-query',  title: 'Query Log',       icon: '🔍', status: 'online', size: 'medium', description: 'Live DNS query feed' },
  ],
  homeassistant: [
    { id: 'ha-devices', title: 'Devices',    icon: '🏠', status: 'online', size: 'wide',   description: 'Connected devices overview' },
    { id: 'ha-rooms',   title: 'Rooms',      icon: '🚪', status: 'online', size: 'medium', description: 'Room states and controls' },
    { id: 'ha-autos',   title: 'Automations',icon: '⚡', status: 'online', size: 'medium', description: 'Active automation rules' },
  ],
  jellyfin: [
    { id: 'jf-streams', title: 'Active Streams', icon: '▶', status: 'warning', size: 'wide',   description: 'Currently playing sessions' },
    { id: 'jf-library', title: 'Library',        icon: '🎬', status: 'online',  size: 'medium', description: 'Media library stats' },
    { id: 'jf-users',   title: 'Users',          icon: '👤', status: 'online',  size: 'medium', description: 'User activity' },
  ],
  portainer: [
    { id: 'pt-containers', title: 'Containers', icon: '🐳', status: 'online', size: 'wide',   description: 'Running / stopped containers' },
    { id: 'pt-stacks',     title: 'Stacks',     icon: '📦', status: 'online', size: 'medium', description: 'Compose stack management' },
    { id: 'pt-images',     title: 'Images',     icon: '💾', status: 'online', size: 'medium', description: 'Docker images' },
  ],
  system: [
    { id: 'sys-cpu',   title: 'CPU',         icon: '⚡', status: 'online', size: 'medium', description: 'CPU usage and frequency' },
    { id: 'sys-mem',   title: 'Memory',      icon: '💾', status: 'online', size: 'medium', description: 'RAM / swap usage' },
    { id: 'sys-disk',  title: 'Disk',        icon: '💿', status: 'online', size: 'medium', description: 'Disk usage per mount' },
    { id: 'sys-temp',  title: 'Temperature', icon: '🌡', status: 'warning', size: 'medium', description: 'Pi thermal sensors' },
    { id: 'sys-net',   title: 'Network',     icon: '🌐', status: 'online', size: 'wide',   description: 'Bandwidth in / out' },
  ],
}

export default function Dashboard({ activeView, views }) {
  const view = views.find(v => v.id === activeView)
  const cards = SERVICE_CARDS[activeView] ?? []

  return (
    <div className={styles.dashboard}>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitle}>
          <span className={styles.pageTitleIcon}>{view?.icon}</span>
          <h1>{view?.label ?? 'Dashboard'}</h1>
        </div>
        <div className={styles.pageActions}>
          <button className={styles.btn}>Refresh</button>
          <button className={`${styles.btn} ${styles.btnPrimary}`}>＋ Add Panel</button>
        </div>
      </div>

      {cards.length === 0 ? (
        <EmptyState />
      ) : (
        <div className={styles.grid}>
          {cards.map(card => (
            <ServiceCard key={card.id} {...card} />
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon}>⬡</span>
      <p>No panels configured for this view.</p>
      <button className={styles.btn}>＋ Add Panel</button>
    </div>
  )
}
