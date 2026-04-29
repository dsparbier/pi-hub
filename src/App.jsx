import { useState } from 'react'
import Navbar from './components/Navbar.jsx'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './components/Dashboard.jsx'
import ServiceConsole from './components/ServiceConsole.jsx'
import ManageServices from './components/ManageServices.jsx'
import EditLayout from './components/EditLayout.jsx'
import LogViewer from './components/LogViewer.jsx'
import initialServices from './config/services.js'
import initialGroups from './config/groups.js'
import { useTheme } from './hooks/useTheme.js'
import styles from './App.module.css'

const DASHBOARD_VIEW = { id: 'dashboard', label: 'Dashboard', icon: '⬡' }

function slugify(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function App() {
  const { theme, setTheme, accentIndex, setAccent } = useTheme()

  const [services, setServices] = useState(initialServices)
  const [groups, setGroups] = useState(initialGroups)
  const [activeView, setActiveView] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [collapsedGroups, setCollapsedGroups] = useState(new Set())
  const [manageOpen, setManageOpen] = useState(false)
  const [editLayoutOpen, setEditLayoutOpen] = useState(false)
  const [logViewerOpen, setLogViewerOpen] = useState(false)
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
    </div>
  )
}
