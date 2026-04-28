import { useState } from 'react'
import styles from './ManageServices.module.css'

const EMPTY_FORM = { label: '', icon: '', description: '', url: '', status: 'online' }
const STATUS_OPTIONS = ['online', 'offline', 'warning', 'loading']

export default function ManageServices({ services, onClose, onAdd, onEdit, onDelete }) {
  const [addingNew, setAddingNew] = useState(false)
  const [editingId, setEditingId] = useState(null)

  function handleAdd(data) {
    onAdd(data)
    setAddingNew(false)
  }

  function handleEdit(id, data) {
    onEdit(id, data)
    setEditingId(null)
  }

  function handleCancelAdd() {
    setAddingNew(false)
  }

  function handleCancelEdit() {
    setEditingId(null)
  }

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <aside className={styles.drawer}>
        <div className={styles.drawerHeader}>
          <h2 className={styles.drawerTitle}>Manage Services</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.drawerBody}>
          {/* Add new service */}
          {addingNew ? (
            <ServiceForm
              initialValues={EMPTY_FORM}
              onSave={handleAdd}
              onCancel={handleCancelAdd}
              isNew
            />
          ) : (
            <button
              className={styles.addBtn}
              onClick={() => { setAddingNew(true); setEditingId(null) }}
            >
              <span>＋</span> Add New Service
            </button>
          )}

          <div className={styles.divider} />

          {/* Service list */}
          <ul className={styles.list}>
            {services.map(service => (
              <li key={service.id} className={styles.listItem}>
                {editingId === service.id ? (
                  <ServiceForm
                    initialValues={service}
                    onSave={data => handleEdit(service.id, data)}
                    onCancel={handleCancelEdit}
                  />
                ) : (
                  <ServiceRow
                    service={service}
                    onEdit={() => { setEditingId(service.id); setAddingNew(false) }}
                    onDelete={() => onDelete(service.id)}
                  />
                )}
              </li>
            ))}
          </ul>

          {services.length === 0 && (
            <p className={styles.emptyMsg}>No services configured yet.</p>
          )}
        </div>
      </aside>
    </>
  )
}

function ServiceRow({ service, onEdit, onDelete }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowIcon}>{service.icon || '⬡'}</span>
      <div className={styles.rowInfo}>
        <span className={styles.rowLabel}>{service.label}</span>
        {service.description && (
          <span className={styles.rowDesc}>{service.description}</span>
        )}
      </div>
      <StatusBadge status={service.status} />
      <div className={styles.rowActions}>
        <button className={styles.actionBtn} onClick={onEdit} title="Edit">✎</button>
        <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={onDelete} title="Delete">✕</button>
      </div>
    </div>
  )
}

function ServiceForm({ initialValues, onSave, onCancel, isNew }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initialValues })

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.label.trim()) return
    onSave({ ...form, label: form.label.trim() })
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.formTitle}>{isNew ? 'New Service' : `Edit — ${initialValues.label}`}</div>

      <div className={styles.formRow}>
        <label className={styles.formLabel}>Icon</label>
        <input
          className={`${styles.formInput} ${styles.iconInput}`}
          value={form.icon}
          onChange={e => set('icon', e.target.value)}
          placeholder="🔧"
          maxLength={4}
        />
        <label className={styles.formLabel}>Label *</label>
        <input
          className={styles.formInput}
          value={form.label}
          onChange={e => set('label', e.target.value)}
          placeholder="Service name"
          required
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Description</label>
        <input
          className={styles.formInput}
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Short description"
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>URL <span className={styles.optional}>(optional)</span></label>
        <input
          className={styles.formInput}
          value={form.url}
          onChange={e => set('url', e.target.value)}
          placeholder="http://192.168.1.x:port"
          type="url"
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Status</label>
        <select
          className={styles.formSelect}
          value={form.status}
          onChange={e => set('status', e.target.value)}
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      <div className={styles.formActions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
        <button type="submit" className={styles.saveBtn}>
          {isNew ? '＋ Add Service' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}

function StatusBadge({ status }) {
  const cls = { online: 'online', offline: 'offline', warning: 'warning', loading: 'loading' }
  return <span className={`${styles.badge} ${styles[cls[status] ?? 'loading']}`}>{status}</span>
}
