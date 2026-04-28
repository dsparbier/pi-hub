import { ACCENT_PRESETS } from '../hooks/useTheme.js'
import styles from './EditLayout.module.css'

const THEMES = [
  { value: 'dark',   label: 'Dark',   icon: '🌙' },
  { value: 'light',  label: 'Light',  icon: '☀️' },
  { value: 'system', label: 'System', icon: '💻' },
]

export default function EditLayout({ theme, setTheme, accentIndex, setAccent, onClose }) {
  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <aside className={styles.drawer}>
        <div className={styles.drawerHeader}>
          <h2 className={styles.drawerTitle}>Edit Layout</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.drawerBody}>

          {/* ── Theme ── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Theme</h3>
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
          </section>

          <div className={styles.divider} />

          {/* ── Accent colour ── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Accent Colour</h3>
            <div className={styles.paletteGrid}>
              {ACCENT_PRESETS.map((preset, i) => (
                <button
                  key={preset.name}
                  className={`${styles.swatch} ${accentIndex === i ? styles.swatchActive : ''}`}
                  style={{ '--swatch-color': preset.value }}
                  onClick={() => setAccent(i)}
                  title={preset.name}
                  aria-label={`${preset.name} accent colour${accentIndex === i ? ' (active)' : ''}`}
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
              <span className={styles.accentPreviewName}>
                {ACCENT_PRESETS[accentIndex]?.name}
              </span>
              <code className={styles.accentPreviewHex}>
                {ACCENT_PRESETS[accentIndex]?.value}
              </code>
            </div>
          </section>

        </div>
      </aside>
    </>
  )
}
