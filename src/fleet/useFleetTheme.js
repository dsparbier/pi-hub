/* React wrapper around fleet-ui/theme.js — 5 theme modes + a density axis. */
import { useCallback, useEffect, useState } from 'react'
import {
  THEMES, DENSITIES,
  getTheme, setTheme as fsSetTheme,
  getDensity, setDensity as fsSetDensity,
  initTheme,
} from '../fleet-ui/theme.js'

export { THEMES, DENSITIES }

export function useFleetTheme() {
  const [theme, setThemeState] = useState(() => getTheme())
  const [density, setDensityState] = useState(() => getDensity())

  useEffect(() => { initTheme() }, [])

  // keep `system` in step with the OS while it's selected
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => initTheme()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [theme])

  const setTheme = useCallback((t) => { setThemeState(fsSetTheme(t)) }, [])
  const setDensity = useCallback((d) => { setDensityState(fsSetDensity(d)) }, [])

  return { theme, setTheme, density, setDensity }
}
