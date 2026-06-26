import { useState, useCallback } from 'react'
import { removeBg, adjustImage, composeImage } from '../services/api'
import { detectBlobs } from '../utils/blobDetect'

export const DEFAULT_ADJUSTMENTS = { brightness: 1, contrast: 1, rotation: 0 }

const uid = () => Math.random().toString(36).slice(2, 9)

const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
const ALLOWED_EXT  = new Set(['.jpg', '.jpeg', '.png', '.webp'])

function isSupported(file) {
  if (ALLOWED_MIME.has(file.type)) return true
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  return ALLOWED_EXT.has(ext)
}

export function useImages() {
  const [images,   setImages]   = useState([])
  const [rejected, setRejected] = useState([])

  const update = useCallback((id, patch) =>
    setImages(prev => prev.map(img => img.id === id ? { ...img, ...patch } : img))
  , [])

  const addFiles = useCallback(async (files) => {
    const all = Array.from(files)
    const bad = all.filter(f => !isSupported(f))
    const ok  = all.filter(f =>  isSupported(f))

    if (bad.length) {
      setRejected(bad.map(f => f.name))
      setTimeout(() => setRejected([]), 6000)
    }
    if (!ok.length) return

    const newImgs = ok.map(f => ({
      id: uid(), file: f,
      previewUrl: URL.createObjectURL(f),
      detectedType: 'exterior',
      detectedConfidence: 1,
      typeOverride: null,
      status: 'pending',
      cutoutB64: null, composedB64: null, bgSettings: null,
      error: null,
      adjustments: { ...DEFAULT_ADJUSTMENTS },
      plateApplied: false,
    }))

    setImages(prev => [...prev, ...newImgs])
  }, [])

  const toggleType = useCallback((id) => {
    setImages(prev => prev.map(img => {
      if (img.id !== id) return img
      const current = img.typeOverride ?? img.detectedType
      return { ...img, typeOverride: current === 'exterior' ? 'interior' : 'exterior' }
    }))
  }, [])

  const effectiveType = (img) => img.typeOverride ?? img.detectedType

  const processAll = useCallback(async (stopRef, plateOptions = {}) => {
    const needsPlate = !!plateOptions.hidePlate
    const targets = images.filter(img =>
      effectiveType(img) === 'exterior' &&
      (img.status === 'pending' || img.status === 'error' ||
        (img.status === 'done' && needsPlate && !img.plateApplied))
    )

    setImages(prev => prev.map(img =>
      effectiveType(img) === 'interior' && img.status === 'pending'
        ? { ...img, status: 'skipped' }
        : img
    ))

    for (const img of targets) {
      if (stopRef?.current) break
      update(img.id, { status: 'processing', error: null })
      // Reintento automático: si el backend se reinicia (OneDrive evict / hiccup),
      // la petición falla ("Failed to fetch" / JSON cortado). Reintentamos con espera
      // para darle tiempo a volver, en vez de dejar la foto en error.
      let lastErr = null, ok = false
      for (let attempt = 1; attempt <= 3 && !ok && !stopRef?.current; attempt++) {
        try {
          const res = await removeBg(img.file, plateOptions)
          if (!res.ok) throw new Error(res.error || 'Error del servidor')
          const blobs = await detectBlobs(res.image)
          update(img.id, { status: 'done', cutoutB64: res.image, plateApplied: needsPlate, blobs, level: res.level !== false, offset: res.offset ?? { dx: 0, dy: 0 } })
          ok = true
        } catch (e) {
          lastErr = e
          if (attempt < 3) {
            update(img.id, { status: 'processing', error: `Reintentando ${attempt}/2…` })
            await new Promise(r => setTimeout(r, attempt * 2500)) // 2,5s y 5s
          }
        }
      }
      if (!ok && !stopRef?.current) update(img.id, { status: 'error', error: lastErr?.message || 'Error' })
    }
  }, [images, update])

  // Returns new cutoutB64 or null (so callers can chain recompose)
  const applyAdjustments = useCallback(async (id, adj) => {
    const img = images.find(i => i.id === id)
    if (!img) return null

    if (adj._maskB64) {
      const { _maskB64, ...cleanAdj } = adj
      const hasAdj = cleanAdj.brightness !== 1 || cleanAdj.contrast !== 1 || cleanAdj.rotation !== 0
      if (hasAdj) {
        update(id, { status: 'processing' })
        try {
          const res = await adjustImage(_maskB64, cleanAdj)
          if (!res.ok) throw new Error(res.error)
          update(id, { cutoutB64: res.image, adjustments: cleanAdj, composedB64: null, status: 'done' })
          return res.image
        } catch (e) {
          update(id, { status: 'done', error: e.message })
          return null
        }
      } else {
        update(id, { cutoutB64: _maskB64, composedB64: null, status: 'done' })
        return _maskB64
      }
    }

    if (!img.cutoutB64) return null
    update(id, { status: 'processing' })
    try {
      const res = await adjustImage(img.cutoutB64, adj)
      if (!res.ok) throw new Error(res.error)
      update(id, { cutoutB64: res.image, adjustments: adj, composedB64: null, status: 'done' })
      return res.image
    } catch (e) {
      update(id, { status: 'done', error: e.message })
      return null
    }
  }, [images, update])

  const reprocess = useCallback(async (id, options = {}) => {
    const img = images.find(i => i.id === id)
    if (!img) return
    update(id, { status: 'processing', cutoutB64: null, composedB64: null, error: null })
    try {
      const res = await removeBg(img.file, options)
      if (!res.ok) throw new Error(res.error || 'Error del servidor')
      const blobs = await detectBlobs(res.image)
      update(id, { status: 'done', cutoutB64: res.image, blobs, level: res.level !== false, offset: res.offset ?? { dx: 0, dy: 0 } })
    } catch (e) {
      update(id, { status: 'error', error: e.message })
    }
  }, [images, update])

  // Re-compone una imagen con nuevas bgSettings. cutoutB64Override permite pasar
  // un cutout recién generado sin esperar que el estado de React se propague.
  const recomposeOne = useCallback(async (id, bgConfig, cutoutB64Override = null) => {
    const img = images.find(i => i.id === id)
    const cutoutB64 = cutoutB64Override ?? img?.cutoutB64
    if (!cutoutB64) return
    update(id, { status: 'processing' })
    try {
      const res = await composeImage({ cutoutB64, ...bgConfig })
      if (res.ok) {
        update(id, { composedB64: res.image, bgSettings: bgConfig, status: 'done' })
      } else {
        update(id, { status: 'done' })
      }
    } catch {
      update(id, { status: 'done' })
    }
  }, [images, update])

  const applyBlobSelection = useCallback((id, newB64) => {
    update(id, { cutoutB64: newB64, blobs: [], composedB64: null })
  }, [update])

  const removeImage  = useCallback((id) => setImages(prev => prev.filter(img => img.id !== id)), [])
  const clearAll     = useCallback(() => setImages([]), [])

  // Retomar un borrador: reconstruye el estado de trabajo desde una sesión guardada.
  // No hay foto original (no se guarda por peso) → se marca `restored` y el preview
  // usa el recorte. Suficiente para seguir con fondos / editar máscara / exportar.
  const loadImages = useCallback((sessionImages) => {
    if (!Array.isArray(sessionImages)) return
    const restored = sessionImages
      .filter(s => s.cutoutB64 || s.composedB64)
      .map(s => ({
        id: uid(),
        file: { name: s.fileName || 'imagen.jpg' },   // stub (sin la foto original)
        previewUrl: s.cutoutB64 ? `data:image/png;base64,${s.cutoutB64}` : null,
        detectedType: s.detectedType || 'exterior',
        detectedConfidence: 1,
        typeOverride: s.typeOverride ?? null,
        status: 'done',
        cutoutB64: s.cutoutB64 || null,
        composedB64: s.composedB64 || null,
        bgSettings: s.bgSettings ?? null,
        level: s.level !== false,
        // El preview es el recorte (ya alineado) → "Restaurar" usa offset 0
        offset: { dx: 0, dy: 0 },
        blobs: [],
        error: null,
        adjustments: s.adjustments ?? { ...DEFAULT_ADJUSTMENTS },
        plateApplied: true,
        restored: true,
      }))
    setImages(restored)
  }, [])

  // Guarda bgSettings y composedB64 juntos (llamado desde StepBackground)
  const setComposed = useCallback((id, b64, bgCfg = null) =>
    update(id, bgCfg ? { composedB64: b64, bgSettings: bgCfg } : { composedB64: b64 })
  , [update])

  // Limpia composedB64 en todas las imágenes (al volver de Background a Review)
  const clearComposed = useCallback(() =>
    setImages(prev => prev.map(img => ({ ...img, composedB64: null })))
  , [])

  // Reinicia el procesamiento al volver de Review a Upload
  const resetProcessing = useCallback(() =>
    setImages(prev => prev.map(img => ({
      ...img,
      status: 'pending',
      cutoutB64: null,
      composedB64: null,
      bgSettings: null,
      plateApplied: false,
      blobs: [],
      error: null,
    })))
  , [])

  return {
    images, rejected, addFiles, toggleType, effectiveType,
    processAll, reprocess, applyAdjustments, applyBlobSelection,
    removeImage, clearAll, loadImages, setComposed, clearComposed, resetProcessing, recomposeOne,
    stats: {
      total:      images.length,
      exterior:   images.filter(i => effectiveType(i) === 'exterior').length,
      interior:   images.filter(i => effectiveType(i) === 'interior').length,
      pending:    images.filter(i => i.status === 'pending').length,
      processing: images.filter(i => i.status === 'processing').length,
      done:       images.filter(i => i.status === 'done').length,
      error:      images.filter(i => i.status === 'error').length,
    }
  }
}
