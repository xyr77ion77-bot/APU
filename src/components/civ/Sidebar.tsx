'use client'

import { LayoutGrid, ShoppingCart, Bookmark, Clock, List, Settings, ChevronDown, MoreHorizontal, Calculator } from 'lucide-react'
import { BrandMark } from './Icons'
import type { ViewId } from './types'

export function Sidebar({ view, onView, itemCount, stats }: {
  view: ViewId
  onView: (v: ViewId) => void
  itemCount: number
  stats: { partidas: number; insumos: number } | null
}) {
  const navTrabajo: { id: ViewId; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'catalogo', label: 'Catálogo de partidas', icon: <LayoutGrid size={17} strokeWidth={1.8} /> },
    { id: 'presupuesto', label: 'Presupuesto', icon: <ShoppingCart size={17} strokeWidth={1.8} />, count: itemCount },
    { id: 'computos', label: 'Cómputos métricos', icon: <Calculator size={17} strokeWidth={1.8} /> },
    { id: 'guardados', label: 'Guardados', icon: <Bookmark size={17} strokeWidth={1.8} /> },
    { id: 'recientes', label: 'Recientes', icon: <Clock size={17} strokeWidth={1.8} /> },
  ]
  const navAdmin: { id: ViewId; label: string; icon: React.ReactNode }[] = [
    { id: 'tabuladores', label: 'Tabuladores', icon: <List size={17} strokeWidth={1.8} /> },
    { id: 'configuracion', label: 'Configuración', icon: <Settings size={17} strokeWidth={1.8} /> },
  ]

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-symbol"><BrandMark /></div>
        <div className="brand-copy">
          <div className="brand-name">CIV</div>
          <div className="brand-sub">INGEFALCA</div>
        </div>
      </div>

      <div className="workspace">
        <div className="workspace-mark">IC</div>
        <div className="workspace-text">
          <strong>Ingefalca · Obras civiles</strong>
          <small>Espacio de trabajo</small>
        </div>
        <ChevronDown size={14} strokeWidth={1.8} />
      </div>

      <div className="nav-label">Trabajo</div>
      <nav className="nav">
        {navTrabajo.map(item => (
          <button
            key={item.id}
            className={`nav-item${view === item.id ? ' active' : ''}`}
            onClick={() => onView(item.id)}
          >
            <span className="nav-ic flex">{item.icon}</span>
            <span className="label">{item.label}</span>
            {item.count ? <span className="count">{item.count}</span> : null}
          </button>
        ))}
      </nav>

      <div className="nav-label" style={{ marginTop: 13 }}>Administración</div>
      <nav className="nav">
        {navAdmin.map(item => (
          <button
            key={item.id}
            className={`nav-item${view === item.id ? ' active' : ''}`}
            onClick={() => onView(item.id)}
          >
            <span className="nav-ic flex">{item.icon}</span>
            <span className="label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="side-spacer" />

      <div className="side-stats">
        <div>
          <div className="stat-label">Partidas</div>
          <div className="stat-value">{stats ? stats.partidas.toLocaleString('es-VE') : '—'}</div>
        </div>
        <div>
          <div className="stat-label">Insumos</div>
          <div className="stat-value">{stats ? stats.insumos.toLocaleString('es-VE') : '—'}</div>
        </div>
      </div>

      <div className="profile">
        <div className="avatar">MP</div>
        <div className="profile-copy">
          <strong>María Pérez</strong>
          <small>Ingeniería · Administradora</small>
        </div>
        <MoreHorizontal size={14} strokeWidth={1.8} />
      </div>
    </aside>
  )
}
