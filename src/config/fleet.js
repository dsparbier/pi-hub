/* The Pi-Hub application fleet, as the console monitors it.
 *
 * migrated backends (fleet_config): `adminBase` + `apiKey` → the console reads
 *   /api/admin/health for active target / db_reachable / fleet_settings_loaded,
 *   and links to /api/admin/config.
 * everything else: `healthUrl` (JSON /health) or `pingUrl` (no-cors HEAD).
 *
 * API keys here are the fleet's shared dev placeholders and this console is a
 * LAN-only admin tool. Override per-browser via localStorage['fleet.console.keys']
 * = {"<id>":"<key>"} if you rotate them.
 */
const HOST = 'http://pi-hub.local'

let keyOverrides = {}
try { keyOverrides = JSON.parse(localStorage.getItem('fleet.console.keys') || '{}') } catch {}
const K = (id, def) => keyOverrides[id] || def

export const FLEET_GROUPS = [
  { id: 'backends',       label: 'Fleet backends' },
  { id: 'frontends',      label: 'Frontends' },
  { id: 'infrastructure', label: 'Infrastructure' },
  { id: 'tools',          label: 'Tools & automation' },
]

const services = [
  // ── migrated fleet backends ─────────────────────────────────────────
  {
    id: 'sql-hub', label: 'SQL-Hub', icon: 'database', group: 'backends',
    blurb: 'SQLite REST API — the fleet data layer', port: 1234,
    healthUrl: `${HOST}:1234/health`,
    adminBase: `${HOST}:1234`, apiKey: K('sql-hub', 'super-secret-key'),
    open: `${HOST}:1234/admin`,
  },
  {
    id: 'dev-hub', label: 'DEV-Hub', icon: 'activity', group: 'backends',
    blurb: 'Bug / feature / enhancement tracker', port: 38103,
    healthUrl: `${HOST}:38103/health`,
    adminBase: `${HOST}:38103`, apiKey: K('dev-hub', 'test-devhub-key'),
    open: 'http://dev-hub.pi-hub.local',
  },
  {
    id: 'ai-hub', label: 'AI-Hub', icon: 'activity', group: 'backends',
    blurb: 'Agent / LLM orchestration', port: 8282,
    healthUrl: `${HOST}:8282/health`,
    adminBase: `${HOST}:8282`, apiKey: K('ai-hub', ''),
    open: `${HOST}:8282/docs`,
  },
  {
    id: 'fin-hub', label: 'Fin-Hub', icon: 'activity', group: 'backends',
    blurb: 'Personal finance', port: 38100,
    healthUrl: `${HOST}:38100/health`,
    adminBase: `${HOST}:38100`, apiKey: K('fin-hub', 'super-secret-key'),
    open: 'http://fin-hub.pi-hub.local',
  },
  {
    id: 'invest-hub', label: 'Invest-Hub', icon: 'activity', group: 'backends',
    blurb: 'Portfolio & investments', port: 38101,
    healthUrl: `${HOST}:38101/health`,
    adminBase: `${HOST}:38101`, apiKey: K('invest-hub', 'super-secret-key'),
    open: 'http://invest-hub.pi-hub.local',
  },
  {
    id: 'knowledge-hub', label: 'Knowledge-Hub', icon: 'search', group: 'backends',
    blurb: 'Document store (relational, on SQL-Hub)', port: 38105,
    healthUrl: `${HOST}:38105/health`,
    adminBase: `${HOST}:38105`, apiKey: K('knowledge-hub', 'super-secret-key'),
    open: 'http://knowledge-hub.pi-hub.local',
  },
  {
    id: 'tool-hub', label: 'Tool-Hub', icon: 'settings', group: 'backends',
    blurb: 'Python function / applet gateway', port: 8002,
    healthUrl: `${HOST}:8002/health`,
    adminBase: `${HOST}:8002`, apiKey: K('tool-hub', 'admin-super-secret-key'),
    open: `${HOST}:8002/docs`,
  },

  // ── frontends ───────────────────────────────────────────────────────
  { id: 'fin-hub-web',       label: 'Fin-Hub UI',       icon: 'monitor', group: 'frontends', blurb: 'Vue SPA', pingUrl: 'http://fin-hub.pi-hub.local/',       open: 'http://fin-hub.pi-hub.local' },
  { id: 'invest-hub-web',    label: 'Invest-Hub UI',    icon: 'monitor', group: 'frontends', blurb: 'Vue SPA', pingUrl: 'http://invest-hub.pi-hub.local/',    open: 'http://invest-hub.pi-hub.local' },
  { id: 'knowledge-hub-web', label: 'Knowledge-Hub UI', icon: 'monitor', group: 'frontends', blurb: 'Vue SPA', pingUrl: 'http://knowledge-hub.pi-hub.local/', open: 'http://knowledge-hub.pi-hub.local' },
  { id: 'excalibur-web',     label: 'Excalibur',        icon: 'monitor', group: 'frontends', blurb: 'Pentest console', pingUrl: 'http://excalibur.pi-hub.local/', open: 'http://excalibur.pi-hub.local' },

  // ── infrastructure ──────────────────────────────────────────────────
  { id: 'adguard', label: 'AdGuard Home', icon: 'contrast', group: 'infrastructure', blurb: 'DNS ad/tracker blocking + LAN DNS', pingUrl: 'http://adguard.pi-hub.local/', open: 'http://adguard.pi-hub.local' },
  { id: 'npm',     label: 'NGINX Proxy Manager', icon: 'panel-left', group: 'infrastructure', blurb: 'Reverse proxy for *.pi-hub.local', pingUrl: 'http://npm.pi-hub.local/', open: 'http://npm.pi-hub.local' },
  { id: 'portainer', label: 'Portainer', icon: 'settings', group: 'infrastructure', blurb: 'Container management', pingUrl: 'http://portainer.pi-hub.local/', open: 'http://portainer.pi-hub.local' },
  { id: 'beszel',  label: 'Beszel', icon: 'activity', group: 'infrastructure', blurb: 'Host & container metrics', pingUrl: 'http://beszel.pi-hub.local/', open: 'http://beszel.pi-hub.local' },

  // ── tools & automation ──────────────────────────────────────────────
  { id: 'ollama',    label: 'Ollama', icon: 'activity', group: 'tools', blurb: 'Local LLM runtime', healthUrl: `${HOST}:11434/`, open: `${HOST}:11434` },
  { id: 'open-webui', label: 'Open WebUI', icon: 'monitor', group: 'tools', blurb: 'Chat UI for Ollama', pingUrl: 'http://ai.pi-hub.local/', open: 'http://ai.pi-hub.local' },
  { id: 'n8n',       label: 'n8n', icon: 'activity', group: 'tools', blurb: 'Workflow automation', pingUrl: 'http://n8n.pi-hub.local/', open: 'http://n8n.pi-hub.local' },
  { id: 'jarvis-ui', label: 'Jarvis UI', icon: 'monitor', group: 'tools', blurb: 'Voice assistant UI', pingUrl: 'http://jarvis.pi-hub.local/', open: 'http://jarvis.pi-hub.local' },
]

export default services
export const BACKENDS = services.filter(s => s.adminBase)
