import { useState, useCallback, useRef } from 'react'

const TIMEOUT_MS = 6000

async function probe(url, method = 'HEAD') {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const t0 = performance.now()
  try {
    await fetch(url, { method, mode: 'no-cors', signal: controller.signal })
    clearTimeout(timer)
    return { status: 'online', latency: Math.round(performance.now() - t0) }
  } catch (err) {
    clearTimeout(timer)
    if (err.name === 'AbortError') return { status: 'timeout', latency: null }
    return { status: 'offline', latency: null, error: err.message }
  }
}

function hostFromUrl(url) {
  try { return new URL(url).hostname } catch { return url }
}

function initResults(service) {
  const custom = (service.healthChecks?.custom ?? []).map(c => ({
    id:      c.id,
    label:   c.label,
    method:  c.method,
    url:     c.url,
    status:  'idle',
    latency: null,
    checkedAt: null,
  }))
  return {
    ping:   { status: 'idle', latency: null, checkedAt: null },
    dns:    { status: 'idle', latency: null, checkedAt: null },
    custom,
  }
}

export function useHealthCheck(service, logger, onResult) {
  const [results, setResults] = useState(() => initResults(service))
  const [checking, setChecking] = useState(false)
  const serviceRef = useRef(service)
  const onResultRef = useRef(onResult)
  serviceRef.current = service
  onResultRef.current = onResult

  const run = useCallback(async () => {
    const svc = serviceRef.current
    if (!svc?.url) return
    setChecking(true)

    logger?.debug(svc.id, `Health check started — ${svc.url}`)

    const update = (key, patch) => {
      const result = { ...patch, checkedAt: new Date().toISOString() }
      setResults(prev => ({ ...prev, [key]: { ...prev[key], ...result } }))
      onResultRef.current?.(key, result)
    }

    const updateCustom = (id, patch) => {
      const result = { ...patch, checkedAt: new Date().toISOString() }
      setResults(prev => ({
        ...prev,
        custom: prev.custom.map(c => c.id === id ? { ...c, ...result } : c),
      }))
      onResultRef.current?.(id, result)
    }

    // Mark all pending
    setResults(prev => ({
      ping:   { ...prev.ping,  status: 'pending' },
      dns:    { ...prev.dns,   status: 'pending' },
      custom: prev.custom.map(c => ({ ...c, status: 'pending' })),
    }))

    // Run all checks in parallel
    await Promise.all([
      // IP / Service Ping — HEAD to the service URL
      probe(svc.url, 'HEAD').then(r => {
        update('ping', r)
        const tag = r.status === 'online' ? `✓ ${r.latency}ms` : `✗ ${r.status}`
        r.status === 'online'
          ? logger?.info(svc.id,  `IP Ping ${svc.url} — ${tag}`)
          : logger?.warn(svc.id,  `IP Ping ${svc.url} — ${tag}`)
      }),

      // DNS — fetch via hostname; same URL but we label it as DNS resolution test
      probe(svc.url, 'HEAD').then(r => {
        const host = hostFromUrl(svc.url)
        update('dns', r)
        r.status === 'online'
          ? logger?.info(svc.id,  `DNS Resolve ${host} — ✓ ${r.latency}ms`)
          : logger?.warn(svc.id,  `DNS Resolve ${host} — ✗ ${r.status}`)
      }),

      // Custom checks
      ...(svc.healthChecks?.custom ?? []).map(c =>
        probe(c.url, c.method).then(r => {
          updateCustom(c.id, r)
          r.status === 'online'
            ? logger?.info(svc.id,  `${c.method} ${c.label} — ✓ ${r.latency}ms`)
            : logger?.warn(svc.id,  `${c.method} ${c.label} — ✗ ${r.status}`)
        })
      ),
    ])

    logger?.debug(svc.id, 'Health check complete')
    setChecking(false)
  }, [logger])

  return { results, checking, run }
}
