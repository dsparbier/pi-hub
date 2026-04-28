import { useState } from 'react'
import Navbar from './components/Navbar.jsx'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './components/Dashboard.jsx'
import ManageServices from './components/ManageServices.jsx'
import initialServices from './config/services.js'
import styles from './App.module.css'

const DASHBOARD_VIEW = { id: 'dashboard', label: 'Dashboard', icon: '⬡' }

function slugify(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function App() {
  const [services, setServices] = useState(initialServices)
  const [activeView, setActiveView] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [manageOpen, setManageOpen] = useState(false)

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

  return (
    <div className={styles.layout}>
      <Navbar onMenuToggle={() => setSidebarOpen(o => !o)} />
      <div className={styles.body}>
        <Sidebar
          views={allViews}
          activeView={activeView}
          onSelect={setActiveView}
          open={sidebarOpen}
          onManageServices={() => setManageOpen(true)}
        />
        <main className={styles.main}>
          <Dashboard activeView={activeView} views={allViews} services={services} />
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
    </div>
  )
}
