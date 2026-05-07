import { useState } from 'react'

export const REFRESH_OPTIONS = [
  { label: '15s', value: 15000 },
  { label: '30s', value: 30000 },
  { label: '1m',  value: 60000 },
  { label: '2m',  value: 120000 },
  { label: '5m',  value: 300000 },
  { label: 'Off', value: 0 },
]

export const TIMEOUT_OPTIONS = [
  { label: '3s',  value: 3000 },
  { label: '5s',  value: 5000 },
  { label: '10s', value: 10000 },
  { label: '30s', value: 30000 },
]

const DEFAULTS = {
  hubName: 'Pi-Hub',
  hostname: '192.168.1.100',
  localDomain: 'pi-hub.local',
  healthRefreshMs: 30000,
  healthTimeoutMs: 5000,
}

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('ph-config') ?? '{}') } }
  catch { return { ...DEFAULTS } }
}

export function useConfig() {
  const [config, setConfigState] = useState(load)

  function setConfig(updates) {
    setConfigState(prev => {
      const next = { ...prev, ...updates }
      localStorage.setItem('ph-config', JSON.stringify(next))
      return next
    })
  }

  return { config, setConfig }
}
