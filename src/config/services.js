/**
 * Central service registry.
 * Add a new entry here to have it appear in the sidebar and dashboard.
 *
 * Fields:
 *   id          – unique slug used in routing/state
 *   label       – display name
 *   icon        – emoji shown in sidebar and panel header
 *   description – short blurb shown on the placeholder card
 *   status      – 'online' | 'offline' | 'warning' | 'loading'
 *   url         – optional: direct link to the service (future use)
 */
const services = [
  {
    id: 'adguard',
    label: 'AdGuard',
    icon: '🛡',
    description: 'DNS-level ad & tracker blocking',
    status: 'online',
  },
  {
    id: 'uptime-kuma',
    label: 'Uptime Kuma',
    icon: '📈',
    description: 'Service uptime monitoring and alerting',
    status: 'online',
  },
  {
    id: 'portainer',
    label: 'Portainer',
    icon: '🐳',
    description: 'Docker container and stack management',
    status: 'online',
  },
  {
    id: 'beszel',
    label: 'Beszel',
    icon: '📊',
    description: 'Lightweight system resource monitoring',
    status: 'online',
  },
  {
    id: 'n8n',
    label: 'N8N',
    icon: '⚡',
    description: 'Workflow automation and integrations',
    status: 'online',
  },
  {
    id: 'nginx',
    label: 'NGINX',
    icon: '🌐',
    description: 'Reverse proxy and web server',
    status: 'online',
  },
  {
    id: 'sql-hub',
    label: 'Sql-Hub',
    icon: '🗄',
    description: 'Database management and query interface',
    status: 'online',
  },
  {
    id: 'tool-hub',
    label: 'Tool-Hub',
    icon: '🔧',
    description: 'Utility tools and scripts',
    status: 'online',
  },
]

export default services
