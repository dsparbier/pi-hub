import { ACCENT_PRESETS } from '../hooks/useTheme.js'
import { REFRESH_OPTIONS, TIMEOUT_OPTIONS } from '../hooks/useConfig.js'
import styles from './Settings.module.css'

const THEMES = [
  { value: 'dark',   label: 'Dark',   icon: '🌙' },
  { value: 'light',  label: 'Light',  icon: '☀️' },
  { value: 'system', label: 'System', icon: '💻' },
]

export default function Settings({
  config,
  onSave,
  theme,
  setTheme,
  accentIndex,
  setAccent,
  onClose,
}) {
  function set(key, value) {
    onSave({ ...config, [key]: value })
  }

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <aside className={styles.drawer}>
        <div className={styles.drawerHeader}>
          <div className={styles.drawerTitleRow}>
            <span className={styles.drawerIcon}>⚙</span>
            <h2 className={styles.drawerTitle}>Settings</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.drawerBody}>

          {/* ── General ─────────────────────────────── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>General</h3>

            <Field label="Hub Name" hint="Displayed in the sidebar and browser title">
              <input
                className={styles.input}
                value={config.hubName}
                onChange={e => set('hubName', e.target.value)}
                placeholder="Pi-Hub"
              />
            </Field>

            <Field label="Hostname / IP" hint="Used in the status bar and health check base URLs">
              <input
                className={styles.input}
                value={config.hostname}
                onChange={e => set('hostname', e.target.value)}
                placeholder="192.168.1.100"
              />
            </Field>

            <Field label="Local Domain" hint="Base domain for service URLs (e.g. pi-hub.local)">
              <input
                className={styles.input}
                value={config.localDomain}
                onChange={e => set('localDomain', e.target.value)}
                placeholder="pi-hub.local"
              />
            </Field>
          </section>

          <div className={styles.divider} />

          {/* ── Health Monitoring ────────────────────── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Health Monitoring</h3>

            <Field label="Auto-refresh interval" hint="How often to poll service health endpoints">
              <div className={styles.segmented}>
                {REFRESH_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className={`${styles.segBtn} ${config.healthRefreshMs === opt.value ? styles.segBtnActive : ''}`}
                    onClick={() => set('healthRefreshMs', opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Request timeout" hint="Maximum wait time for a health check response">
              <div className={styles.segmented}>
                {TIMEOUT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className={`${styles.segBtn} ${config.healthTimeoutMs === opt.value ? styles.segBtnActive : ''}`}
                    onClick={() => set('healthTimeoutMs', opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>
          </section>

          <div className={styles.divider} />

          {/* ── Appearance ───────────────────────────── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Appearance</h3>

            <Field label="Theme">
              <div className={styles.themeGroup}>
                {THEMES.map(t => (
                  <button
                    key={t.value}
                    className={`${styles.themeBtn} ${theme === t.value ? styles.themeBtnActive : ''}`}
                    onClick={() => setTheme(t.value)}
                  >
                    <span className={styles.themeBtnIcon}>{t.icon}</span>
                    <span className={styles.themeBtnLabel}>{t.label}</span>
                    {theme === t.value && <span className={styles.themeBtnCheck}>✓</span>}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Accent Color">
              <div className={styles.paletteGrid}>
                {ACCENT_PRESETS.map((preset, i) => (
                  <button
                    key={preset.name}
                    className={`${styles.swatch} ${accentIndex === i ? styles.swatchActive : ''}`}
                    style={{ '--swatch-color': preset.value }}
                    onClick={() => setAccent(i)}
                    title={preset.name}
                    aria-label={`${preset.name} accent${accentIndex === i ? ' (active)' : ''}`}
                  >
                    {accentIndex === i && <span className={styles.swatchCheck}>✓</span>}
                  </button>
                ))}
              </div>
              <div className={styles.accentPreview}>
                <span className={styles.accentPreviewLabel}>Current —</span>
                <span
                  className={styles.accentPreviewChip}
                  style={{ background: ACCENT_PRESETS[accentIndex]?.value }}
                />
                <span className={styles.accentPreviewName}>{ACCENT_PRESETS[accentIndex]?.name}</span>
                <code className={styles.accentPreviewHex}>{ACCENT_PRESETS[accentIndex]?.value}</code>
              </div>
            </Field>
          </section>

        </div>
      </aside>
    </>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldHeader}>
        <label className={styles.fieldLabel}>{label}</label>
        {hint && <span className={styles.fieldHint}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}
