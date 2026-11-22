'use client'

// Marca del sidebar (símbolo del mockup: A enmarcado con barra)
export function BrandMark({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 18.5 12 4l8 14.5M7.2 13h9.6M9.2 16.5h5.6" />
    </svg>
  )
}

// Icono de recursivo para las filas del catálogo (open in new)
export function OpenIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 4h6v6m-.5-5.5L11 13" />
      <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
    </svg>
  )
}
