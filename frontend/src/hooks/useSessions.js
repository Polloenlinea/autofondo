import { useState, useEffect, useCallback } from 'react'
import * as api from '../services/api'

/**
 * Hook para gestionar sesiones guardadas via MongoDB (API).
 * Reemplaza la versión IndexedDB.
 */
export function useSessions() {
  const [sessions, setSessions]   = useState([])
  const [loading,  setLoading]    = useState(false)

  // Cargar listado al montar (sin imágenes, solo metadata)
  useEffect(() => {
    setLoading(true)
    api.getSessions()
      .then(data => { if (data.ok) setSessions(data.sessions || []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  /**
   * Guardar sesión.
   * @param {string} name  — nombre de la sesión
   * @param {Array}  images — array de objetos con { file, composedB64, cutoutB64 }
   * @returns {string|null} id de la sesión creada
   */
  const saveSession = useCallback(async (name, images) => {
    const processedImages = (images || []).filter(i => i.composedB64 || i.cutoutB64)
    if (!processedImages.length) return null

    const payload = processedImages.map(img => ({
      fileName:    img.file?.name || 'imagen.jpg',
      composedB64: img.composedB64 || null,
      cutoutB64:   img.cutoutB64   || null,
    }))

    const data = await api.saveSession(name, payload)
    if (!data.ok) throw new Error(data.error || 'Error al guardar sesión')

    // Actualizar listado local (metadata sin imágenes)
    const sessionMeta = {
      _id:       data.id,
      name:      name?.trim() || `Sesión ${new Date().toLocaleDateString('es-AR')}`,
      date:      new Date().toISOString(),
      count:     processedImages.length,
      thumbnail: processedImages[0]?.composedB64 || processedImages[0]?.cutoutB64 || null,
    }
    setSessions(prev => [sessionMeta, ...prev])
    return data.id
  }, [])

  /**
   * Eliminar sesión por id.
   */
  const deleteSession = useCallback(async (id) => {
    const data = await api.deleteSession(id)
    if (!data.ok) throw new Error(data.error || 'Error al eliminar sesión')
    setSessions(prev => prev.filter(s => s._id !== id))
  }, [])

  /**
   * Obtener una sesión completa (con imágenes) por id.
   */
  const loadSession = useCallback(async (id) => {
    const data = await api.getSession(id)
    if (!data.ok) throw new Error(data.error || 'Sesión no encontrada')
    return data.session
  }, [])

  return { sessions, loading, saveSession, deleteSession, loadSession }
}
