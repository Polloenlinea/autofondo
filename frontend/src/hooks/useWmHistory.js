import { useState, useEffect, useCallback } from 'react'
import * as api from '../services/api'

/**
 * Hook para historial de logos (marca de agua), últimos 3, via MongoDB.
 * Reemplaza la versión IndexedDB.
 */
export function useWmHistory() {
  const [recent, setRecent] = useState([])

  useEffect(() => {
    api.getWmHistory()
      .then(data => { if (data.ok) setRecent(data.items || []) })
      .catch(() => {})
  }, [])

  /**
   * Agregar logo al historial.
   * @param {File}   file    — archivo de imagen del logo
   * @param {string} dataUrl — dataUrl ya generada (para no leer el File dos veces)
   */
  const addWm = useCallback(async (file, dataUrl) => {
    // Actualización optimista
    const optimistic = {
      _id:     `local_${Date.now()}`,
      name:    file.name,
      date:    new Date().toISOString(),
      dataUrl,
    }
    setRecent(prev => [optimistic, ...prev.filter(i => i.name !== file.name)].slice(0, 3))

    // Persistir en servidor (sin bloquear la UI)
    api.addWmHistory(file.name, dataUrl)
      .then(data => {
        if (data.ok) {
          setRecent(prev => prev.map(i =>
            i._id === optimistic._id ? { ...i, _id: data.id } : i
          ))
        }
      })
      .catch(() => {})
  }, [])

  return { recent, addWm }
}
