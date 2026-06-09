const DB_NAME = 'autofondo_v1'
const DB_VER  = 2
let _db = null

export async function getDB() {
  if (_db) return _db
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('sessions'))   db.createObjectStore('sessions',   { keyPath: 'id' })
      if (!db.objectStoreNames.contains('bg_history')) db.createObjectStore('bg_history', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('wm_history')) db.createObjectStore('wm_history', { keyPath: 'id' })
    }
    req.onsuccess = e => { _db = e.target.result; resolve(_db) }
    req.onerror   = e => reject(e.target.error)
  })
}

export const dbGetAll = (store) => getDB().then(db => new Promise((res, rej) => {
  const r = db.transaction(store,'readonly').objectStore(store).getAll()
  r.onsuccess = e => res(e.target.result)
  r.onerror   = e => rej(e.target.error)
}))

export const dbPut = (store, value) => getDB().then(db => new Promise((res, rej) => {
  const r = db.transaction(store,'readwrite').objectStore(store).put(value)
  r.onsuccess = e => res(e.target.result)
  r.onerror   = e => rej(e.target.error)
}))

export const dbDelete = (store, id) => getDB().then(db => new Promise((res, rej) => {
  const r = db.transaction(store,'readwrite').objectStore(store).delete(id)
  r.onsuccess = e => res(e.target.result)
  r.onerror   = e => rej(e.target.error)
}))
