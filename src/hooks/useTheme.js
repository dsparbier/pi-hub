import { useState, useEffect } from 'react'

export const ACCENT_PRESETS = [
  { name: 'Violet',  value: '#7c3aed', soft: '#4f46e5', pi: '#c084fc' },
  { name: 'Blue',    value: '#2563eb', soft: '#1d4ed8', pi: '#93c5fd' },
  { name: 'Teal',    value: '#0d9488', soft: '#0f766e', pi: '#5eead4' },
  { name: 'Green',   value: '#16a34a', soft: '#15803d', pi: '#86efac' },
  { name: 'Orange',  value: '#ea580c', soft: '#c2410c', pi: '#fdba74' },
  { name: 'Pink',    value: '#db2777', soft: '#be185d', pi: '#f9a8d4' },
  { name: 'Rose',    value: '#e11d48', soft: '#be123c', pi: '#fda4af' },
  { name: 'Indigo',  value: '#4338ca', soft: '#3730a3', pi: '#a5b4fc' },
]

function resolveTheme(theme) {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  return theme
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', resolveTheme(theme))
}

function applyAccent(index) {
  const a = ACCENT_PRESETS[index] ?? ACCENT_PRESETS[0]
  const root = document.documentElement
  root.style.setProperty('--color-accent', a.value)
  root.style.setProperty('--color-accent-soft', a.soft)
  root.style.setProperty('--color-pi', a.pi)
}

export function useTheme() {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem('ph-theme') || 'dark'
  )
  const [accentIndex, setAccentIndexState] = useState(
    () => parseInt(localStorage.getItem('ph-accent') || '0', 10)
  )

  // Apply theme on mount and when it changes
  useEffect(() => {
    applyTheme(theme)
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const sync = () => { if (theme === 'system') applyTheme('system') }
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [theme])

  // Apply accent on mount and when it changes
  useEffect(() => {
    applyAccent(accentIndex)
  }, [accentIndex])

  function setTheme(t) {
    setThemeState(t)
    localStorage.setItem('ph-theme', t)
    applyTheme(t)
  }

  function setAccent(index) {
    setAccentIndexState(index)
    localStorage.setItem('ph-accent', index)
    applyAccent(index)
  }

  return { theme, setTheme, accentIndex, setAccent }
}
