/* WebSocket log viewer for one container. Follow toggle, tail size, stream
   filter. Styling follows src/components/LogViewer.jsx conventions (mono, dark
   panel, level tint) without importing it. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStreams } from '../useAgent.js'
import { Icon } from '../extra-icons.jsx'
import styles from './agent.module.css'

const MAX_LINES = 2000
const TAILS = [100, 200, 500, 1000]

export default function LogStream({ containerId }) {
  const { openLogStream } = useStreams()
  const [lines, setLines] = useState([])
  const [status, setStatus] = useState('connecting')
  const [follow, setFollow] = useState(true)
  const [tail, setTail] = useState(200)
  const [filter, setFilter] = useState('all') // all | stdout | stderr
  const bodyRef = useRef(null)

  useEffect(() => {
    setLines([])
    const ctl = openLogStream(containerId, {
      tail,
      onStatus: setStatus,
      onFrame: (f) => {
        if (f.type === 'end') { setStatus('ended'); return }
        if (f.type !== 'log') return
        setLines(prev => {
          const next = prev.length >= MAX_LINES ? prev.slice(-(MAX_LINES - 1)) : prev
          return [...next, { ts: f.ts, stream: f.stream || 'stdout', text: f.text }]
        })
      },
    })
    return () => ctl.close()
  }, [containerId, tail, openLogStream])

  const shown = useMemo(
    () => (filter === 'all' ? lines : lines.filter(l => l.stream === filter)),
    [lines, filter],
  )

  useEffect(() => {
    if (follow && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [shown, follow])

  return (
    <div className={styles.logWrap}>
      <div className={styles.logBar}>
        <span className={`fleet-pill ${status === 'open' ? 'ok' : status === 'unauthorized' ? 'stop' : 'idle'}`}>
          {status}
        </span>
        <button className={styles.toggle} aria-pressed={follow} onClick={() => setFollow(f => !f)}>
          <Icon name="activity" size={12} /> follow
        </button>
        <label className={styles.selWrap}>
          tail
          <select value={tail} onChange={e => setTail(Number(e.target.value))}>
            {TAILS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <div className="fleet-filter">
          {['all', 'stdout', 'stderr'].map(f => (
            <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
        <span className={styles.logCount}>{shown.length} lines</span>
      </div>
      <pre ref={bodyRef} className={styles.logBody}>
        {shown.map((l, i) => (
          <div key={i} className={l.stream === 'stderr' ? styles.logErr : undefined}>
            {l.ts && <span className={styles.logTs}>{fmtTs(l.ts)} </span>}
            {l.text}
          </div>
        ))}
        {!shown.length && <div className={styles.logTs}>waiting for output…</div>}
      </pre>
    </div>
  )
}

function fmtTs(ts) {
  try { return new Date(ts).toLocaleTimeString() } catch { return ts }
}
