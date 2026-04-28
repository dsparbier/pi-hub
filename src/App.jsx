import { useState } from 'react'
import Navbar from './components/Navbar.jsx'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './components/Dashboard.jsx'
import ServiceConsole from './components/ServiceConsole.jsx'
import ManageServices from './components/ManageServices.jsx'
import EditLayout from './components/EditLayout.jsx'
import initialServices from './config/services.js'
import { useTheme } from './hooks/useTheme.js'
import styles from './App.module.css'

const DASHBOARD_VIEW = { id: 'dashboard', label: 'Dashboard', icon: '⬡' }

function slugify(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function App() {
  const { theme, setTheme, accentIndex, setAccent } = useTheme()

  const [services, setServices] = useState(initialServices)
  const [activeView, setActiveView] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [manageOpen, setManageOpen] = useState(false)
  const [editLayoutOpen, setEditLayoutOpen] = useState(false)
  const [consoleService, setConsoleService] = useState(null)

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
          activeView={activeView}
          onSelect={handleSelectView}
          open={sidebarOpen}
          onManageServices={() => setManageOpen(true)}
          onEditLayout={() => setEditLayoutOpen(true)}
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
          onClose={() => setManageOpen(false)}
          onAdd={handleAddService}
          onEdit={handleEditService}
          onDelete={handleDeleteService}
        />
      )}

      {editLayoutOpen && (
        <EditLayout
          theme={theme}
          setTheme={setTheme}
          accentIndex={accentIndex}
          setAccent={setAccent}
          onClose={() => setEditLayoutOpen(false)}
        />
      )}
    </div>
  )
}
