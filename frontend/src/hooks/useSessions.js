import { useState, useEffect } from 'react'
import { dbGetAll, dbPut, dbDelete } from '../utils/db'

export function useSessions() {
  const [sessions, setSessions] = useState([])

  useEffect(() => {
    dbGetAll('sessions').then(all => {
      setSessions(all.sort((a,b) => b.date - a.date))
    }).catch(() => {})
  }, [])

  const saveSession = async (name, images) => {
    const processedImages = images.filter(i => i.composedB64 || i.cutoutB64)
    const thumb = processedImages[0]?.composedB64 || processedImages[0]?.cutoutB64 || null
    const session = {
      id:     Date.now().toString(),
      name:   name?.trim() || `Sesión ${new Date().toLocaleDateString('es-AR')}`,
      date:   Date.now(),
      count:  processedImages.length,
      thumbnail: thumb,
      images: processedImages.map(img => ({
        fileName:    img.file.name,
        composedB64: img.composedB64 || null,
        cutoutB64:   img.cutoutB64   || null,
        isComposed:  !!img.composedB64,
      }))
    }
    await dbPut('sessions', session)
    setSessions(prev => [session, ...prev])
    return session.id
  }

  const deleteSession = async (id) => {
    await dbDelete('sessions', id)
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  return { sessions, saveSession, deleteSession }
}
