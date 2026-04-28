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
 *   url         – console URL rendered in the embedded viewer (e.g. http://192.168.1.x:port)
 */
const services = [
  {
    id: 'adguard',
    label: 'AdGuard',
    icon: '🛡',
    description: 'DNS-level ad & tracker blocking',
    status: 'online',
    url: 'http://adguard.pi-hub.local',
  },
  {
    id: 'uptime-kuma',
    label: 'Uptime Kuma',
    icon: '📈',
    description: 'Service uptime monitoring and alerting',
    status: 'online',
    url: 'http://192.168.1.100:3001',
  },
  {
    id: 'portainer',
    label: 'Portainer',
    icon: '🐳',
    description: 'Docker container and stack management',
    status: 'online',
    url: 'http://192.168.1.100:9000',
  },
  {
    id: 'beszel',
    label: 'Beszel',
    icon: '📊',
    description: 'Lightweight system resource monitoring',
    status: 'online',
    url: 'http://192.168.1.100:8090',
  },
  {
    id: 'n8n',
    label: 'N8N',
    icon: '⚡',
    description: 'Workflow automation and integrations',
    status: 'online',
    url: 'http://192.168.1.100:5678',
  },
  {
    id: 'nginx',
    label: 'NGINX',
    icon: '🌐',
    description: 'Reverse proxy and web server',
    status: 'online',
    url: 'http://192.168.68.115',
  },
  {
    id: 'sql-hub',
    label: 'Sql-Hub',
    icon: '🗄',
    description: 'Database management and query interface',
    status: 'online',
    url: 'http://192.168.1.100:8080',
  },
  {
    id: 'tool-hub',
    label: 'Tool-Hub',
    icon: '🔧',
    description: 'Utility tools and scripts',
    status: 'online',
    url: 'http://192.168.1.100:8888',
  },
]

export default services
