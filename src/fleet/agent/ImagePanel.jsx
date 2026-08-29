/* Images tab — list + sizes + consumers, `system df`, a pull form with task
   progress, and prune. Pull/prune need the admin key. */
import { useState } from 'react'
import { useImages, useSystemDf, useAdminActions } from '../useAgent.js'
import { useLogger } from '../../context/LoggerContext.jsx'
import { Icon } from '../extra-icons.jsx'
import TaskProgress from './TaskProgress.jsx'
import styles from './agent.module.css'

function fmtBytes(v) {
  if (v == null) return '—'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1 }
  return `${v.toFixed(i ? 1 : 0)} ${u[i]}`
}

export default function ImagePanel() {
  const images = useImages(20000)
  const df = useSystemDf(30000)
  const { pullImage, pruneImages } = useAdminActions()
  const log = useLogger()
  const [ref, setRef] = useState('')
  const [taskId, setTaskId] = useState(null)
  const [busy, setBusy] = useState(false)

  async function doPull(e) {
    e.preventDefault()
    if (!ref.trim()) return
    setBusy(true)
    try {
      const res = await pullImage(ref.trim())
      setTaskId(res.task_id)
    } catch (err) {
      log.error('pi-hub-agent', 'pull failed', String(err?.detail || err))
    } finally {
      setBusy(false)
    }
  }

  async function doPrune() {
    try {
      const res = await pruneImages(true)
      log.info('pi-hub-agent', `pruned ${res.deleted} images, reclaimed ${fmtBytes(res.space_reclaimed)}`)
      images.refresh()
      df.refresh()
    } catch (err) {
      log.error('pi-hub-agent', 'prune failed', String(err?.detail || err))
    }
  }

  const list = images.data?.images || []
  const d = df.data

  return (
    <>
      <div className={styles.dfRow}>
        {d ? (
          <>
            <Stat k="Layers" v={fmtBytes(d.layers_size)} />
            <Stat k="Images" v={fmtBytes(d.images_total)} sub={`${fmtBytes(d.images_reclaimable)} reclaimable`} />
            <Stat k="Volumes" v={fmtBytes(d.volumes_size)} />
            <Stat k="Build cache" v={fmtBytes(d.build_cache_size)} />
          </>
        ) : <span className={styles.muted}>system df {df.error ? 'unavailable' : 'loading…'}</span>}
      </div>

      <form className={styles.pullForm} onSubmit={doPull}>
        <Icon name="download" size={14} />
        <input className={styles.textInput} placeholder="repo:tag  (e.g. nginx:1.27-alpine)"
          value={ref} onChange={e => setRef(e.target.value)} />
        <button className={styles.btn} disabled={busy || !ref.trim()}>{busy ? 'starting…' : 'Pull'}</button>
        <button type="button" className={styles.btnGhost} onClick={doPrune}>
          <Icon name="trash" size={12} /> Prune dangling
        </button>
      </form>

      {taskId && (
        <TaskProgress taskId={taskId} title={`pull ${ref}`}
          onDone={(status) => { if (status === 'done') { images.refresh(); df.refresh() } }} />
      )}

      {images.error && !list.length && (
        <div className={styles.chartEmpty}>could not reach the agent (HTTP {images.error.status || '—'}).</div>
      )}
      {!!list.length && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Repository:tag</th><th className={styles.num}>Size</th>
                <th className={styles.num}>In use</th><th>ID</th></tr>
            </thead>
            <tbody>
              {list.map(im => (
                <tr key={im.id}>
                  <td>
                    {im.repo_tags.length
                      ? im.repo_tags.join(', ')
                      : <span className={styles.muted}>&lt;none&gt; {im.dangling && '· dangling'}</span>}
                  </td>
                  <td className={styles.num}>{fmtBytes(im.size)}</td>
                  <td className={styles.num}>
                    {im.containers_using
                      ? im.containers_using
                      : <span className={styles.muted}>0</span>}
                  </td>
                  <td className={styles.muted}>{(im.id || '').replace('sha256:', '').slice(0, 12)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function Stat({ k, v, sub }) {
  return (
    <div className={styles.dfStat}>
      <div className={styles.statLabel}>{k}</div>
      <div className={styles.statValue}>{v}</div>
      {sub && <div className={styles.muted} style={{ fontSize: 11 }}>{sub}</div>}
    </div>
  )
}
