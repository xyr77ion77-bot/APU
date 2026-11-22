'use client'

import { useEffect } from 'react'

/** Registra el service worker en producción (caché de estáticos para la PWA). */
export function PWARegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])
  return null
}
