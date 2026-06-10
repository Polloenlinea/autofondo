import { useState, useEffect, useCallback } from 'react'
import * as api from '../services/api'

export function useWmHistory() {
  const [recent, setRecent] = useState([])

  useEffect(() => {
    api.getWmHistory()
      .then(data => { if (data.ok) setRecent(data.items || []) })
      .catch(() => {})
  }, [])

  const addWm = useCallback(async (file, dataUrl) => {
    const optimistic = { _id: `local_${Date.now()}`, name: file.name, date: new Date().toISOString(), dataUrl }
    setRecent(prev => [optimistic, ...prev.filter(i => i.name !== file.name)].slice(0, 3))
    api.addWmHistory(file.name, dataUrl)
      .then(data => {
        if (data.ok) setRecent(prev => prev.map(i => i._id === optimistic._id ? { ...i, _id: data.id } : i))
      })
      .catch(() => {})
  }, [])

  const deleteWm = useCallback(async (id) => {
    setRecent(prev => prev.filter(i => i._id !== id))
    api.deleteWmHistory(id).catch(() => {})
  }, [])

  return { recent, addWm, deleteWm }
}
