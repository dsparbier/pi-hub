import { useState } from 'react'
import Navbar from './components/Navbar.jsx'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './components/Dashboard.jsx'
import styles from './App.module.css'

const VIEWS = [
  { id: 'dashboard', label: 'Dashboard', icon: '⬡' },
  { id: 'pihole', label: 'Pi-hole', icon: '🛡' },
  { id: 'homeassistant', label: 'Home Assistant', icon: '🏠' },
  { id: 'jellyfin', label: 'Jellyfin', icon: '▶' },
  { id: 'portainer', label: 'Portainer', icon: '🐳' },
  { id: 'system', label: 'System', icon: '📊' },
]

export default function App() {
  const [activeView, setActiveView] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className={styles.layout}>
      <Navbar onMenuToggle={() => setSidebarOpen(o => !o)} />
      <div className={styles.body}>
        <Sidebar
          views={VIEWS}
          activeView={activeView}
          onSelect={setActiveView}
          open={sidebarOpen}
        />
        <main className={styles.main}>
          <Dashboard activeView={activeView} views={VIEWS} />
        </main>
      </div>
    </div>
  )
}
