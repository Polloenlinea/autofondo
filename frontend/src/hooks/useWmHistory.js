import { useState, useEffect } from 'react'
import { dbGetAll, dbPut, dbDelete } from '../utils/db'

const MAX = 3

export function useWmHistory() {
  const [recent, setRecent] = useState([])

  useEffect(() => {
    dbGetAll('wm_history').then(all => {
      setRecent(all.sort((a,b) => b.date - a.date).slice(0, MAX))
    }).catch(() => {})
  }, [])

  const addWm = async (file, dataUrl) => {
    const item = { id: Date.now().toString(), name: file.name, date: Date.now(), dataUrl }
    await dbPut('wm_history', item)
    setRecent(prev => {
      const next = [item, ...prev.filter(i => i.name !== file.name)].slice(0, MAX)
      prev.filter(i => i.name !== file.name).slice(MAX - 1).forEach(old => dbDelete('wm_history', old.id).catch(()=>{}))
      return next
    })
  }

  return { recent, addWm }
}
