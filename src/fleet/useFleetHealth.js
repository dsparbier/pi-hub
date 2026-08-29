/* Polls every fleet service. For a migrated backend (has `adminBase` + `apiKey`)
   it reads /api/admin/health — active target, db_reachable, fleet_settings_loaded.
   For everything else it does a plain /health (or a no-cors ping). */
import { useCallback, useEffect, useRef, useState } from 'react'

const TIMEOUT_MS = 6000

async function fetchJSON(url, { headers } = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  const t0 = performance.now()
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal })
    clearTimeout(timer)
    const latency = Math.round(performance.now() - t0)
    let body = null
    try { body = await res.json() } catch { /* not json */ }
    return { ok: res.ok, status: res.status, latency, body }
  } catch (err) {
    clearTimeout(timer)
    return { ok: false, status: 0, latency: null, error: err.name === 'AbortError' ? 'timeout' : String(err) }
  }
}

async function pingNoCors(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  const t0 = performance.now()
  try {
    await fetch(url, { method: 'HEAD', mode: 'no-cors', signal: ctrl.signal })
    clearTimeout(timer)
    return { ok: true, latency: Math.round(performance.now() - t0) }
  } catch (err) {
    clearTimeout(timer)
    return { ok: false, latency: null, reason: err.name === 'AbortError' ? 'timeout' : 'offline' }
  }
}

async function probeService(svc) {
  const out = { id: svc.id, checkedAt: new Date().toISOString() }

  if (svc.healthUrl) {
    const h = await fetchJSON(svc.healthUrl)
    out.latency = h.latency
    out.up = h.ok
    out.version = h.body?.version || h.body?.service || null
  } else if (svc.pingUrl) {
    const p = await pingNoCors(svc.pingUrl)
    out.up = p.ok
    out.latency = p.latency
    out.reason = p.reason
  }

  if (svc.adminBase) {
    const a = await fetchJSON(`${svc.adminBase}/api/admin/health`, {
      headers: svc.apiKey ? { 'X-API-Key': svc.apiKey } : undefined,
    })
    if (a.body) {
      out.admin = {
        mode: a.body.mode || null,
        activeTarget: a.body.active_target ?? null,
        db: a.body.db_name ?? null,
        dbReachable: a.body.db_reachable ?? null,
        fleetSettings: a.body.fleet_settings_loaded ?? null,
        sqlHubUrl: a.body.sql_hub_url ?? null,
      }
      if (out.up === undefined) out.up = a.ok
    } else {
      out.adminError = a.error || `HTTP ${a.status}`
    }
  }

  if (out.up === undefined) out.up = false
  return out
}

export function useFleetHealth(services, intervalMs = 20000) {
  const [results, setResults] = useState({})
  const [lastRun, setLastRun] = useState(null)
  const [running, setRunning] = useState(false)
  const svcRef = useRef(services)
  svcRef.current = services

  const run = useCallback(async () => {
    setRunning(true)
    const list = svcRef.current || []
    const settled = await Promise.all(list.map(s => probeService(s).catch(e => ({ id: s.id, up: false, error: String(e) }))))
    setResults(Object.fromEntries(settled.map(r => [r.id, r])))
    setLastRun(new Date())
    setRunning(false)
  }, [])

  useEffect(() => {
    run()
    const t = setInterval(run, intervalMs)
    return () => clearInterval(t)
  }, [run, intervalMs])

  return { results, lastRun, running, run }
}
