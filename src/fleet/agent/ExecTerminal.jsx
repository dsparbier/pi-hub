/* Interactive exec shell. This whole module is a lazy chunk (see ContainerDetail's
   React.lazy) so xterm never touches the base console bundle.

   Wiring is manual (no attach addon): term.onData → WS {type:stdin}; WS
   {type:stdout} → term.write. Fit-addon resize → WS {type:resize}. */
import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useExec } from '../useAgent.js'
import { Icon } from '../extra-icons.jsx'
import styles from './agent.module.css'

const SHELLS = ['/bin/sh', '/bin/bash']

export default function ExecTerminal({ containerId }) {
  const openExec = useExec()
  const hostRef = useRef(null)
  const termRef = useRef(null)
  const fitRef = useRef(null)
  const execRef = useRef(null)
  const [cmd, setCmd] = useState('/bin/sh')
  const [status, setStatus] = useState('idle')
  const [exitCode, setExitCode] = useState(null)
  const [gen, setGen] = useState(0) // bump to restart the session

  useEffect(() => {
    const term = new Terminal({
      convertEol: true, cursorBlink: true, fontSize: 13,
      fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
      theme: { background: '#0c110f', foreground: '#e3eae7' },
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(hostRef.current)
    try { fit.fit() } catch { /* not laid out yet */ }
    termRef.current = term
    fitRef.current = fit
    setExitCode(null)

    const exec = openExec(containerId, {
      cmd,
      onStatus: setStatus,
      onFrame: (f) => {
        if (f.type === 'stdout') term.write(f.data)
        else if (f.type === 'ready') { try { fit.fit() } catch {} sendResize() }
        else if (f.type === 'error') term.write(`\r\n\x1b[31m[agent] ${f.message}\x1b[0m\r\n`)
        else if (f.type === 'exit') {
          setExitCode(f.code ?? null)
          term.write(`\r\n\x1b[90m[session ended${f.code != null ? ` — exit ${f.code}` : ''}]\x1b[0m\r\n`)
        }
      },
    })
    execRef.current = exec

    const onData = term.onData(d => exec.stdin(d))
    function sendResize() { exec.resize(term.cols, term.rows) }
    const ro = new ResizeObserver(() => {
      try { fit.fit(); sendResize() } catch { /* noop */ }
    })
    ro.observe(hostRef.current)

    const ping = setInterval(() => exec.ping?.(), 30000)

    return () => {
      clearInterval(ping)
      ro.disconnect()
      onData.dispose()
      exec.close()
      term.dispose()
    }
  }, [containerId, cmd, gen, openExec])

  return (
    <div className={styles.execWrap}>
      <div className={styles.execBar}>
        <span className={`fleet-pill ${status === 'open' || status === 'ready'
          ? 'ok' : status === 'unauthorized' ? 'stop' : 'idle'}`}>{status}</span>
        <label className={styles.selWrap}>
          shell
          <select value={cmd} onChange={e => setCmd(e.target.value)}>
            {SHELLS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <button className={styles.btnGhost} onClick={() => setGen(g => g + 1)}>
          <Icon name="rotate-cw" size={12} /> restart
        </button>
        {exitCode != null && <span className={styles.muted}>exit {exitCode}</span>}
        <span className={styles.execWarn}>
          <Icon name="terminal" size={11} /> root-capable shell on the Pi — audited
        </span>
      </div>
      <div ref={hostRef} className={styles.execHost} />
    </div>
  )
}
