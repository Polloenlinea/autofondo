import { useState, useCallback } from 'react'
import { detectType, removeBg, adjustImage } from '../services/api'

export const DEFAULT_ADJUSTMENTS = { brightness: 1, contrast: 1, rotation: 0 }

const uid = () => Math.random().toString(36).slice(2, 9)

/**
 * Estado de cada imagen:
 * { id, file, previewUrl,
 *   detectedType: 'exterior'|'interior'|'detecting',
 *   detectedConfidence: 0-1,
 *   typeOverride: null | 'exterior' | 'interior',   ← el usuario puede cambiar
 *   status: 'pending'|'processing'|'done'|'error'|'skipped',
 *   cutoutB64: string|null,
 *   composedB64: string|null,
 *   error: string|null }
 */
// Formatos soportados por el backend (sharp + @imgly)
const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
const ALLOWED_EXT  = new Set(['.jpg', '.jpeg', '.png', '.webp'])

function isSupported(file) {
  if (ALLOWED_MIME.has(file.type)) return true
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  return ALLOWED_EXT.has(ext)
}

export function useImages() {
  const [images,   setImages]   = useState([])
  const [rejected, setRejected] = useState([]) // nombres de archivos rechazados

  const update = useCallback((id, patch) =>
    setImages(prev => prev.map(img => img.id === id ? { ...img, ...patch } : img))
  , [])

  // ── Agregar archivos y arrancar detección ─────────────────────────────────
  const addFiles = useCallback(async (files) => {
    const all = Array.from(files)
    const bad = all.filter(f => !isSupported(f))
    const ok  = all.filter(f =>  isSupported(f))

    if (bad.length) {
      setRejected(bad.map(f => f.name))
      setTimeout(() => setRejected([]), 6000) // limpiar aviso después de 6s
    }
    if (!ok.length) return

    const newImgs = ok
      .map(f => ({
        id: uid(), file: f,
        previewUrl: URL.createObjectURL(f),
        detectedType: 'detecting', detectedConfidence: 0,
        typeOverride: null,
        status: 'pending',
        cutoutB64: null, composedB64: null, error: null,
        adjustments: { ...DEFAULT_ADJUSTMENTS },
        plateApplied: false,
      }))

    setImages(prev => [...prev, ...newImgs])

    // Detección automática de cada imagen (paralela, rápida)
    await Promise.all(newImgs.map(async img => {
      try {
        const res = await detectType(img.file)
        setImages(prev => prev.map(i => i.id === img.id ? {
          ...i,
          detectedType: res.type ?? 'exterior',
          detectedConfidence: res.confidence ?? 0.5,
        } : i))
      } catch {
        setImages(prev => prev.map(i => i.id === img.id ? {
          ...i, detectedType: 'exterior', detectedConfidence: 0.5,
        } : i))
      }
    }))
  }, [])

  // ── Cambiar tipo manualmente ──────────────────────────────────────────────
  const toggleType = useCallback((id) => {
    setImages(prev => prev.map(img => {
      if (img.id !== id) return img
      const current = img.typeOverride ?? img.detectedType
      return { ...img, typeOverride: current === 'exterior' ? 'interior' : 'exterior' }
    }))
  }, [])

  // ── Resolver tipo efectivo ────────────────────────────────────────────────
  const effectiveType = (img) => img.typeOverride ?? img.detectedType

  // ── Procesar (quitar fondo a todas las exteriores pendientes) ─────────────
  // plateOptions: { hidePlate: bool, plateLogoFile: File|null }
  const processAll = useCallback(async (stopRef, plateOptions = {}) => {
    const needsPlate = !!plateOptions.hidePlate
    const targets = images.filter(img =>
      effectiveType(img) === 'exterior' &&
      (img.status === 'pending' || img.status === 'error' ||
        // Re-procesar imágenes 'done' si se activó la matrícula y no la tienen aplicada
        (img.status === 'done' && needsPlate && !img.plateApplied))
    )

    // Las interiores se marcan como skipped
    setImages(prev => prev.map(img =>
      effectiveType(img) === 'interior' && img.status === 'pending'
        ? { ...img, status: 'skipped' }
        : img
    ))

    for (const img of targets) {
      if (stopRef?.current) break
      update(img.id, { status: 'processing', error: null })
      try {
        const res = await removeBg(img.file, plateOptions)
        if (!res.ok) throw new Error(res.error || 'Error del servidor')
        update(img.id, { status: 'done', cutoutB64: res.image, plateApplied: needsPlate })
      } catch (e) {
        update(img.id, { status: 'error', error: e.message })
      }
    }
  }, [images, update])

  // ── Aplicar ajustes a imagen recortada ───────────────────────────────────
  const applyAdjustments = useCallback(async (id, adj) => {
    const img = images.find(i => i.id === id)
    if (!img) return

    // Si viene _maskB64, es un canvas editado manualmente → usarlo directamente
    if (adj._maskB64) {
      const { _maskB64, ...cleanAdj } = adj
      // Si hay ajustes además de la máscara, aplicarlos sobre el nuevo PNG
      const hasAdj = cleanAdj.brightness !== 1 || cleanAdj.contrast !== 1 || cleanAdj.rotation !== 0
      if (hasAdj) {
        update(id, { status: 'processing' })
        try {
          const res = await adjustImage(_maskB64, cleanAdj)
          if (!res.ok) throw new Error(res.error)
          update(id, { cutoutB64: res.image, adjustments: cleanAdj, composedB64: null, status: 'done' })
        } catch (e) {
          update(id, { status: 'done', error: e.message })
        }
      } else {
        update(id, { cutoutB64: _maskB64, composedB64: null, status: 'done' })
      }
      return
    }

    if (!img.cutoutB64) return
    update(id, { status: 'processing' })
    try {
      const res = await adjustImage(img.cutoutB64, adj)
      if (!res.ok) throw new Error(res.error)
      update(id, { cutoutB64: res.image, adjustments: adj, composedB64: null, status: 'done' })
    } catch (e) {
      update(id, { status: 'done', error: e.message })
    }
  }, [images, update])

  // ── Re-procesar una imagen — acepta { model: 'large' } para alta calidad ──
  const reprocess = useCallback(async (id, options = {}) => {
    const img = images.find(i => i.id === id)
    if (!img) return
    update(id, { status: 'processing', cutoutB64: null, composedB64: null, error: null })
    try {
      const res = await removeBg(img.file, options)
      if (!res.ok) throw new Error(res.error || 'Error del servidor')
      update(id, { status: 'done', cutoutB64: res.image })
    } catch (e) {
      update(id, { status: 'error', error: e.message })
    }
  }, [images, update])

  const removeImage = useCallback((id) =>
    setImages(prev => prev.filter(img => img.id !== id))
  , [])

  const clearAll = useCallback(() => setImages([]), [])

  const setComposed = useCallback((id, b64) => update(id, { composedB64: b64 }), [update])

  return {
    images, rejected, addFiles, toggleType, effectiveType,
    processAll, reprocess, applyAdjustments,
    removeImage, clearAll, setComposed,
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
