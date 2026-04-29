import { useState } from 'react'
import { ACCENT_PRESETS } from '../hooks/useTheme.js'
import styles from './EditLayout.module.css'

const THEMES = [
  { value: 'dark',   label: 'Dark',   icon: '🌙' },
  { value: 'light',  label: 'Light',  icon: '☀️' },
  { value: 'system', label: 'System', icon: '💻' },
]

const EMPTY_GROUP = { icon: '', label: '' }

export default function EditLayout({
  theme, setTheme,
  accentIndex, setAccent,
  groups, onAddGroup, onEditGroup, onDeleteGroup,
  onClose,
}) {
  const [addingGroup, setAddingGroup] = useState(false)
  const [editingGroupId, setEditingGroupId] = useState(null)

  function handleAdd(data) {
    onAddGroup(data)
    setAddingGroup(false)
  }

  function handleEdit(id, data) {
    onEditGroup(id, data)
    setEditingGroupId(null)
  }

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

          <div className={styles.divider} />

          {/* ── Groups ── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Sidebar Groups</h3>

            {addingGroup ? (
              <GroupForm
                initialValues={EMPTY_GROUP}
                onSave={handleAdd}
                onCancel={() => setAddingGroup(false)}
                isNew
              />
            ) : (
              <button
                className={styles.groupAddBtn}
                onClick={() => { setAddingGroup(true); setEditingGroupId(null) }}
              >
                <span>＋</span> Add Group
              </button>
            )}

            <ul className={styles.groupList}>
              {groups.map(g => (
                <li key={g.id}>
                  {editingGroupId === g.id ? (
                    <GroupForm
                      initialValues={g}
                      onSave={data => handleEdit(g.id, data)}
                      onCancel={() => setEditingGroupId(null)}
                    />
                  ) : (
                    <div className={styles.groupRow}>
                      <span className={styles.groupRowIcon}>{g.icon || '⬡'}</span>
                      <span className={styles.groupRowLabel}>{g.label}</span>
                      <div className={styles.groupRowActions}>
                        <button
                          className={styles.groupActionBtn}
                          onClick={() => { setEditingGroupId(g.id); setAddingGroup(false) }}
                          title="Edit"
                        >✎</button>
                        <button
                          className={`${styles.groupActionBtn} ${styles.groupDeleteBtn}`}
                          onClick={() => onDeleteGroup(g.id)}
                          title="Delete"
                        >✕</button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {groups.length === 0 && !addingGroup && (
              <p className={styles.groupEmpty}>No groups defined yet.</p>
            )}
          </section>

        </div>
      </aside>
    </>
  )
}

function GroupForm({ initialValues, onSave, onCancel, isNew }) {
  const [form, setForm] = useState({ ...EMPTY_GROUP, ...initialValues })

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.label.trim()) return
    onSave({ ...form, label: form.label.trim() })
  }

  return (
    <form className={styles.groupForm} onSubmit={handleSubmit}>
      <input
        className={`${styles.groupInput} ${styles.groupIconInput}`}
        value={form.icon}
        onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
        placeholder="🏗"
        maxLength={4}
      />
      <input
        className={styles.groupInput}
        value={form.label}
        onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
        placeholder="Group name"
        required
        style={{ flex: 1 }}
      />
      <button type="submit" className={styles.groupSaveBtn}>
        {isNew ? '＋' : '✓'}
      </button>
      <button type="button" className={styles.groupCancelBtn} onClick={onCancel}>✕</button>
    </form>
  )
}
