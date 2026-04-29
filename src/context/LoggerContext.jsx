import { createContext, useContext, useState, useCallback, useMemo } from 'react'

export const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 }
const MAX_LOGS = 2000

const LoggerContext = createContext(null)

export function LoggerProvider({ children }) {
  const [logs, setLogs]       = useState([])
  const [minLevel, setMinLevel] = useState('DEBUG')

  const addLog = useCallback((level, service, message, data) => {
    if (LOG_LEVELS[level] < LOG_LEVELS[minLevel]) return
    const entry = {
      id:        `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      level,
      service:   service || 'pi-hub',
      message:   String(message),
      data,
    }
    setLogs(prev => [...prev.slice(-(MAX_LOGS - 1)), entry])

    // Mirror to browser console
    const consoleFn = level === 'ERROR' ? console.error
                    : level === 'WARN'  ? console.warn
                    : level === 'DEBUG' ? console.debug
                    : console.info
    consoleFn(`[${entry.timestamp}] [${level}] [${entry.service}] ${entry.message}`, data ?? '')
  }, [minLevel])

  const value = useMemo(() => ({
    logs,
    minLevel,
    setMinLevel,
    debug: (svc, msg, data) => addLog('DEBUG', svc, msg, data),
    info:  (svc, msg, data) => addLog('INFO',  svc, msg, data),
    warn:  (svc, msg, data) => addLog('WARN',  svc, msg, data),
    error: (svc, msg, data) => addLog('ERROR', svc, msg, data),
    clear: () => setLogs([]),
  }), [logs, minLevel, addLog])

  return <LoggerContext.Provider value={value}>{children}</LoggerContext.Provider>
}

export function useLogger() {
  const ctx = useContext(LoggerContext)
  if (!ctx) throw new Error('useLogger must be used inside <LoggerProvider>')
  return ctx
}
