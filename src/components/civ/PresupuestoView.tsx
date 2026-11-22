'use client'

import { useState, useMemo } from 'react'
import { Trash2, Save, Download, Loader2, Plus, Settings, ShoppingCart, PackagePlus } from 'lucide-react'
import { formatBs, type ParametrosCalculo } from '@/lib/calculo-core'
import type { ItemPartida, ViewId } from './types'
import { SCDialog } from './SCDialog'

export function PresupuestoView({ items, setItems, parametros, onView, onToast, onSaved }: {
  items: ItemPartida[]
  setItems: (items: ItemPartida[]) => void
  parametros: ParametrosCalculo
  onView: (v: ViewId) => void
  onToast: (msg: string) => void
  onSaved: () => void
}) {
  const [nombre, setNombre] = useState('Nuevo Presupuesto')
  const [cliente, setCliente] = useState('')
  const [obra, setObra] = useState('')
  const [fecha, setFecha] = useState(new Date().toLocaleDateString('es-VE'))
  const [descripcion, setDescripcion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [savedId, setSavedId] = useState<number | null>(null)
  const [scOpen, setScOpen] = useState(false)

  const scCount = items.filter(i => i.esPersonalizada).length
  const nextCodigo = `S/C-${String(scCount + 1).padStart(3, '0')}`

  const addSC = (item: ItemPartida) => {
    setItems([...items, item])
    onToast(`Partida ${item.covenin} agregada · Bs. ${formatBs(item.precioUnitarioBs)} (con I.V.A.)`)
  }

  const remove = (idx: number) => setItems(items.filter((_, i) => i !== idx))

  const updateCantidad = (idx: number, value: number) => {
    const newItems = [...items]
    newItems[idx] = { ...newItems[idx], cantidad: value }
    setItems(newItems)
  }

  // Cálculo en vivo
  const totalizacion = useMemo(() => {
    if (items.length === 0) return null
    const precioSinIvaPct = 1 / (1 + parametros.ivaPct / 100)
    let subtotalSinIva = 0
    let totalIva = 0
    let subtotalCD = 0
    let subtotalAdmin = 0
    let subtotalUtil = 0
    const factorTotal = (1 + parametros.administracionPct / 100) * (1 + parametros.utilidadPct / 100) * (1 + parametros.ivaPct / 100)
    for (const item of items) {
      const total = item.cantidad * item.precioUnitarioBs
      const totalSinIva = total * precioSinIvaPct
      subtotalSinIva += totalSinIva
      totalIva += total - totalSinIva
      const cd = totalSinIva / factorTotal
      const admin = cd * (parametros.administracionPct / 100)
      const util = (cd + admin) * (parametros.utilidadPct / 100)
      subtotalCD += cd
      subtotalAdmin += admin
      subtotalUtil += util
    }
    return {
      subtotalCostoDirectoBs: subtotalCD,
      subtotalAdministracionBs: subtotalAdmin,
      subtotalUtilidadBs: subtotalUtil,
      subtotalSinIvaBs: subtotalSinIva,
      totalIvaBs: totalIva,
      totalConIvaBs: subtotalSinIva + totalIva,
    }
  }, [items, parametros])

  const guardar = async () => {
    if (items.length === 0) { onToast('Añade partidas al presupuesto antes de guardar'); return }
    if (!nombre.trim()) { onToast('Asigna un nombre al presupuesto'); return }
    setGuardando(true)
    try {
      const r = await fetch('/api/presupuestos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre, cliente, obra, fecha, descripcion, parametros,
          items: items.map(i => i.esPersonalizada
            ? {
                codigo: i.covenin,
                descripcion: i.descripcion,
                unidad: i.unidad,
                rendimiento: i.rendimiento,
                cantidad: i.cantidad,
                seccion: i.seccion || undefined,
                precioDirectoBs: i.precioDirectoBs ?? undefined,
                materiales: i.lineas?.materiales.map(m => ({ descripcion: m.descripcion, unidad: m.unidad || undefined, cantidad: m.cantidad, costoBs: m.costoBs })),
                equipos: i.lineas?.equipos.map(e => ({ descripcion: e.descripcion, cantidad: e.cantidad, cop: e.cop ?? undefined, costoBs: e.costoBs })),
                manoObra: i.lineas?.manoObra.map(mo => ({ cargo: mo.cargo, cantidad: mo.cantidad, jornalBs: mo.jornalBs })),
              }
            : {
                partidaAnalisisId: i.partidaAnalisisId,
                cantidad: i.cantidad,
                seccion: i.seccion || undefined,
              }),
        }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Error al guardar')
      setSavedId(data.presupuesto.id)
      onSaved()
      onToast(`Presupuesto #${data.presupuesto.id} guardado · Total Bs. ${formatBs(data.presupuesto.totalConIvaBs)}`)
    } catch (e: any) {
      onToast(`Error al guardar: ${e.message}`)
    } finally {
      setGuardando(false)
    }
  }

  const exportarCSV = async () => {
    if (items.length === 0) return
    setExportando(true)
    try {
      const rows: string[][] = []
      rows.push(['PRESUPUESTO', nombre])
      rows.push(['Cliente', cliente]); rows.push(['Obra', obra]); rows.push(['Fecha', fecha])
      rows.push(['Descripción', descripcion]); rows.push([])
      rows.push(['Parámetros:'])
      rows.push(['F.C.A.S. (%)', String(parametros.fcasPct)])
      rows.push(['C.I.V. (%)', String(parametros.ceduPct)])
      rows.push(['Bono Alimenticio Diario (Bs.)', String(parametros.bonoAlimenticioDiario)])
      rows.push(['Administración (%)', String(parametros.administracionPct)])
      rows.push(['Utilidad (%)', String(parametros.utilidadPct)])
      rows.push(['I.V.A. (%)', String(parametros.ivaPct)])
      rows.push([])
      rows.push(['#', 'COVENIN', 'Descripción', 'Unidad', 'Cantidad', 'Precio Unit. (Bs.)', 'Total (Bs.)'])
      items.forEach((item, i) => {
        rows.push([String(i + 1), item.covenin, item.descripcion, item.unidad, String(item.cantidad), formatBs(item.precioUnitarioBs), formatBs(item.cantidad * item.precioUnitarioBs)])
      })
      rows.push([])
      rows.push(['', '', '', '', '', 'Sub-Total Costo Directo', formatBs(totalizacion?.subtotalCostoDirectoBs ?? 0)])
      rows.push(['', '', '', '', '', 'Administración', formatBs(totalizacion?.subtotalAdministracionBs ?? 0)])
      rows.push(['', '', '', '', '', 'Utilidad', formatBs(totalizacion?.subtotalUtilidadBs ?? 0)])
      rows.push(['', '', '', '', '', 'Sub-Total sin I.V.A.', formatBs(totalizacion?.subtotalSinIvaBs ?? 0)])
      rows.push(['', '', '', '', '', 'I.V.A.', formatBs(totalizacion?.totalIvaBs ?? 0)])
      rows.push(['', '', '', '', '', 'TOTAL CON I.V.A.', formatBs(totalizacion?.totalConIvaBs ?? 0)])

      const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${nombre.replace(/\s+/g, '_')}.csv`
      a.click()
      URL.revokeObjectURL(url)
      onToast(`CSV exportado · ${items.length} partidas`)
    } catch (e: any) {
      onToast(`Error al exportar: ${e.message}`)
    } finally {
      setExportando(false)
    }
  }

  const t = totalizacion

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Presupuesto</h1>
          <p>Construye el presupuesto agregando partidas del catálogo y ajustando sus cantidades.</p>
        </div>
        <div className="head-tools">
          <button className="btn outline" onClick={() => onView('configuracion')} title="Editar parámetros de cálculo">
            <Settings size={14} strokeWidth={1.8} /> Parámetros
          </button>
          <button className="btn outline" onClick={exportarCSV} disabled={items.length === 0 || exportando}>
            {exportando ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} strokeWidth={1.8} />} Exportar CSV
          </button>
          <button className="btn outline" onClick={() => setScOpen(true)} title="Crear una partida que no está en el catálogo">
            <PackagePlus size={14} strokeWidth={1.8} /> Partida S/C
          </button>
          <button className="btn" onClick={guardar} disabled={items.length === 0 || guardando}>
            {guardando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} strokeWidth={1.8} />} Guardar presupuesto
          </button>
        </div>
      </div>

      {/* Datos del presupuesto */}
      <div className="panel-card" style={{ marginBottom: 14 }}>
        <div className="panel-title">Datos del presupuesto <span>{savedId ? `Guardado #${savedId}` : 'Borrador'}</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <label className="field-label">Nombre *</label>
            <input className="field-input" value={nombre} onChange={e => setNombre(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Cliente</label>
            <input className="field-input" value={cliente} onChange={e => setCliente(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Obra</label>
            <input className="field-input" value={obra} onChange={e => setObra(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Fecha</label>
            <input className="field-input" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="field-label">Descripción</label>
            <input className="field-input" value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Notas generales del presupuesto…" />
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="table-frame" style={{ marginBottom: 14 }}>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th style={{ width: 135 }}>COVENIN</th>
                <th>DESCRIPCIÓN</th>
                <th>UND.</th>
                <th style={{ textAlign: 'right' }}>CANTIDAD</th>
                <th style={{ textAlign: 'right' }}>PRECIO UNIT.</th>
                <th style={{ textAlign: 'right' }}>TOTAL</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty">
                      <Plus size={22} strokeWidth={1.8} style={{ margin: '0 auto 8px', opacity: .5 }} />
                      <div>Aún no has agregado partidas al presupuesto.</div>
                      <div style={{ marginTop: 10 }}>
                        <button className="btn" onClick={() => onView('catalogo')}>
                          <ShoppingCart size={14} strokeWidth={1.8} /> Ir al catálogo
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item, i) => (
                  <tr key={`${item.partidaAnalisisId ?? 'sc'}-${i}`}>
                    <td className="num">{i + 1}</td>
                    <td><span className="code">{item.covenin}</span></td>
                    <td>
                      <div className="desc" style={{ maxWidth: 380, display: 'flex', alignItems: 'center', gap: 6 }} title={item.descripcion}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.descripcion}</span>
                        {item.esPersonalizada && (
                          <span className="sc-badge" title="Partida personalizada (sin APU del catálogo)">S/C</span>
                        )}
                        {item.seccion && (
                          <span className="seccion-chip" title={`Sección: ${item.seccion}`}>{item.seccion}</span>
                        )}
                      </div>
                    </td>
                    <td><span className="unit-tag">{item.unidad}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        className="input-num"
                        type="number"
                        value={item.cantidad}
                        onChange={e => updateCantidad(i, parseFloat(e.target.value) || 0)}
                        step="0.01"
                        min="0"
                      />
                    </td>
                    <td className="price" style={{ textAlign: 'right' }}>Bs. {formatBs(item.precioUnitarioBs)}</td>
                    <td className="price strong" style={{ textAlign: 'right' }}>Bs. {formatBs(item.cantidad * item.precioUnitarioBs)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="row-icon danger" title="Quitar del presupuesto" onClick={() => remove(i)}>
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
          <span>{items.length} partidas · Parámetros: F.C.A.S. {parametros.fcasPct}% · Admin {parametros.administracionPct}% · Utilidad {parametros.utilidadPct}% · IVA {parametros.ivaPct}%</span>
          <span className="page-info">Bono alimenticio Bs. {formatBs(parametros.bonoAlimenticioDiario)}/jornada</span>
        </div>
      </div>

      {/* Resumen de totales */}
      {t && (
        <>
          <div className="section-title"><strong>Resumen del presupuesto</strong><span>Cálculo en vivo</span></div>
          <div className="calc-card">
            <div className="calc-row"><span>Sub-total costo directo</span><span className="mono">Bs. {formatBs(t.subtotalCostoDirectoBs)}</span></div>
            <div className="calc-row"><span>Administración ({parametros.administracionPct}%)</span><span className="mono">Bs. {formatBs(t.subtotalAdministracionBs)}</span></div>
            <div className="calc-row"><span>Utilidad ({parametros.utilidadPct}%)</span><span className="mono">Bs. {formatBs(t.subtotalUtilidadBs)}</span></div>
            <div className="calc-row emph"><span>Sub-total sin I.V.A.</span><span className="mono">Bs. {formatBs(t.subtotalSinIvaBs)}</span></div>
            <div className="calc-row"><span>I.V.A. ({parametros.ivaPct}%)</span><span className="mono">Bs. {formatBs(t.totalIvaBs)}</span></div>
            <div className="calc-row total"><span>Total con I.V.A.</span><span className="mono">Bs. {formatBs(t.totalConIvaBs)}</span></div>
          </div>
        </>
      )}

      {savedId && (
        <div className="summary-strip" style={{ marginTop: 14 }}>
          <span className="summary-pill"><span className="dot" />Presupuesto #{savedId} guardado <strong>· Revisa la sección Guardados</strong></span>
          <button className="btn subtle small" onClick={() => setSavedId(null)}>Cerrar aviso</button>
        </div>
      )}

      <SCDialog
        open={scOpen}
        onClose={() => setScOpen(false)}
        onAdd={addSC}
        parametros={parametros}
        nextCodigo={nextCodigo}
      />
    </>
  )
}
