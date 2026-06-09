import { useState, useEffect, useCallback } from 'react'
import * as api from '../services/api'

/**
 * Hook para historial de fondos personalizados (últimos 3) via MongoDB.
 * Reemplaza la versión IndexedDB.
 */
export function useBgHistory() {
  const [recent, setRecent] = useState([])

  useEffect(() => {
    api.getBgHistory()
      .then(data => { if (data.ok) setRecent(data.items || []) })
      .catch(() => {})
  }, [])

  /**
   * Agregar fondo al historial.
   * @param {File} file — archivo de imagen seleccionado por el usuario
   */
  const addBg = useCallback(async (file) => {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload  = e => resolve(e.target.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    // Actualización optimista: mostrar inmediatamente en la UI
    const optimistic = {
      _id:     `local_${Date.now()}`,
      name:    file.name,
      date:    new Date().toISOString(),
      dataUrl,
    }
    setRecent(prev => [optimistic, ...prev.filter(i => i.name !== file.name)].slice(0, 3))

    // Persistir en servidor (sin bloquear la UI)
    api.addBgHistory(file.name, dataUrl)
      .then(data => {
        if (data.ok) {
          // Reemplazar el id optimista por el real de Mongo
          setRecent(prev => prev.map(i =>
            i._id === optimistic._id ? { ...i, _id: data.id } : i
          ))
        }
      })
      .catch(() => {})
  }, [])

  return { recent, addBg }
}
