import { useState } from 'react'
import styles from './ManageServices.module.css'

const EMPTY_FORM = { label: '', icon: '', description: '', url: '', dashboardUrl: '', homeUrl: '', adminUrl: '', status: 'online', group: '', links: [] }
const STATUS_OPTIONS = ['online', 'offline', 'warning', 'loading']

export default function ManageServices({ services, groups, onClose, onAdd, onEdit, onDelete }) {
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
              groups={groups}
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
                    groups={groups}
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

function ServiceRow({ service, groups = [], onEdit, onDelete }) {
  const group = groups.find(g => g.id === service.group)
  return (
    <div className={styles.row}>
      <span className={styles.rowIcon}>{service.icon || '⬡'}</span>
      <div className={styles.rowInfo}>
        <div className={styles.rowTopLine}>
          <span className={styles.rowLabel}>{service.label}</span>
          {group && <span className={styles.rowGroup}>{group.icon} {group.label}</span>}
        </div>
        {service.url
          ? <a className={styles.rowUrl} href={service.url} target="_blank" rel="noopener noreferrer">{service.url}</a>
          : <span className={styles.rowNoUrl}>No console URL set</span>
        }
        {(service.dashboardUrl || service.homeUrl || service.adminUrl) && (
          <span className={styles.rowUrlBadges}>
            {service.dashboardUrl && <span className={styles.rowUrlChip}>Dashboard</span>}
            {service.homeUrl      && <span className={styles.rowUrlChip}>Default</span>}
            {service.adminUrl     && <span className={styles.rowUrlChip}>Admin</span>}
          </span>
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

function ServiceForm({ initialValues, groups = [], onSave, onCancel, isNew }) {
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
        <label className={styles.formLabel}>Console URL</label>
        <input
          className={styles.formInput}
          value={form.url}
          onChange={e => set('url', e.target.value)}
          placeholder="http://192.168.1.x:port"
          type="url"
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Dashboard Page</label>
        <input
          className={styles.formInput}
          value={form.dashboardUrl}
          onChange={e => set('dashboardUrl', e.target.value)}
          placeholder="https://…/dashboard"
          type="url"
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Default Page</label>
        <input
          className={styles.formInput}
          value={form.homeUrl}
          onChange={e => set('homeUrl', e.target.value)}
          placeholder="https://…/"
          type="url"
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Admin Page</label>
        <input
          className={styles.formInput}
          value={form.adminUrl}
          onChange={e => set('adminUrl', e.target.value)}
          placeholder="https://…/admin"
          type="url"
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Group</label>
        <select
          className={styles.formSelect}
          value={form.group ?? ''}
          onChange={e => set('group', e.target.value)}
        >
          <option value="">— Ungrouped —</option>
          {groups.map(g => (
            <option key={g.id} value={g.id}>{g.icon} {g.label}</option>
          ))}
        </select>
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

      <ServiceLinks
        links={form.links || []}
        onChange={links => set('links', links)}
      />

      <div className={styles.formActions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
        <button type="submit" className={styles.saveBtn}>
          {isNew ? '＋ Add Service' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}

function ServiceLinks({ links = [], onChange }) {
  const [newLinkLabel, setNewLinkLabel] = useState('')
  const [newLinkUrl, setNewLinkUrl] = useState('')

  function handleAddLink() {
    if (!newLinkLabel.trim() || !newLinkUrl.trim()) return
    const newLink = {
      id: `link-${Date.now()}`,
      label: newLinkLabel.trim(),
      url: newLinkUrl.trim()
    }
    onChange([...links, newLink])
    setNewLinkLabel('')
    setNewLinkUrl('')
  }

  function handleDeleteLink(linkId) {
    onChange(links.filter(l => l.id !== linkId))
  }

  return (
    <div className={styles.formGroup}>
      <label className={styles.formLabel}>Service Links</label>
      <div className={styles.linksSection}>
        {links.length > 0 && (
          <div className={styles.linksList}>
            {links.map(link => (
              <div key={link.id} className={styles.linkItem}>
                <div className={styles.linkInfo}>
                  <div className={styles.linkLabel}>{link.label}</div>
                  <div className={styles.linkUrl}>{link.url}</div>
                </div>
                <button
                  type="button"
                  className={styles.deleteLinkBtn}
                  onClick={() => handleDeleteLink(link.id)}
                  title="Delete link"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className={styles.addLinkForm}>
          <input
            className={styles.formInput}
            placeholder="Link label (e.g., 'Dashboard')"
            value={newLinkLabel}
            onChange={e => setNewLinkLabel(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleAddLink()}
          />
          <input
            className={styles.formInput}
            placeholder="URL (e.g., https://…/dashboard)"
            value={newLinkUrl}
            onChange={e => setNewLinkUrl(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleAddLink()}
            type="url"
          />
          <button
            type="button"
            className={styles.addLinkBtn}
            onClick={handleAddLink}
            disabled={!newLinkLabel.trim() || !newLinkUrl.trim()}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const cls = { online: 'online', offline: 'offline', warning: 'warning', loading: 'loading' }
  return <span className={`${styles.badge} ${styles[cls[status] ?? 'loading']}`}>{status}</span>
}
