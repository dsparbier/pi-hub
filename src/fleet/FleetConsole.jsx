import { useMemo } from 'react'
import fleetServices, { FLEET_GROUPS } from '../config/fleet.js'
import { useFleetHealth } from './useFleetHealth.js'
import { Icon } from './icons.jsx'

const TONE = { up: 'ok', slow: 'warn', down: 'stop', unknown: 'idle' }

function toneOf(r) {
  if (!r) return 'unknown'
  if (!r.up) return 'down'
  if (r.adminError) return 'slow'
  if (r.admin && r.admin.dbReachable === false) return 'slow'
  if (r.latency != null && r.latency > 1500) return 'slow'
  return 'up'
}

export default function FleetConsole() {
  const { results, lastRun, running, run } = useFleetHealth(fleetServices, 20000)

  const summary = useMemo(() => {
    const rows = fleetServices.map(s => ({ s, r: results[s.id], t: toneOf(results[s.id]) }))
    return {
      rows,
      up: rows.filter(x => x.t === 'up').length,
      slow: rows.filter(x => x.t === 'slow').length,
      down: rows.filter(x => x.t === 'down').length,
      total: rows.length,
      backendsOnSql: rows.filter(x => x.r?.admin?.dbReachable === true).length,
      migrated: rows.filter(x => x.s.adminBase).length,
    }
  }, [results])

  return (
    <>
      <header className="fleet-page-header">
        <div className="eyebrow">console.pi-hub.local</div>
        <h1>Pi-Hub Fleet Console</h1>
        <p className="lede">Live health and configuration for every service on the Pi-Hub host —
          the migrated <code>fleet_config</code> backends report their active SQL-Hub target,
          <code>db_reachable</code> and <code>fleet_settings</code> state via <code>/api/admin/health</code>.</p>
        <div className="meta">
          <span>services <b>{summary.total}</b></span>
          <span>last check <b>{lastRun ? lastRun.toLocaleTimeString() : '—'}</b></span>
          <span>
            <button className="fleet-filter" style={{ display: 'inline-flex', padding: 0, border: 0, background: 'none' }}>
              <span className="fleet-pill idle" style={{ cursor: 'pointer' }} onClick={run}>
                {running ? 'checking…' : 'refresh now'}
              </span>
            </button>
          </span>
        </div>
      </header>

      <section className="fleet-section">
        <div className="fleet-sec-head"><h2>At a glance</h2><span className="rule" /></div>
        <div className="fleet-tiles">
          <div className="fleet-tile"><div className="k">Up</div><div className="v" style={{ color: 'var(--ok)' }}>{summary.up}<small> / {summary.total}</small></div><div className="sub">responding normally</div></div>
          <div className="fleet-tile"><div className="k">Degraded</div><div className="v" style={{ color: summary.slow ? 'var(--warn)' : 'inherit' }}>{summary.slow}</div><div className="sub">slow or db unreachable</div></div>
          <div className="fleet-tile"><div className="k">Down</div><div className="v" style={{ color: summary.down ? 'var(--stop)' : 'inherit' }}>{summary.down}</div><div className="sub">no response</div></div>
          <div className="fleet-tile"><div className="k">On SQL-Hub</div><div className="v">{summary.backendsOnSql}<small> / {summary.migrated}</small></div><div className="sub">fleet_config backends, db reachable</div></div>
        </div>
      </section>

      {FLEET_GROUPS.map(g => {
        const rows = summary.rows.filter(x => x.s.group === g.id)
        if (!rows.length) return null
        const up = rows.filter(x => x.t === 'up').length
        return (
          <section key={g.id} className="fleet-section" data-group={g.id}>
            <div className="fleet-sec-head">
              <h2>{g.label}</h2><span className="rule" />
              <span className="count">{up} / {rows.length} up</span>
            </div>
            <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
              {rows.map(({ s, r, t }) => <ServiceCard key={s.id} svc={s} res={r} tone={t} />)}
            </div>
          </section>
        )
      })}
    </>
  )
}

function ServiceCard({ svc, res, tone }) {
  const a = res?.admin
  return (
    <div className={`fleet-card ${TONE[tone]}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Icon name={svc.icon || 'circle'} />
        <span className="title" style={{ flex: 1 }}>{svc.label}</span>
        <span className={`fleet-pill ${TONE[tone]}`}>{tone}</span>
      </div>

      <dl className="facts">
        <dt>status</dt>
        <dd>{res ? (res.up ? `up · ${res.latency ?? '?'}ms` : (res.reason || 'down')) : '…'}</dd>
        {svc.port && (<><dt>port</dt><dd>{svc.port}</dd></>)}
        {a && (
          <>
            <dt>SQL-Hub</dt>
            <dd>{a.mode === 'config-only' ? 'config-only' : (a.activeTarget || '—')}</dd>
            <dt>db</dt>
            <dd>{a.db || '—'}{a.dbReachable === false ? ' ✗' : a.dbReachable ? ' ✓' : ''}</dd>
            <dt>fleet_settings</dt>
            <dd>{a.fleetSettings == null ? '—' : a.fleetSettings ? 'loaded' : 'none'}</dd>
          </>
        )}
        {res?.adminError && (<><dt>admin</dt><dd style={{ color: 'var(--warn)' }}>{res.adminError}</dd></>)}
      </dl>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {svc.blurb && <span style={{ fontSize: '12px', color: 'var(--muted)', flexBasis: '100%' }}>{svc.blurb}</span>}
        {svc.open && (
          <a className="fleet-pill idle" href={svc.open} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
            open <Icon name="external-link" size={11} />
          </a>
        )}
        {svc.adminBase && (
          <a className="fleet-pill idle" href={`${svc.adminBase}/api/admin/config`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
            admin config
          </a>
        )}
      </div>
    </div>
  )
}
