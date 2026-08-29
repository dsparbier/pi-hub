/* Destructive-action confirm. For remove / recreate the operator must type the
   container name; other actions just need a click. */
import { useEffect, useState } from 'react'
import { Icon } from '../extra-icons.jsx'
import styles from './agent.module.css'

export default function ConfirmDialog({
  title, body, confirmLabel = 'Confirm', tone = 'stop',
  requireText, extra, onConfirm, onClose,
}) {
  const [typed, setTyped] = useState('')
  const [checked, setChecked] = useState({})
  const ok = !requireText || typed === requireText

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className={styles.modalScrim} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <Icon name="trash" size={15} />
          <span className="title">{title}</span>
          <span style={{ flex: 1 }} />
          <button className={styles.iconBtn} onClick={onClose} aria-label="Close"><Icon name="x" size={15} /></button>
        </div>
        <div className={styles.modalBody}>
          {body && <p>{body}</p>}
          {extra?.map(opt => (
            <label key={opt.key} className={styles.checkRow}>
              <input type="checkbox" checked={!!checked[opt.key]}
                onChange={e => setChecked(c => ({ ...c, [opt.key]: e.target.checked }))} />
              {opt.label}
            </label>
          ))}
          {requireText && (
            <>
              <p className={styles.confirmHint}>Type <code>{requireText}</code> to confirm:</p>
              <input className={styles.textInput} value={typed} autoFocus
                onChange={e => setTyped(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && ok && onConfirm(checked)} />
            </>
          )}
        </div>
        <div className={styles.modalFoot}>
          <button className={styles.btnGhost} onClick={onClose}>Cancel</button>
          <button className={`${styles.btn} ${styles['btn_' + tone] || ''}`}
            disabled={!ok} onClick={() => onConfirm(checked)}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
