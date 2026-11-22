import type { MetadataRoute } from 'next'

/**
 * Webmanifest para instalar la app como PWA (Android/Chrome/Edge: "Añadir a
 * la pantalla de inicio"; PC: icono en el escritorio con ventana propia).
 * Next sirve esta ruta en /manifest.webmanifest y añade el <link> al <head>.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CIV Ingefalca — APU y Presupuestos',
    short_name: 'CIV',
    description: 'Motor de Análisis de Precios Unitarios y Presupuestos del CIV · 7.594 partidas · Tabulador CC vigente',
    lang: 'es',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0f2a4a',
    theme_color: '#0f2a4a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
