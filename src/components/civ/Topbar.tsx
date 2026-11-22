'use client'

import { Bell, ChevronDown } from 'lucide-react'
import type { ViewId } from './types'

const LABELS: Record<ViewId, string> = {
  catalogo: 'Catálogo de partidas',
  presupuesto: 'Presupuesto',
  computos: 'Cómputos métricos',
  guardados: 'Guardados',
  recientes: 'Recientes',
  tabuladores: 'Tabuladores',
  configuracion: 'Configuración',
}

export function Topbar({ view, onOpenTabulador }: {
  view: ViewId
  onOpenTabulador: () => void
}) {
  return (
    <header className="topbar">
      <div className="breadcrumbs">
        Proyecto <span className="crumbsep">/</span>
        <strong>{LABELS[view]}</strong>
      </div>
      <div className="top-actions">
        <button className="top-select" onClick={onOpenTabulador} title="Ver tabulador de mano de obra">
          Tabulador CC <ChevronDown size={14} strokeWidth={1.8} />
        </button>
        <button className="square-btn" aria-label="Notificaciones" title="Notificaciones">
          <Bell size={14} strokeWidth={1.8} />
        </button>
        <div className="top-user">
          <div className="avatar">MP</div>
          <span className="user-name">María Pérez</span>
          <ChevronDown size={14} strokeWidth={1.8} />
        </div>
      </div>
    </header>
  )
}
