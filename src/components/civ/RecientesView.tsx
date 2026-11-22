'use client'

import { useState, useEffect } from 'react'
import { Plus, Clock, Trash2 } from 'lucide-react'
import { formatBs } from '@/lib/calculo'
import { OpenIcon } from './Icons'
import type { RecienteItem, ItemPartida } from './types'

const KEY = 'civ-recientes'

export function leerRecientes(): RecienteItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export function guardarReciente(item: RecienteItem) {
  try {
    const arr = leerRecientes().filter(x => x.id !== item.id)
    localStorage.setItem(KEY, JSON.stringify([item, ...arr].slice(0, 20)))
  } catch { /* storage no disponible */ }
}

export function RecientesView({ onOpenDetail, onAdd, onToast }: {
  onOpenDetail: (id: number) => void
  onAdd: (item: ItemPartida) => void
  onToast: (msg: string) => void
}) {
  const [items, setItems] = useState<RecienteItem[]>([])

  useEffect(() => { setItems(leerRecientes()) }, [])

  const limpiar = () => {
    localStorage.removeItem(KEY)
    setItems([])
    onToast('Historial de recientes limpiado')
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Recientes</h1>
          <p>Las últimas partidas que abriste en este navegador, para revisarlas de nuevo sin buscarlas.</p>
        </div>
        <div className="head-tools">
          {items.length > 0 && (
            <button className="btn outline" onClick={limpiar}>
              <Trash2 size={14} strokeWidth={1.8} /> Limpiar historial
            </button>
          )}
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
                <th style={{ textAlign: 'right' }}>COSTO DIRECTO</th>
                <th style={{ textAlign: 'right' }}>PRECIO UNITARIO</th>
                <th style={{ width: 69 }} />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty">
                      <Clock size={22} strokeWidth={1.8} style={{ margin: '0 auto 8px', opacity: .5 }} />
                      <div>Aún no hay partidas recientes. Abre una partida del catálogo y aparecerá aquí.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map(r => (
                  <tr key={r.id} onClick={() => onOpenDetail(r.id)}>
                    <td>
                      <span className="code">{r.covenin}</span>
                      <div className="guide-line">{r.guiaNombre}</div>
                    </td>
                    <td>
                      <div className="desc" style={{ maxWidth: 400 }} title={r.descripcion}>{r.descripcion}</div>
                      <div className="guide-line">Visto {new Date(r.ts).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}</div>
                    </td>
                    <td><span className="unit-tag">{r.unidad}</span></td>
                    <td className="price" style={{ textAlign: 'right' }}>Bs. {formatBs(r.costoDirectoUnitarioBs)}</td>
                    <td className="price strong" style={{ textAlign: 'right' }}>Bs. {formatBs(r.precioUnitarioBs)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="row-icon" title="Ver análisis" onClick={e => { e.stopPropagation(); onOpenDetail(r.id) }}>
                          <OpenIcon size={14} />
                        </button>
                        <button
                          className="row-icon"
                          title="Agregar al presupuesto"
                          onClick={e => {
                            e.stopPropagation()
                            onAdd({
                              partidaAnalisisId: r.id,
                              covenin: r.covenin,
                              descripcion: r.descripcion,
                              unidad: r.unidad,
                              rendimiento: r.rendimiento,
                              precioUnitarioBs: r.precioUnitarioBs,
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
          <span>{items.length} partidas recientes (máx. 20)</span>
          <span className="page-info">Historial local</span>
        </div>
      </div>
    </>
  )
}
