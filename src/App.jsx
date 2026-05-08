import { useState, useEffect } from 'react'
import Navbar from './components/Navbar.jsx'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './components/Dashboard.jsx'
import ServiceConsole from './components/ServiceConsole.jsx'
import ManageServices from './components/ManageServices.jsx'
import EditLayout from './components/EditLayout.jsx'
import LogViewer from './components/LogViewer.jsx'
import Settings from './components/Settings.jsx'
import initialServices from './config/services.js'
import initialGroups from './config/groups.js'
import { useTheme } from './hooks/useTheme.js'
import { useConfig } from './hooks/useConfig.js'
import { version } from './version.js'
import styles from './App.module.css'

const DASHBOARD_VIEW = { id: 'dashboard', label: 'Dashboard', icon: '⬡' }

function slugify(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function App() {
  const { theme, setTheme, accentIndex, setAccent } = useTheme()
  const { config, setConfig } = useConfig()

  const [services, setServices] = useState(
    () => JSON.parse(localStorage.getItem('ph-services')) ?? initialServices
  )
  const [groups, setGroups] = useState(
    () => JSON.parse(localStorage.getItem('ph-groups')) ?? initialGroups
  )
  const [activeView, setActiveView] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(
    () => JSON.parse(localStorage.getItem('ph-sidebar-open') ?? 'true')
  )
  const [collapsedGroups, setCollapsedGroups] = useState(
    () => {
      const groupsData = JSON.parse(localStorage.getItem('ph-groups')) ?? initialGroups
      return new Set(groupsData.map(g => g.id))
    }
  )

  useEffect(() => { localStorage.setItem('ph-services', JSON.stringify(services)) }, [services])
  useEffect(() => { localStorage.setItem('ph-groups', JSON.stringify(groups)) }, [groups])
  useEffect(() => { localStorage.setItem('ph-sidebar-open', JSON.stringify(sidebarOpen)) }, [sidebarOpen])
  useEffect(() => { localStorage.setItem('ph-collapsed-groups', JSON.stringify([...collapsedGroups])) }, [collapsedGroups])

  useEffect(() => {
    const prevConfig = JSON.parse(localStorage.getItem('ph-config-hash') ?? '{}')
    const currentHash = JSON.stringify(config)
    if (prevConfig !== currentHash && Object.keys(prevConfig).length > 0) {
      localStorage.removeItem('ph-services')
      setServices(initialServices)
    }
    localStorage.setItem('ph-config-hash', JSON.stringify(config))
  }, [config])
  const [manageOpen, setManageOpen] = useState(false)
  const [editLayoutOpen, setEditLayoutOpen] = useState(false)
  const [logViewerOpen, setLogViewerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [consoleService, setConsoleService] = useState(null)

  function handleToggleGroup(groupId) {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      next.has(groupId) ? next.delete(groupId) : next.add(groupId)
      return next
    })
  }

  const allViews = [DASHBOARD_VIEW, ...services]

  function handleAddService(data) {
    const id = slugify(data.label) || `service-${Date.now()}`
    setServices(prev => [...prev, { ...data, id }])
  }

  function handleEditService(id, data) {
    setServices(prev => prev.map(s => s.id === id ? { ...s, ...data } : s))
  }

  function handleDeleteService(id) {
    setServices(prev => prev.filter(s => s.id !== id))
    if (activeView === id) setActiveView('dashboard')
  }

  function handleAddGroup(data) {
    const id = slugify(data.label) || `group-${Date.now()}`
    setGroups(prev => [...prev, { ...data, id }])
  }

  function handleEditGroup(id, data) {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, ...data } : g))
  }

  function handleDeleteGroup(id) {
    setGroups(prev => prev.filter(g => g.id !== id))
    setServices(prev => prev.map(s => s.group === id ? { ...s, group: '' } : s))
  }

  function handleReorderService(draggedId, targetId, insertBefore) {
    setServices(prev => {
      const dragged = prev.find(s => s.id === draggedId)
      const target  = prev.find(s => s.id === targetId)
      if (!dragged || !target) return prev
      const updated  = { ...dragged, group: target.group ?? '' }
      const without  = prev.filter(s => s.id !== draggedId)
      const idx      = without.findIndex(s => s.id === targetId)
      const insertAt = insertBefore ? idx : idx + 1
      return [...without.slice(0, insertAt), updated, ...without.slice(insertAt)]
    })
  }

  function handleMoveServiceToGroup(serviceId, groupId) {
    setServices(prev => prev.map(s => s.id === serviceId ? { ...s, group: groupId } : s))
  }

  function handleSelectView(id) {
    setConsoleService(null)
    setActiveView(id)
  }

  return (
    <div className={styles.layout}>
      <Navbar
        onMenuToggle={() => setSidebarOpen(o => !o)}
        theme={theme}
        onThemeToggle={setTheme}
        services={services}
        config={config}
        onSettingsOpen={() => setSettingsOpen(true)}
      />
      <div className={styles.body}>
        <Sidebar
          views={allViews}
          services={services}
          groups={groups}
          activeView={activeView}
          onSelect={handleSelectView}
          open={sidebarOpen}
          collapsedGroups={collapsedGroups}
          onToggleGroup={handleToggleGroup}
          onManageServices={() => setManageOpen(true)}
          onEditLayout={() => setEditLayoutOpen(true)}
          onOpenLogs={() => setLogViewerOpen(true)}
          onReorderService={handleReorderService}
          onMoveServiceToGroup={handleMoveServiceToGroup}
          version={version}
        />
        <main className={`${styles.main} ${consoleService ? styles.mainConsole : ''}`}>
          {consoleService ? (
            <ServiceConsole
              service={consoleService}
              onClose={() => setConsoleService(null)}
            />
          ) : (
            <Dashboard
              activeView={activeView}
              views={allViews}
              services={services}
              onOpenConsole={setConsoleService}
            />
          )}
        </main>
      </div>

      {manageOpen && (
        <ManageServices
          services={services}
          groups={groups}
          onClose={() => setManageOpen(false)}
          onAdd={handleAddService}
          onEdit={handleEditService}
          onDelete={handleDeleteService}
        />
      )}

      {logViewerOpen && (
        <LogViewer
          services={services}
          onClose={() => setLogViewerOpen(false)}
        />
      )}

      {editLayoutOpen && (
        <EditLayout
          theme={theme}
          setTheme={setTheme}
          accentIndex={accentIndex}
          setAccent={setAccent}
          groups={groups}
          onAddGroup={handleAddGroup}
          onEditGroup={handleEditGroup}
          onDeleteGroup={handleDeleteGroup}
          onClose={() => setEditLayoutOpen(false)}
        />
      )}

      {settingsOpen && (
        <Settings
          config={config}
          onSave={setConfig}
          theme={theme}
          setTheme={setTheme}
          accentIndex={accentIndex}
          setAccent={setAccent}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
