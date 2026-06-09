import { useState, useEffect } from 'react'
import { dbGetAll, dbPut, dbDelete } from '../utils/db'

const MAX = 3

export function useBgHistory() {
  const [recent, setRecent] = useState([])

  useEffect(() => {
    dbGetAll('bg_history').then(all => {
      setRecent(all.sort((a,b) => b.date - a.date).slice(0, MAX))
    }).catch(() => {})
  }, [])

  const addBg = async (file) => {
    // Read file as dataUrl
    const dataUrl = await new Promise(res => {
      const r = new FileReader()
      r.onload = e => res(e.target.result)
      r.readAsDataURL(file)
    })
    const item = { id: Date.now().toString(), name: file.name, date: Date.now(), dataUrl }
    await dbPut('bg_history', item)
    setRecent(prev => {
      const next = [item, ...prev.filter(i => i.name !== file.name)].slice(0, MAX)
      // clean up old entries beyond MAX
      prev.filter(i => i.name !== file.name).slice(MAX - 1).forEach(old => dbDelete('bg_history', old.id).catch(()=>{}))
      return next
    })
  }

  return { recent, addBg }
}
