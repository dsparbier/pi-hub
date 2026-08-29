/* Client for pi-hub-agent (the FastAPI sidecar). Everything rides the console's
 * own origin under `/agent/…`, so there is no CORS and no absolute host.
 *
 *  - agentFetch(path, {method, body, admin})  → JSON, typed AgentError on failure
 *  - wsConnect(path, {admin, onFrame, onStatus}) → { close() }, auto-reconnect
 *  - useHostMetricsCurrent / useHostMetricsRange / useContainers / useContainerInspect
 *  - openLogStream / openStatsStream
 *
 * The data hooks poll ONLY while mounted (interval cleared on unmount) and the
 * WS helpers close on unmount — Host Metrics / Containers hold live sockets that
 * must not leak when the view is hidden. useFleetHealth.js is untouched.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AGENT } from '../config/fleet.js'
import { useLogger } from '../context/LoggerContext.jsx'

const SVC = 'pi-hub-agent'

export class AgentError extends Error {
  constructor(message, { status = 0, detail = null } = {}) {
    super(message)
    this.name = 'AgentError'
    this.status = status
    this.detail = detail
  }
}

function agentUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${AGENT.base}${p}`
}

function wsUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}${AGENT.base}${p}`
}

/* ── low-level client, bound to the in-app logger ───────────────────── */
export function useAgentClient() {
  // LoggerContext's value (and its .error/.warn fns) is a fresh object on every
  // log entry. Read it through a ref so agentFetch/wsConnect stay referentially
  // stable — otherwise every logged error would re-fire polling effects and
  // tear down / reopen the live WebSockets.
  const logCtx = useLogger()
  const logRef = useRef(logCtx)
  logRef.current = logCtx
  const log = () => logRef.current

  const agentFetch = useCallback(async (path, opts = {}) => {
    const { method = 'GET', body, admin = false, signal } = opts
    const headers = { 'X-API-Key': admin ? AGENT.adminKey : AGENT.readKey }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    let res
    try {
      res = await fetch(agentUrl(path), {
        method, headers, signal,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    } catch (err) {
      if (err?.name === 'AbortError') throw err
      log().error(SVC, `network error on ${method} ${path}`, String(err))
      throw new AgentError(`network error: ${err}`, { status: 0 })
    }
    let payload = null
    try { payload = await res.json() } catch { /* empty / non-json */ }
    if (!res.ok) {
      const detail = payload?.detail ?? payload ?? null
      log().error(SVC, `${method} ${path} → HTTP ${res.status}`, detail)
      throw new AgentError(`HTTP ${res.status}`, { status: res.status, detail })
    }
    return payload
  }, [])

  const wsConnect = useCallback((path, { admin = false, onFrame, onStatus } = {}) => {
    let ws = null
    let closed = false
    let attempt = 0
    let retryTimer = null

    const setStatus = (s) => { onStatus && onStatus(s) }

    const open = () => {
      if (closed) return
      setStatus(attempt === 0 ? 'connecting' : 'reconnecting')
      try {
        ws = new WebSocket(wsUrl(path))
      } catch (err) {
        log().error(SVC, `ws construct failed ${path}`, String(err))
        scheduleRetry()
        return
      }
      ws.onopen = () => {
        attempt = 0
        try {
          ws.send(JSON.stringify({ type: 'auth', key: admin ? AGENT.adminKey : AGENT.readKey }))
        } catch { /* socket already gone */ }
        setStatus('open')
      }
      ws.onmessage = (ev) => {
        let frame = null
        try { frame = JSON.parse(ev.data) } catch { return }
        onFrame && onFrame(frame)
      }
      ws.onerror = () => { /* onclose handles retry */ }
      ws.onclose = (ev) => {
        if (closed) { setStatus('closed'); return }
        if (ev.code === 4401) {
          log().error(SVC, `ws auth rejected ${path}`, 'check fleet.console.keys')
          setStatus('unauthorized')
          return // don't hammer on a bad key
        }
        scheduleRetry()
      }
    }

    const scheduleRetry = () => {
      if (closed) return
      const delay = Math.min(15000, 1000 * 2 ** attempt)
      attempt += 1
      setStatus('reconnecting')
      retryTimer = setTimeout(open, delay)
    }

    open()

    return {
      close() {
        closed = true
        if (retryTimer) clearTimeout(retryTimer)
        try { ws && ws.close() } catch { /* noop */ }
      },
      send(obj) {
        if (ws && ws.readyState === 1) {
          try { ws.send(JSON.stringify(obj)); return true } catch { /* noop */ }
        }
        return false
      },
    }
  }, [])

  return useMemo(() => ({ agentFetch, wsConnect }), [agentFetch, wsConnect])
}

/* ── polling hooks (read tier) ─────────────────────────────────────── */
function usePoll(fetcher, intervalMs, deps) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const savedFetcher = useRef(fetcher)
  savedFetcher.current = fetcher

  const run = useCallback(async (signal) => {
    try {
      const d = await savedFetcher.current(signal)
      if (!signal?.aborted) { setData(d); setError(null) }
    } catch (err) {
      if (err?.name !== 'AbortError') setError(err)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    run(ctrl.signal)
    if (!intervalMs) return () => ctrl.abort()
    const t = setInterval(() => run(ctrl.signal), intervalMs)
    return () => { clearInterval(t); ctrl.abort() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, ...deps])

  return { data, error, loading, refresh: () => run() }
}

export function useHostMetricsCurrent(intervalMs = 15000) {
  const { agentFetch } = useAgentClient()
  return usePoll((signal) => agentFetch('/api/host/metrics/current', { signal }), intervalMs, [])
}

export function useHostInfo() {
  const { agentFetch } = useAgentClient()
  return usePoll((signal) => agentFetch('/api/host/info', { signal }), 0, [])
}

export function useCollectorStatus(intervalMs = 30000) {
  const { agentFetch } = useAgentClient()
  return usePoll((signal) => agentFetch('/api/collector/status', { signal }), intervalMs, [])
}

export function useHostMetricsRange(from, to, metrics = 'cpu,mem', points = 300, agg = 'avg') {
  const { agentFetch } = useAgentClient()
  const qs = new URLSearchParams({ from: String(from), to: String(to), metrics, points: String(points), agg })
  return usePoll(
    (signal) => agentFetch(`/api/host/metrics/range?${qs}`, { signal }),
    0,
    [from, to, metrics, points, agg],
  )
}

export function useContainers(intervalMs = 10000) {
  const { agentFetch } = useAgentClient()
  return usePoll((signal) => agentFetch('/api/containers', { signal }), intervalMs, [])
}

export function useContainerInspect(id) {
  const { agentFetch } = useAgentClient()
  return usePoll(
    (signal) => (id ? agentFetch(`/api/containers/${id}`, { signal }) : Promise.resolve(null)),
    0,
    [id],
  )
}

/* ── stream helpers ───────────────────────────────────────────────── */
export function useStreams() {
  const { wsConnect } = useAgentClient()
  const openLogStream = useCallback((id, { tail = 200, timestamps = true, onFrame, onStatus } = {}) => {
    const qs = new URLSearchParams({ tail: String(tail), timestamps: String(timestamps) })
    return wsConnect(`/api/containers/${id}/logs/stream?${qs}`, { onFrame, onStatus })
  }, [wsConnect])
  const openStatsStream = useCallback((id, { onFrame, onStatus } = {}) => {
    return wsConnect(`/api/containers/${id}/stats/stream`, { onFrame, onStatus })
  }, [wsConnect])
  return { openLogStream, openStatsStream }
}

/* ── Plan 2: images / audit read hooks ────────────────────────────── */
export function useImages(intervalMs = 15000) {
  const { agentFetch } = useAgentClient()
  return usePoll((signal) => agentFetch('/api/images', { signal }), intervalMs, [])
}

export function useSystemDf(intervalMs = 30000) {
  const { agentFetch } = useAgentClient()
  return usePoll((signal) => agentFetch('/api/images/df', { signal }), intervalMs, [])
}

export function useAudit(action = '', intervalMs = 15000) {
  const { agentFetch } = useAgentClient()
  const qs = action ? `?action=${encodeURIComponent(action)}` : ''
  return usePoll((signal) => agentFetch(`/api/audit${qs}`, { signal }), intervalMs, [action])
}

/* ── Plan 2: admin actions ───────────────────────────────────────── */
export function useAdminActions() {
  const { agentFetch } = useAgentClient()

  const runAction = useCallback((id, action, params = {}) => {
    // action: start | stop | restart | kill | remove | recreate
    const qs = new URLSearchParams()
    if (params.t != null) qs.set('t', String(params.t))
    if (params.signal) qs.set('signal', params.signal)
    if (params.force != null) qs.set('force', String(params.force))
    if (params.volumes != null) qs.set('volumes', String(params.volumes))
    const q = qs.toString() ? `?${qs}` : ''
    const body = action === 'recreate'
      ? { pull: params.pull ?? true, force: params.force ?? false }
      : undefined
    return agentFetch(`/api/containers/${id}/${action}${q}`, { method: 'POST', body, admin: true })
  }, [agentFetch])

  const pullImage = useCallback(
    (ref) => agentFetch('/api/images/pull', { method: 'POST', body: { ref }, admin: true }),
    [agentFetch],
  )
  const pruneImages = useCallback(
    (danglingOnly = true) => agentFetch('/api/images/prune', {
      method: 'POST', body: { dangling_only: danglingOnly }, admin: true,
    }),
    [agentFetch],
  )
  const pruneContainers = useCallback(
    () => agentFetch('/api/containers/prune', { method: 'POST', admin: true }),
    [agentFetch],
  )

  return { runAction, pullImage, pruneImages, pruneContainers }
}

/* Subscribe to a task-progress WS (pull / recreate). Returns {frames, status,
   result, error}. Frames are replayed from the server buffer on connect. */
export function useTask(taskId, onProgress) {
  const { wsConnect } = useAgentClient()
  const [frames, setFrames] = useState([])
  const [status, setStatus] = useState('idle')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const cbRef = useRef(onProgress)
  cbRef.current = onProgress

  useEffect(() => {
    if (!taskId) { setStatus('idle'); return }
    setFrames([]); setResult(null); setError(null); setStatus('connecting')
    const ctl = wsConnect(`/api/tasks/${taskId}`, {
      admin: true,
      onStatus: (s) => setStatus(st => (st === 'done' || st === 'error' ? st : s)),
      onFrame: (f) => {
        setFrames(prev => [...prev, f])
        cbRef.current && cbRef.current(f)
        if (f.type === 'done') { setStatus('done'); setResult(f.result) }
        if (f.type === 'error') { setStatus('error'); setError(f.message || 'task failed') }
      },
    })
    return () => ctl.close()
  }, [taskId, wsConnect])

  return { frames, status, result, error }
}

/* Open an interactive exec socket. Returns { stdin, resize, close }. */
export function useExec() {
  const { wsConnect } = useAgentClient()
  return useCallback((id, { cmd = '/bin/sh', tty = true, onFrame, onStatus } = {}) => {
    const qs = new URLSearchParams({ cmd, tty: String(tty) })
    const ctl = wsConnect(`/api/containers/${id}/exec?${qs}`, { admin: true, onFrame, onStatus })
    return {
      close: ctl.close,
      stdin: (data) => ctl.send({ type: 'stdin', data }),
      resize: (cols, rows) => ctl.send({ type: 'resize', cols, rows }),
      ping: () => ctl.send({ type: 'ping' }),
    }
  }, [wsConnect])
}
