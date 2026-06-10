import { useState, useEffect, useCallback } from 'react'
import * as api from '../services/api'

export function useBgHistory() {
  const [recent, setRecent] = useState([])

  useEffect(() => {
    api.getBgHistory()
      .then(data => { if (data.ok) setRecent(data.items || []) })
      .catch(() => {})
  }, [])

  const addBg = useCallback(async (file) => {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload  = e => resolve(e.target.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    const optimistic = { _id: `local_${Date.now()}`, name: file.name, date: new Date().toISOString(), dataUrl }
    setRecent(prev => [optimistic, ...prev.filter(i => i.name !== file.name)].slice(0, 3))
    api.addBgHistory(file.name, dataUrl)
      .then(data => {
        if (data.ok) setRecent(prev => prev.map(i => i._id === optimistic._id ? { ...i, _id: data.id } : i))
      })
      .catch(() => {})
  }, [])

  const deleteBg = useCallback(async (id) => {
    setRecent(prev => prev.filter(i => i._id !== id))
    api.deleteBgHistory(id).catch(() => {})
  }, [])

  return { recent, addBg, deleteBg }
}
