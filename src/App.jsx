import { useState } from 'react'
import Shell from './fleet/Shell.jsx'
import FleetConsole from './fleet/FleetConsole.jsx'
import LogViewer from './components/LogViewer.jsx'
import Settings from './components/Settings.jsx'
import { useConfig } from './hooks/useConfig.js'
import { version } from './version.js'
import { FLEET_GROUPS } from './config/fleet.js'

export default function App() {
  const { config, setConfig } = useConfig()
  const [logsOpen, setLogsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const groups = [
    {
      label: 'Monitor',
      items: [{ id: 'console', label: 'Fleet Console', icon: 'activity' }],
    },
    {
      label: 'Jump to',
      items: FLEET_GROUPS.map(g => ({
        id: `grp-${g.id}`, label: g.label, icon: 'chevron-left',
      })),
    },
  ]

  function onSelect(id) {
    if (id.startsWith('grp-')) {
      const el = document.querySelector(`[data-group="${id.slice(4)}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    document.querySelector('.fleet-content')?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <Shell
        appName={config.hubName || 'Pi-Hub Console'}
        contextPills={[{ text: `v${version}`, tone: 'idle' }]}
        statusTone="ok"
        groups={groups}
        activeId="console"
        onSelect={onSelect}
        footerItems={[
          { id: 'logs', label: 'Logs', icon: 'search', onClick: () => setLogsOpen(true) },
          { id: 'settings', label: 'Settings', icon: 'settings', onClick: () => setSettingsOpen(true) },
        ]}
      >
        <FleetConsole />
      </Shell>

      {logsOpen && <LogViewer services={[]} onClose={() => setLogsOpen(false)} />}
      {settingsOpen && (
        <Settings
          config={config}
          onSave={setConfig}
          theme="dark"
          setTheme={() => {}}
          accentIndex={0}
          setAccent={() => {}}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  )
}
