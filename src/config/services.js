/**
 * Central service registry.
 * Add a new entry here to have it appear in the sidebar and dashboard.
 *
 * Fields:
 *   id          – unique slug
 *   label       – display name
 *   icon        – emoji
 *   description – short blurb
 *   category    – drives which monitoring widgets appear on the detail page
 *   status      – 'online' | 'offline' | 'warning' | 'loading'
 *   url         – console URL for the embedded viewer
 *
 * Categories: security | monitoring | network | system | containers |
 *             automation | ai | ai-agent | database | proxy | tools
 */
const services = [

  // ── Security ────────────────────────────────────────────────────
  {
    id: 'adguard',
    label: 'AdGuard',
    icon: '🛡',
    description: 'DNS-level ad & tracker blocking',
    category: 'security',
    status: 'online',
    url: 'http://adguard.pi-hub.local',
  },

  // ── Monitoring ──────────────────────────────────────────────────
  {
    id: 'uptime-kuma',
    label: 'Uptime Kuma',
    icon: '📈',
    description: 'Service uptime monitoring and alerting',
    category: 'monitoring',
    status: 'online',
    url: 'http://uptime-kuma.pi-hub.local',
  },
  {
    id: 'netdata',
    label: 'Netdata',
    icon: '📡',
    description: 'Real-time system performance metrics',
    category: 'system',
    status: 'online',
    url: 'http://netdata.pi-hub.local',
  },
  {
    id: 'beszel',
    label: 'Beszel',
    icon: '📊',
    description: 'Lightweight system resource monitoring',
    category: 'system',
    status: 'online',
    url: 'http://beszel.pi-hub.local',
  },

  // ── Network / Speed ─────────────────────────────────────────────
  {
    id: 'speedtest-tracker',
    label: 'Speedtest Tracker',
    icon: '📶',
    description: 'Scheduled internet speed test history',
    category: 'network',
    status: 'online',
    url: 'http://speedtest-tracker.pi-hub.local',
  },
  {
    id: 'openspeedtest',
    label: 'OpenSpeedTest',
    icon: '🚀',
    description: 'On-demand LAN / WAN speed tests',
    category: 'network',
    status: 'online',
    url: 'http://openspeedtest.pi-hub.local',
  },

  // ── Containers / Infrastructure ─────────────────────────────────
  {
    id: 'portainer',
    label: 'Portainer',
    icon: '🐳',
    description: 'Docker container and stack management',
    category: 'containers',
    status: 'online',
    url: 'http://portainer.pi-hub.local',
  },
  {
    id: 'nginx',
    label: 'NGINX',
    icon: '🌐',
    description: 'Reverse proxy and web server',
    category: 'proxy',
    status: 'online',
    url: 'http://nginx-proxy.pi-hub.local',
  },

  // ── Automation ──────────────────────────────────────────────────
  {
    id: 'n8n',
    label: 'N8N',
    icon: '⚡',
    description: 'Workflow automation and integrations',
    category: 'automation',
    status: 'online',
    url: 'http://n8n.pi-hub.local',
  },

  // ── AI / ML ─────────────────────────────────────────────────────
  {
    id: 'open-webui',
    label: 'Open WebUI',
    icon: '🤖',
    description: 'Chat interface for local LLM models via Ollama',
    category: 'ai',
    status: 'online',
    url: 'http://open-webui.pi-hub.local',
  },

  // ── AI Agents ───────────────────────────────────────────────────
  {
    id: 'jarvis',
    label: 'Jarvis',
    icon: '🎯',
    description: 'AI assistant agent',
    category: 'ai-agent',
    status: 'online',
    url: 'http://jarvis.ai.local',
  },
  {
    id: 'derek',
    label: 'Derek',
    icon: '💡',
    description: 'AI assistant agent',
    category: 'ai-agent',
    status: 'online',
    url: 'http://derek.ai.local',
  },
  {
    id: 'lois',
    label: 'Lois',
    icon: '🌸',
    description: 'AI assistant agent',
    category: 'ai-agent',
    status: 'online',
    url: 'http://lois.ai.local',
  },
  {
    id: 'pepper',
    label: 'Pepper',
    icon: '🌶',
    description: 'AI assistant agent',
    category: 'ai-agent',
    status: 'online',
    url: 'http://pepper.ai.local',
  },
  {
    id: 'alfred',
    label: 'Alfred',
    icon: '🎩',
    description: 'AI assistant agent',
    category: 'ai-agent',
    status: 'online',
    url: 'http://alfred.ai.local',
  },

  // ── Database / Storage ──────────────────────────────────────────
  {
    id: 'sql-hub',
    label: 'Sql-Hub',
    icon: '🗄',
    description: 'Database management and query interface',
    category: 'database',
    status: 'online',
    url: 'http://192.168.68.115:1234',
  },
  {
    id: 'pocketbase',
    label: 'PocketBase',
    icon: '🗃',
    description: 'Open source backend with realtime database',
    category: 'database',
    status: 'online',
    url: 'http://pocketbase.pi-hub.local',
  },

  // ── Tools ───────────────────────────────────────────────────────
  {
    id: 'tool-hub',
    label: 'Tool-Hub',
    icon: '🔧',
    description: 'Utility tools and scripts',
    category: 'tools',
    status: 'online',
    url: 'http://tool-hub.pi-hub.local',
  },
]

export default services
