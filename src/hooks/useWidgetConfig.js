import { useState } from 'react'

const DEFAULT_WIDGETS = [
  { id: 'w-health',  type: 'health-checks', order: 0 },
  { id: 'w-latency', type: 'latency-chart',  order: 1 },
  { id: 'w-uptime',  type: 'uptime-grid',    order: 2, config: { cols: 20 } },
]

function load() {
  try { return JSON.parse(localStorage.getItem('ph-widgets') ?? '{}') }
  catch { return {} }
}

export function useWidgetConfig() {
  const [configs, setConfigsState] = useState(load)

  function getWidgets(serviceId) {
    return configs[serviceId] ?? DEFAULT_WIDGETS
  }

  function setWidgets(serviceId, widgets) {
    setConfigsState(prev => {
      const next = { ...prev, [serviceId]: widgets }
      localStorage.setItem('ph-widgets', JSON.stringify(next))
      return next
    })
  }

  function addWidget(serviceId, type, config = {}) {
    const widgets = getWidgets(serviceId)
    const maxId = Math.max(...widgets.map(w => parseInt(w.id.replace('w-', '')) || 0), 0)
    const newWidget = {
      id: `w-${maxId + 1}`,
      type,
      order: widgets.length,
      ...(config && { config }),
    }
    setWidgets(serviceId, [...widgets, newWidget])
  }

  function removeWidget(serviceId, widgetId) {
    const widgets = getWidgets(serviceId)
    setWidgets(serviceId, widgets.filter(w => w.id !== widgetId))
  }

  function updateWidgetConfig(serviceId, widgetId, config) {
    const widgets = getWidgets(serviceId)
    setWidgets(serviceId, widgets.map(w =>
      w.id === widgetId ? { ...w, config: { ...w.config, ...config } } : w
    ))
  }

  return { getWidgets, setWidgets, addWidget, removeWidget, updateWidgetConfig }
}
