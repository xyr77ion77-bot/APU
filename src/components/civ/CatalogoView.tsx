'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, List, SlidersHorizontal, ChevronDown, ChevronLeft, ChevronRight, Plus, Loader2, Bookmark, ShoppingCart, Columns3, PenLine } from 'lucide-react'
import { formatBs } from '@/lib/calculo'
import { OpenIcon } from './Icons'
import type { PartidaListItem, GuiaInfo, ItemPartida, ViewId } from './types'

const PAGE_SIZE = 50

export function CatalogoView({ guias, onView, onOpenDetail, onAdd, budgetCount, refreshKey }: {
  guias: GuiaInfo[]
  onView: (v: ViewId) => void
  onOpenDetail: (id: number) => void
  onAdd: (item: ItemPartida) => void
  budgetCount: number
  refreshKey?: number // cambiar para forzar recarga del listado (p.ej. tras eliminar una partida)
}) {
  const [q, setQ] = useState('')
  const [guiaId, setGuiaId] = useState<number | null>(null)
  const [ddOpen, setDdOpen] = useState(false)
  const [items, setItems] = useState<PartidaListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  // Filtro "Solo mis partidas": solo las creadas en el editor (S/C o código propio); se recuerda entre sesiones.
  // Arranca false y se sincroniza al montar (el initializer lazy con localStorage da mismatch de hidratación SSR).
  const [soloMis, setSoloMis] = useState(false)
  const [propiasCount, setPropiasCount] = useState<number | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const ddRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try { if (localStorage.getItem('civ_soloMis') === '1') setSoloMis(true) } catch {}
  }, [])

  const cambiarSoloMis = (v: boolean) => {
    setSoloMis(v)
    setOffset(0)
    try { localStorage.setItem('civ_soloMis', v ? '1' : '0') } catch {}
  }

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) setDdOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  // Contador de partidas propias (badge del filtro) — se actualiza también tras eliminar/crear
  useEffect(() => {
    fetch('/api/analisis?soloMisPartidas=1&limit=1')
      .then(r => r.json())
      .then(d => setPropiasCount(d.total ?? 0))
      .catch(() => {})
  }, [refreshKey])

  // Búsqueda con debounce + paginación
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (guiaId) params.set('guiaId', String(guiaId))
      if (soloMis) params.set('soloMisPartidas', '1')
      params.set('limit', String(PAGE_SIZE))
      params.set('offset', String(offset))
      fetch(`/api/analisis?${params}`)
        .then(r => r.json())
        .then(d => {
          setItems(d.items || [])
          setTotal(d.total || 0)
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(t)
  }, [q, guiaId, offset, refreshKey, soloMis])

  // ⌘K / Ctrl+K enfoca la búsqueda
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setQ('')
        setGuiaId(null)
        setOffset(0)
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const desde = total === 0 ? 0 : offset + 1
  const hasta = Math.min(offset + PAGE_SIZE, total)
  const fmt = (n: number) => n.toLocaleString('es-VE')

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Catálogo de partidas</h1>
          <p>Busca partidas, revisa su análisis de precio unitario y agrégalas al presupuesto.</p>
        </div>
        <div className="head-tools">
          <button className="btn outline" onClick={() => onView('guardados')}>
            <Bookmark size={14} strokeWidth={1.8} /> Guardados
          </button>
          <button className="btn" onClick={() => onView('presupuesto')}>
            <ShoppingCart size={14} strokeWidth={1.8} /> Ver presupuesto <span className="filter-count">{budgetCount}</span>
          </button>
        </div>
      </div>

      <div className="summary-strip">
        <span className="summary-pill"><span className="dot" />Tabulador activo <strong>Construcción · ago. 2026</strong></span>
        <span className="summary-pill">Guías <strong>7</strong></span>
        <span className="summary-pill">Moneda <strong>Bs.</strong></span>
        <span className="summary-spacer" />
        <span className="last-update">Actualizado el 9 de noviembre de 2026</span>
      </div>

      <div className="toolbar">
        <label className="searchbox">
          <Search size={14} strokeWidth={1.8} />
          <input
            ref={searchRef}
            type="search"
            placeholder="Buscar por código, descripción o insumo…"
            autoComplete="off"
            value={q}
            onChange={e => { setQ(e.target.value); setOffset(0) }}
          />
          <span className="tiny">⌘ K</span>
        </label>

        <div className="dd-wrap" ref={ddRef}>
          <button className="filter-button" onClick={() => setDdOpen(o => !o)}>
            <List size={14} strokeWidth={1.8} />
            {guiaId ? guias.find(g => g.id === guiaId)?.nombre : 'Todas las guías'}
            <ChevronDown size={14} strokeWidth={1.8} />
          </button>
          {ddOpen && (
            <div className="dd-panel">
              <button
                className={`dd-item${guiaId === null ? ' selected' : ''}`}
                onClick={() => { setGuiaId(null); setOffset(0); setDdOpen(false) }}
              >
                Todas las guías <span className="n">{fmt(guias.reduce((s, g) => s + g.partidas, 0))}</span>
              </button>
              {guias.map(g => (
                <button
                  key={g.id}
                  className={`dd-item${guiaId === g.id ? ' selected' : ''}`}
                  onClick={() => { setGuiaId(g.id); setOffset(0); setDdOpen(false) }}
                >
                  G{g.id} · {g.nombre} <span className="n">{fmt(g.partidas)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          className={`filter-button${soloMis ? ' selected' : ''}`}
          title="Solo las partidas creadas en el editor de APU (S/C o código propio), de más nuevas a más viejas"
          onClick={() => cambiarSoloMis(!soloMis)}
        >
          <PenLine size={14} strokeWidth={1.8} /> Solo mis partidas
          {propiasCount !== null && <span className="filter-count">{fmt(propiasCount)}</span>}
        </button>

        <button className="filter-button" title="Búsqueda por insumo integrada en el buscador">
          <SlidersHorizontal size={14} strokeWidth={1.8} /> Filtros
        </button>

        <div className="view-tools">
          <button className="view-btn selected" aria-label="Vista de tabla" title="Vista de tabla">
            <List size={15} strokeWidth={1.8} />
          </button>
          <button className="view-btn" aria-label="Vista de columnas" title="Vista de columnas">
            <Columns3 size={15} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <div className="table-frame">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 145 }}>CÓDIGO COVENIN</th>
                <th>DESCRIPCIÓN DE PARTIDA</th>
                <th>UNIDAD</th>
                <th style={{ textAlign: 'right' }}>RENDIMIENTO</th>
                <th style={{ textAlign: 'right' }}>COSTO DIRECTO</th>
                <th style={{ textAlign: 'right' }}>PRECIO UNITARIO</th>
                <th style={{ width: 69 }} />
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td><div className="skel" style={{ width: 110 }} /></td>
                    <td><div className="skel" style={{ width: '80%' }} /></td>
                    <td><div className="skel" style={{ width: 40 }} /></td>
                    <td><div className="skel" style={{ width: 50, marginLeft: 'auto' }} /></td>
                    <td><div className="skel" style={{ width: 70, marginLeft: 'auto' }} /></td>
                    <td><div className="skel" style={{ width: 80, marginLeft: 'auto' }} /></td>
                    <td />
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr><td colSpan={7}><div className="empty">
                  {soloMis
                    ? 'Aún no tienes partidas propias. Créalas desde el editor de APU: abre cualquier partida → Editar → Guardar cambios → partida S/C o con código propio.'
                    : 'No se encontraron partidas. Prueba con otro código, término o insumo.'}
                </div></td></tr>
              ) : (
                items.map(p => (
                  <tr key={p.id} onClick={() => onOpenDetail(p.id)}>
                    <td>
                      <span className="code">{p.covenin}</span>
                      <div className="guide-line">G{p.guiaId} · {p.guiaNombre}</div>
                    </td>
                    <td>
                      <div className="desc" title={p.descripcion}>{p.descripcion}</div>
                      <div className="guide-line">
                        Análisis de precio unitario disponible{p.paginaPdf ? ` · pág. ${p.paginaPdf}` : ''}
                      </div>
                    </td>
                    <td><span className="unit-tag">{p.unidad}</span></td>
                    <td className="num" style={{ textAlign: 'right' }}>{formatBs(p.rendimiento, 2)}</td>
                    <td className="price" style={{ textAlign: 'right' }}>Bs. {formatBs(p.costoDirectoUnitarioBs)}</td>
                    <td className="price strong" style={{ textAlign: 'right' }}>Bs. {formatBs(p.precioUnitarioBs)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="row-icon"
                          title="Ver análisis"
                          aria-label="Ver análisis"
                          onClick={e => { e.stopPropagation(); onOpenDetail(p.id) }}
                        >
                          <OpenIcon size={14} />
                        </button>
                        <button
                          className="row-icon"
                          title="Agregar al presupuesto"
                          aria-label="Agregar al presupuesto"
                          onClick={e => {
                            e.stopPropagation()
                            onAdd({
                              partidaAnalisisId: p.id,
                              covenin: p.covenin,
                              descripcion: p.descripcion,
                              unidad: p.unidad,
                              rendimiento: p.rendimiento,
                              precioUnitarioBs: p.precioUnitarioBs,
                              cantidad: 1,
                            })
                          }}
                        >
                          <Plus size={14} strokeWidth={1.8} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="table-foot">
          <span>
            {loading && items.length > 0 ? 'Actualizando…' : `Mostrando ${fmt(desde)}–${fmt(hasta)} de ${fmt(total)} partidas`}
          </span>
          <div className="pagination">
            <span className="page-info">{fmt(desde)}–{fmt(hasta)} de {fmt(total)}</span>
            <button
              className="page-btn"
              aria-label="Página anterior"
              disabled={offset === 0 || loading}
              onClick={() => setOffset(o => Math.max(0, o - PAGE_SIZE))}
            >
              <ChevronLeft size={13} strokeWidth={1.8} />
            </button>
            <button
              className="page-btn"
              aria-label="Página siguiente"
              disabled={hasta >= total || loading}
              onClick={() => setOffset(o => o + PAGE_SIZE)}
            >
              <ChevronRight size={13} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </div>

      {loading && items.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 10, color: '#8995a3', fontSize: 10 }}>
          <Loader2 size={13} className="animate-spin" />
        </div>
      )}
    </>
  )
}
