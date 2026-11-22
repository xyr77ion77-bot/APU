'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import { Trash2, RefreshCw, Loader2, X, FileSpreadsheet, Copy } from 'lucide-react'
import { formatBs } from '@/lib/calculo-core'
import { OpenIcon } from './Icons'
import type { PresupuestoListItem, PresupuestoDetalle } from './types'

export function GuardadosView({ onToast, refreshKey }: {
  onToast: (msg: string) => void
  refreshKey: number
}) {
  const [items, setItems] = useState<PresupuestoListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [detalle, setDetalle] = useState<PresupuestoDetalle | null>(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/presupuestos')
      const data = await r.json()
      setItems(data.items || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar, refreshKey])

  const ver = async (id: number) => {
    setLoadingDetalle(true)
    try {
      const r = await fetch(`/api/presupuestos/${id}`)
      const data = await r.json()
      setDetalle(data)
    } catch (e) { console.error(e) }
    finally { setLoadingDetalle(false) }
  }

  const borrar = async (id: number, nombre: string) => {
    if (!confirm(`¿Eliminar el presupuesto "${nombre}"?`)) return
    try {
      const r = await fetch(`/api/presupuestos/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Error al eliminar')
      onToast(`Presupuesto "${nombre}" eliminado`)
      cargar()
    } catch (e: any) {
      onToast(`Error: ${e.message}`)
    }
  }

  const duplicar = async (id: number, nombre: string) => {
    try {
      const r = await fetch(`/api/presupuestos/${id}/duplicar`, { method: 'POST' })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Error al duplicar')
      onToast(`${nombre} duplicado · nuevo #${data.presupuesto.id}`)
      cargar()
    } catch (e: any) {
      onToast(`Error: ${e.message}`)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Guardados</h1>
          <p>Presupuestos guardados en la base de datos, con sus totales y parámetros congelados al momento del guardado.</p>
        </div>
        <div className="head-tools">
          <button className="btn outline" onClick={cargar} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} strokeWidth={1.8} />} Actualizar
          </button>
        </div>
      </div>

      <div className="summary-strip">
        <span className="summary-pill"><span className="dot" />{items.length} presupuestos</span>
        <span className="summary-pill">Total acumulado <strong>Bs. {formatBs(items.reduce((s, p) => s + p.totalConIvaBs, 0))}</strong></span>
        <span className="summary-spacer" />
        <span className="last-update">Los presupuestos conservan los precios con que fueron calculados</span>
      </div>

      <div className="table-frame">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 45 }}>#</th>
                <th>NOMBRE</th>
                <th>CLIENTE</th>
                <th className="hide-mid">OBRA</th>
                <th>FECHA</th>
                <th style={{ textAlign: 'right' }}>PARTIDAS</th>
                <th style={{ textAlign: 'right' }}>TOTAL CON I.V.A.</th>
                <th style={{ width: 69 }} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td><div className="skel" style={{ width: 25 }} /></td>
                    <td><div className="skel" style={{ width: '55%' }} /></td>
                    <td><div className="skel" style={{ width: '40%' }} /></td>
                    <td className="hide-mid"><div className="skel" style={{ width: '40%' }} /></td>
                    <td><div className="skel" style={{ width: 60 }} /></td>
                    <td><div className="skel" style={{ width: 30, marginLeft: 'auto' }} /></td>
                    <td><div className="skel" style={{ width: 90, marginLeft: 'auto' }} /></td>
                    <td />
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr><td colSpan={8}><div className="empty">Aún no hay presupuestos guardados. Construye uno en la sección Presupuesto.</div></td></tr>
              ) : (
                items.map(p => (
                  <tr key={p.id} onClick={() => ver(p.id)}>
                    <td className="num">{p.id}</td>
                    <td>
                      <div className="desc" style={{ maxWidth: 300 }} title={p.nombre}>{p.nombre}</div>
                      <div className="guide-line">{p.obra || 'Sin obra asociada'}</div>
                    </td>
                    <td>{p.cliente || '—'}</td>
                    <td className="hide-mid">{p.obra || '—'}</td>
                    <td className="num">{p.fecha || '—'}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{p.itemCount}</td>
                    <td className="price strong" style={{ textAlign: 'right' }}>Bs. {formatBs(p.totalConIvaBs)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="row-icon" title="Ver detalle" onClick={e => { e.stopPropagation(); ver(p.id) }}>
                          <OpenIcon size={14} />
                        </button>
                        <button className="row-icon" title="Duplicar" onClick={e => { e.stopPropagation(); duplicar(p.id, p.nombre) }}>
                          <Copy size={14} strokeWidth={1.8} />
                        </button>
                        <button className="row-icon danger" title="Eliminar" onClick={e => { e.stopPropagation(); borrar(p.id, p.nombre) }}>
                          <Trash2 size={14} strokeWidth={1.8} />
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
          <span>Mostrando {items.length} de {items.length} presupuestos</span>
          <span className="page-info">Guardados</span>
        </div>
      </div>

      {/* Dialog de detalle (Radix, estilizado neutro) */}
      {detalle && (
        <DetalleDialog detalle={detalle} loading={loadingDetalle} onClose={() => setDetalle(null)} onToast={onToast} />
      )}
    </>
  )
}

async function descargarExcel(id: number, nombre: string, onToast: (m: string) => void) {
  try {
    onToast('Generando libro Excel (formato UPTBAL)…')
    const r = await fetch(`/api/presupuestos/${id}/export`)
    if (!r.ok) {
      const data = await r.json().catch(() => ({}))
      throw new Error(data.detalle || data.error || `HTTP ${r.status}`)
    }
    const blob = await r.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Presupuesto_${id}_${nombre.replace(/[^\w]+/g, '_').slice(0, 40)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    onToast(`Excel exportado · Presupuesto #${id}`)
  } catch (e: any) {
    onToast(`Error al exportar Excel: ${e.message}`)
  }
}

function DetalleDialog({ detalle, loading, onClose, onToast }: {
  detalle: PresupuestoDetalle
  loading: boolean
  onClose: () => void
  onToast: (m: string) => void
}) {
  const p = detalle.presupuesto
  const t = detalle.totalizacion
  const params = p.parametros
  const [exportando, setExportando] = useState(false)

  const exportar = async () => {
    setExportando(true)
    await descargarExcel(p.id, p.nombre, onToast)
    setExportando(false)
  }

  return (
    <>
      <div className="overlay show" onClick={onClose} />
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 50, display: 'grid', placeItems: 'center', padding: 20,
          background: 'transparent', pointerEvents: 'none',
        }}
      >
        <div
          className="panel-card"
          style={{
            pointerEvents: 'auto', width: 'min(880px, 94vw)', maxHeight: '88vh', overflow: 'auto',
            boxShadow: '0 18px 48px rgba(19,39,65,.18)', padding: 0,
          }}
        >
          <div className="drawer-head" style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
            <div className="drawer-head-top">
              <span className="eyebrow">Presupuesto #{p.id}</span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button className="btn outline" style={{ height: 28 }} onClick={exportar} disabled={exportando} title="Descargar libro Excel formato UPTBAL (Índice + APUs + Cómputos + Tabulador + Verificación)">
                  {exportando ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} strokeWidth={1.8} />} Exportar Excel
                </button>
                <button className="close-btn" aria-label="Cerrar" onClick={onClose}><X size={14} strokeWidth={1.8} /></button>
              </div>
            </div>
            <h2 style={{ margin: '0 0 9px' }}>{p.nombre}</h2>
            <div className="drawer-meta">
              {p.cliente && <span className="meta-chip">Cliente: {p.cliente}</span>}
              {p.obra && <span className="meta-chip">Obra: {p.obra}</span>}
              {p.fecha && <span className="meta-chip">Fecha: {p.fecha}</span>}
              {p.descripcion && <span className="meta-chip">{p.descripcion}</span>}
            </div>
          </div>

          {loading ? (
            <div className="empty"><Loader2 size={16} className="animate-spin" style={{ margin: '0 auto' }} /></div>
          ) : (
            <div style={{ padding: '17px 21px 21px' }}>
              <div className="section-title"><strong>Items</strong><span>{detalle.items.length} partidas</span></div>
              <div className="table-frame" style={{ marginBottom: 16 }}>
                <div className="table-scroll">
                  <table className="data-table" style={{ minWidth: 680 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 36 }}>#</th>
                        <th style={{ width: 130 }}>COVENIN</th>
                        <th>DESCRIPCIÓN</th>
                        <th>UND.</th>
                        <th style={{ textAlign: 'right' }}>CANT.</th>
                        <th style={{ textAlign: 'right' }}>PRECIO UNIT.</th>
                        <th style={{ textAlign: 'right' }}>TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalle.items.map((item, i) => (
                        <Fragment key={item.id}>
                          <tr>
                            <td className="num">{item.posicion + 1}</td>
                            <td>
                              <span className="code">{item.covenin}</span>
                              {item.esPersonalizada && <span className="sc-badge" style={{ marginLeft: 5 }}>S/C</span>}
                            </td>
                            <td>
                              <div className="desc" style={{ maxWidth: 320, whiteSpace: 'normal', display: 'flex', alignItems: 'center', gap: 6 }} title={item.descripcion}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.descripcion}</span>
                                {item.seccion && <span className="seccion-chip">{item.seccion}</span>}
                              </div>
                              {item.notas && <div className="guide-line">{item.notas}</div>}
                            </td>
                            <td><span className="unit-tag">{item.unidad}</span></td>
                            <td className="num" style={{ textAlign: 'right' }}>{formatBs(item.cantidad, 2)}</td>
                            <td className="price" style={{ textAlign: 'right' }}>Bs. {formatBs(item.precioUnitarioBs)}</td>
                            <td className="price strong" style={{ textAlign: 'right' }}>Bs. {formatBs(item.totalBs)}</td>
                          </tr>
                          {item.esPersonalizada && (
                            <tr style={{ background: '#fffdf5' }}>
                              <td />
                              <td colSpan={6} style={{ padding: '8px 12px' }}>
                                {item.composicion && (item.composicion.materiales.length + item.composicion.equipos.length + item.composicion.manoObra.length) > 0 ? (
                                  <details>
                                    <summary style={{ cursor: 'pointer', fontSize: 10, fontWeight: 700, color: '#7a5b00' }}>
                                      Composición de la partida S/C ({item.composicion.materiales.length} mat · {item.composicion.equipos.length} eq · {item.composicion.manoObra.length} MO)
                                    </summary>
                                    <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                                      {item.composicion.materiales.length > 0 && (
                                        <table className="apu-table">
                                          <thead><tr><th>MATERIAL</th><th>UND.</th><th style={{ textAlign: 'right' }}>CANT.</th><th style={{ textAlign: 'right' }}>COSTO Bs.</th><th style={{ textAlign: 'right' }}>TOTAL</th></tr></thead>
                                          <tbody>
                                            {item.composicion.materiales.map((m, j) => (
                                              <tr key={j}>
                                                <td>{m.descripcion}</td><td>{m.unidad || '—'}</td>
                                                <td style={{ textAlign: 'right' }}>{formatBs(m.cantidad, 2)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatBs(m.costoBs)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatBs(m.cantidad * m.costoBs)}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      )}
                                      {item.composicion.equipos.length > 0 && (
                                        <table className="apu-table">
                                          <thead><tr><th>EQUIPO</th><th style={{ textAlign: 'right' }}>CANT.</th><th style={{ textAlign: 'right' }}>COP</th><th style={{ textAlign: 'right' }}>COSTO Bs.</th><th style={{ textAlign: 'right' }}>TOTAL</th></tr></thead>
                                          <tbody>
                                            {item.composicion.equipos.map((e, j) => (
                                              <tr key={j}>
                                                <td>{e.descripcion}</td>
                                                <td style={{ textAlign: 'right' }}>{formatBs(e.cantidad, 2)}</td>
                                                <td style={{ textAlign: 'right' }}>{e.cop != null ? formatBs(e.cop, 5) : '—'}</td>
                                                <td style={{ textAlign: 'right' }}>{formatBs(e.costoBs)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatBs(e.cantidad * (e.cop ?? 1) * e.costoBs)}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      )}
                                      {item.composicion.manoObra.length > 0 && (
                                        <table className="apu-table">
                                          <thead><tr><th>CARGO</th><th style={{ textAlign: 'right' }}>JORNADAS</th><th style={{ textAlign: 'right' }}>JORNAL Bs.</th><th style={{ textAlign: 'right' }}>TOTAL</th></tr></thead>
                                          <tbody>
                                            {item.composicion.manoObra.map((mo, j) => (
                                              <tr key={j}>
                                                <td>{mo.cargo}</td>
                                                <td style={{ textAlign: 'right' }}>{formatBs(mo.cantidad, 2)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatBs(mo.jornalBs)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatBs(mo.cantidad * mo.jornalBs)}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      )}
                                    </div>
                                  </details>
                                ) : (
                                  <span style={{ fontSize: 10, color: '#7a5b00', fontWeight: 600 }}>
                                    Precio directo estipulado (sin I.V.A.): Bs. {formatBs(item.precioDirectoBs ?? item.precioUnitarioBs / (1 + params.ivaPct / 100))}
                                  </span>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                <div>
                  <div className="section-title"><strong>Parámetros aplicados</strong></div>
                  <div className="calc-card">
                    <div className="calc-row"><span>F.C.A.S.</span><span className="mono">{params.fcasPct}%</span></div>
                    <div className="calc-row"><span>C.I.V.</span><span className="mono">{params.ceduPct}%</span></div>
                    <div className="calc-row"><span>Bono alimenticio diario</span><span className="mono">Bs. {formatBs(params.bonoAlimenticioDiario)}</span></div>
                    <div className="calc-row"><span>Administración</span><span className="mono">{params.administracionPct}%</span></div>
                    <div className="calc-row"><span>Utilidad</span><span className="mono">{params.utilidadPct}%</span></div>
                    <div className="calc-row"><span>I.V.A.</span><span className="mono">{params.ivaPct}%</span></div>
                  </div>
                </div>
                <div>
                  <div className="section-title"><strong>Totalización</strong></div>
                  <div className="calc-card">
                    <div className="calc-row"><span>Costo directo</span><span className="mono">Bs. {formatBs(t.subtotalCostoDirectoBs)}</span></div>
                    <div className="calc-row"><span>Administración</span><span className="mono">Bs. {formatBs(t.subtotalAdministracionBs)}</span></div>
                    <div className="calc-row"><span>Utilidad</span><span className="mono">Bs. {formatBs(t.subtotalUtilidadBs)}</span></div>
                    <div className="calc-row emph"><span>Sub-total sin I.V.A.</span><span className="mono">Bs. {formatBs(t.subtotalSinIvaBs)}</span></div>
                    <div className="calc-row"><span>I.V.A.</span><span className="mono">Bs. {formatBs(t.totalIvaBs)}</span></div>
                    <div className="calc-row total"><span>Total con I.V.A.</span><span className="mono">Bs. {formatBs(t.totalConIvaBs)}</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
