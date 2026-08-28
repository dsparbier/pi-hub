import { THEMES, DENSITIES } from './useFleetTheme.js'
import { Icon, THEME_ICON } from './icons.jsx'

export default function ThemeSwitch({ theme, setTheme, density, setDensity, rail }) {
  if (rail) {
    const next = () => {
      const i = THEMES.indexOf(theme)
      setTheme(THEMES[(i + 1) % THEMES.length])
    }
    return (
      <button className="fleet-nav-item" title={`Theme: ${theme}`} onClick={next}>
        <span className="icon"><Icon name={THEME_ICON[theme]} /></span>
        <span className="label">{theme}</span>
      </button>
    )
  }
  return (
    <>
      <div className="fleet-theme-switch" role="group" aria-label="Theme">
        {THEMES.map(t => (
          <button
            key={t}
            aria-pressed={t === theme}
            title={t}
            onClick={() => setTheme(t)}
          >
            <Icon name={THEME_ICON[t]} size={14} />
          </button>
        ))}
      </div>
      <label className="fleet-density-toggle">
        <input
          type="checkbox"
          checked={density === 'compact'}
          onChange={e => setDensity(e.target.checked ? 'compact' : 'comfortable')}
        />
        Compact
      </label>
    </>
  )
}
