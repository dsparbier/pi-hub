/* Renders a task-progress WebSocket (image pull / recreate). Buffered frames are
   replayed by the server on connect, so opening this late still shows history. */
import { useEffect, useRef } from 'react'
import { useTask } from '../useAgent.js'
import styles from './agent.module.css'

export default function TaskProgress({ taskId, title = 'Task', onDone }) {
  const { frames, status, result, error } = useTask(taskId)
  const bodyRef = useRef(null)
  const firedRef = useRef(false)

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [frames])

  useEffect(() => {
    if ((status === 'done' || status === 'error') && !firedRef.current) {
      firedRef.current = true
      onDone?.(status, result || error)
    }
  }, [status, result, error, onDone])

  if (!taskId) return null
  return (
    <div className={styles.taskBox}>
      <div className={styles.taskHead}>
        <span className={`fleet-pill ${status === 'done' ? 'ok' : status === 'error' ? 'stop' : 'idle'}`}>
          {status}
        </span>
        <span className="title" style={{ fontSize: 13 }}>{title}</span>
      </div>
      <pre ref={bodyRef} className={styles.taskLog}>
        {frames.map((f, i) => (
          <div key={i} className={f.type === 'error' ? styles.logErr : undefined}>
            {f.type === 'progress'
              ? `${f.layer ? f.layer + ' ' : ''}${f.status || ''}${f.detail ? ' ' + f.detail : ''}`
              : f.type === 'log' ? f.message
              : f.type === 'done' ? `✓ ${JSON.stringify(f.result)}`
              : f.type === 'error' ? `✗ ${f.message}` : JSON.stringify(f)}
          </div>
        ))}
        {!frames.length && <div className={styles.logTs}>connecting…</div>}
      </pre>
    </div>
  )
}
