import { useState } from 'react'
import Navbar from './components/Navbar.jsx'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './components/Dashboard.jsx'
import services from './config/services.js'
import styles from './App.module.css'

const DASHBOARD_VIEW = { id: 'dashboard', label: 'Dashboard', icon: '⬡' }
const ALL_VIEWS = [DASHBOARD_VIEW, ...services]

export default function App() {
  const [activeView, setActiveView] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className={styles.layout}>
      <Navbar onMenuToggle={() => setSidebarOpen(o => !o)} />
      <div className={styles.body}>
        <Sidebar
          views={ALL_VIEWS}
          activeView={activeView}
          onSelect={setActiveView}
          open={sidebarOpen}
        />
        <main className={styles.main}>
          <Dashboard activeView={activeView} views={ALL_VIEWS} services={services} />
        </main>
      </div>
    </div>
  )
}
