/**
 * Central service registry.
 *
 * Fields:
 *   id           – unique slug
 *   label        – display name
 *   icon         – emoji
 *   description  – short blurb
 *   category     – drives monitoring widget layout (see Dashboard.jsx)
 *   group        – sidebar group id (see groups.js) or omit for ungrouped
 *   status       – 'online' | 'offline' | 'warning' | 'loading'
 *   url          – console URL for the embedded viewer
 *   healthChecks – optional custom HTTP checks shown in the Health panel
 *     .custom[]  – { id, label, method: 'GET'|'POST', url, body? }
 */
const services = [

  // ── Infrastructure ───────────────────────────────────────────────
  {
    id: 'adguard',
    label: 'AdGuard',
    icon: '🛡',
    description: 'DNS-level ad & tracker blocking',
    category: 'security',
    group: 'infrastructure',
    status: 'online',
    url: 'http://adguard.pi-hub.local',
    healthChecks: {
      custom: [
        { id: 'status-api', label: 'Status API', method: 'GET',  url: 'http://adguard.pi-hub.local/control/status' },
        { id: 'dns-query',  label: 'DNS Stats',  method: 'GET',  url: 'http://adguard.pi-hub.local/control/stats' },
      ],
    },
  },
  {
    id: 'nginx',
    label: 'NGINX',
    icon: '🌐',
    description: 'Reverse proxy and web server',
    category: 'proxy',
    group: 'infrastructure',
    status: 'online',
    url: 'http://nginx-proxy.pi-hub.local',
    healthChecks: {
      custom: [
        { id: 'proxy-ui', label: 'Proxy UI',  method: 'GET', url: 'http://nginx-proxy.pi-hub.local' },
        { id: 'api',      label: 'NPM API',   method: 'GET', url: 'http://192.168.68.115:81/api' },
      ],
    },
  },
  {
    id: 'portainer',
    label: 'Portainer',
    icon: '🐳',
    description: 'Docker container and stack management',
    category: 'containers',
    group: 'infrastructure',
    status: 'online',
    url: 'http://portainer.pi-hub.local',
    healthChecks: {
      custom: [
        { id: 'api-status', label: 'API Status', method: 'GET', url: 'http://portainer.pi-hub.local/api/status' },
      ],
    },
  },

  // ── Monitoring ───────────────────────────────────────────────────
  {
    id: 'uptime-kuma',
    label: 'Uptime Kuma',
    icon: '📈',
    description: 'Service uptime monitoring and alerting',
    category: 'monitoring',
    group: 'monitoring',
    status: 'online',
    url: 'http://uptime-kuma.pi-hub.local',
  },
  {
    id: 'netdata',
    label: 'Netdata',
    icon: '📡',
    description: 'Real-time system performance metrics',
    category: 'system',
    group: 'monitoring',
    status: 'online',
    url: 'http://netdata.pi-hub.local',
    healthChecks: {
      custom: [
        { id: 'api-info', label: 'API Info', method: 'GET', url: 'http://netdata.pi-hub.local/api/v1/info' },
      ],
    },
  },
  {
    id: 'beszel',
    label: 'Beszel',
    icon: '📊',
    description: 'Lightweight system resource monitoring',
    category: 'system',
    group: 'monitoring',
    status: 'online',
    url: 'http://beszel.pi-hub.local',
  },
  {
    id: 'speedtest-tracker',
    label: 'Speedtest Tracker',
    icon: '📶',
    description: 'Scheduled internet speed test history',
    category: 'network',
    group: 'monitoring',
    status: 'online',
    url: 'http://speedtest-tracker.pi-hub.local',
  },
  {
    id: 'openspeedtest',
    label: 'OpenSpeedTest',
    icon: '🚀',
    description: 'On-demand LAN / WAN speed tests',
    category: 'network',
    group: 'monitoring',
    status: 'online',
    url: 'http://openspeedtest.pi-hub.local',
  },

  // ── AI & Agents ──────────────────────────────────────────────────
  {
    id: 'open-webui',
    label: 'Open WebUI',
    icon: '🤖',
    description: 'Chat interface for local LLM models via Ollama',
    category: 'ai',
    group: 'ai',
    status: 'online',
    url: 'http://open-webui.pi-hub.local',
  },
  {
    id: 'jarvis',
    label: 'Jarvis',
    icon: '🎯',
    description: 'AI assistant agent',
    category: 'ai-agent',
    group: 'ai',
    status: 'online',
    url: 'http://jarvis.ai.local',
  },
  {
    id: 'derek',
    label: 'Derek',
    icon: '💡',
    description: 'AI assistant agent',
    category: 'ai-agent',
    group: 'ai',
    status: 'online',
    url: 'http://derek.ai.local',
  },
  {
    id: 'lois',
    label: 'Lois',
    icon: '🌸',
    description: 'AI assistant agent',
    category: 'ai-agent',
    group: 'ai',
    status: 'online',
    url: 'http://lois.ai.local',
  },
  {
    id: 'pepper',
    label: 'Pepper',
    icon: '🌶',
    description: 'AI assistant agent',
    category: 'ai-agent',
    group: 'ai',
    status: 'online',
    url: 'http://pepper.ai.local',
  },
  {
    id: 'alfred',
    label: 'Alfred',
    icon: '🎩',
    description: 'AI assistant agent',
    category: 'ai-agent',
    group: 'ai',
    status: 'online',
    url: 'http://alfred.ai.local',
  },

  // ── Data & Tools ─────────────────────────────────────────────────
  {
    id: 'n8n',
    label: 'N8N',
    icon: '⚡',
    description: 'Workflow automation and integrations',
    category: 'automation',
    group: 'data-tools',
    status: 'online',
    url: 'http://n8n.pi-hub.local',
  },
  {
    id: 'sql-hub',
    label: 'Sql-Hub',
    icon: '🗄',
    description: 'Database management and query interface',
    category: 'database',
    group: 'data-tools',
    status: 'online',
    url: 'http://192.168.68.115:1234',
  },
  {
    id: 'pocketbase',
    label: 'PocketBase',
    icon: '🗃',
    description: 'Open source backend with realtime database',
    category: 'database',
    group: 'data-tools',
    status: 'online',
    url: 'http://pocketbase.pi-hub.local',
    healthChecks: {
      custom: [
        { id: 'health', label: 'Health', method: 'GET', url: 'http://pocketbase.pi-hub.local/api/health' },
      ],
    },
  },
  {
    id: 'tool-hub',
    label: 'Tool-Hub',
    icon: '🔧',
    description: 'Utility tools and scripts',
    category: 'tools',
    group: 'data-tools',
    status: 'online',
    url: 'http://tool-hub.pi-hub.local',
  },
]

export default services
