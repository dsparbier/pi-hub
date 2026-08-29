import { useEffect, useRef, useState } from 'react'
import { Icon } from './icons.jsx'
import ThemeSwitch from './ThemeSwitch.jsx'
import { useFleetTheme } from './useFleetTheme.js'

const RAIL_KEY = 'fleet.sidemenu'

/* TitleBar + SideMenu + centred content, all on fleet-ui classes.
   props:
     appName, contextPills [{text,tone}], statusTone ('ok'|'warn'|'stop'|'')
     groups [{ label, items:[{ id, label, icon, count }] }]
     activeId, onSelect(id)
     footerItems [{ id, label, icon, onClick }]
*/
export default function Shell({
  appName, contextPills = [], statusTone = '',
  groups = [], activeId, onSelect,
  footerItems = [],
  children,
}) {
  const { theme, setTheme, density, setDensity } = useFleetTheme()
  const [rail, setRail] = useState(() => {
    try { return localStorage.getItem(RAIL_KEY) === 'rail' } catch { return false }
  })
  const [drawer, setDrawer] = useState(false)
  const shellRef = useRef(null)

  function toggleRail() {
    if (window.matchMedia('(max-width:900px)').matches) { setDrawer(d => !d); return }
    setRail(r => {
      const nv = !r
      try { localStorage.setItem(RAIL_KEY, nv ? 'rail' : 'open') } catch {}
      return nv
    })
  }

  // titlebar scroll shadow
  useEffect(() => {
    const el = shellRef.current?.querySelector('.fleet-content')
    const bar = shellRef.current?.querySelector('.fleet-titlebar')
    if (!el || !bar) return
    const onScroll = () => bar.classList.toggle('scrolled', el.scrollTop > 2)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      ref={shellRef}
      className="fleet-shell"
      data-rail={rail ? 'rail' : 'open'}
      data-drawer={drawer ? 'open' : undefined}
    >
      <header className="fleet-titlebar">
        <button className="fleet-iconbtn" aria-label="Toggle navigation" onClick={toggleRail}>
          <Icon name="menu" />
        </button>
        <span className="mark" aria-hidden="true" />
        <span className="app-name">{appName}</span>
        {contextPills.map(p => (
          <span key={p.text} className={`fleet-pill ${p.tone || 'idle'}`}>{p.text}</span>
        ))}
        <span className="spacer" />
        <span className={`status-dot ${statusTone}`} title={`fleet: ${statusTone || 'unknown'}`} />
      </header>

      <nav className="fleet-sidemenu" aria-label="Primary">
        {groups.map(g => (
          <div key={g.label}>
            <div className="group-label">{g.label}</div>
            {g.items.map(it => (
              <button
                key={it.id}
                className="fleet-nav-item"
                aria-current={activeId === it.id ? 'page' : undefined}
                title={it.label}
                onClick={() => { onSelect(it.id); setDrawer(false) }}
              >
                {it.icon && <span className="icon"><Icon name={it.icon} /></span>}
                <span className="label">{it.label}</span>
                {it.count != null && <span className="count">{it.count}</span>}
              </button>
            ))}
          </div>
        ))}

        <div className="footer">
          <ThemeSwitch theme={theme} setTheme={setTheme} density={density} setDensity={setDensity} rail={rail} />
          {footerItems.map(f => (
            <button key={f.id} className="fleet-nav-item" onClick={f.onClick} title={f.label}>
              {f.icon && <span className="icon"><Icon name={f.icon} /></span>}
              <span className="label">{f.label}</span>
            </button>
          ))}
          <button className="fleet-nav-item" onClick={toggleRail}>
            <span className="icon"><Icon name="panel-left" /></span>
            <span className="label">Collapse</span>
          </button>
        </div>
      </nav>
      <div className="fleet-scrim" onClick={() => setDrawer(false)} />

      <main className="fleet-content">
        <div className="wrap">{children}</div>
      </main>
    </div>
  )
}
