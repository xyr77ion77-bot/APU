'use client'

import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { calcularDesdeLineas, formatBs, parseDinero, type ParametrosCalculo } from '@/lib/calculo-core'
import type { ItemPartida, LineaSCMaterial, LineaSCEquipo, LineaSCManoObra } from './types'

type Modo = 'composicion' | 'directo'

/**
 * Editor de partidas personalizadas (S/C) para el presupuesto.
 *
 * Dos modos:
 *  - composición: materiales / equipos / mano de obra línea a línea → el PU se
 *    calcula en vivo con la MISMA cadena APU del motor (calculo-core).
 *  - precio directo: PU estipulado SIN IVA (p.ej. servicio global, cotización).
 */
export function SCDialog({ open, onClose, onAdd, parametros, nextCodigo }: {
  open: boolean
  onClose: () => void
  onAdd: (item: ItemPartida) => void
  parametros: ParametrosCalculo
  nextCodigo: string
}) {
  const [codigo, setCodigo] = useState(nextCodigo)
  const [descripcion, setDescripcion] = useState('')
  const [unidad, setUnidad] = useState('global')
  const [rendimiento, setRendimiento] = useState('1')
  const [seccion, setSeccion] = useState('')
  const [modo, setModo] = useState<Modo>('composicion')
  const [precioDirecto, setPrecioDirecto] = useState('')

  const [materiales, setMateriales] = useState<LineaSCMaterial[]>([])
  const [equipos, setEquipos] = useState<LineaSCEquipo[]>([])
  const [manoObra, setManoObra] = useState<LineaSCManoObra[]>([])
  // Borradores de fila (texto crudo; se parsean al guardar, tolerante a coma)
  const [matBorrador, setMatBorrador] = useState({ desc: '', und: '', cant: '', costo: '' })
  const [eqBorrador, setEqBorrador] = useState({ desc: '', cant: '', cop: '', costo: '' })
  const [moBorrador, setMoBorrador] = useState({ cargo: '', cant: '', jornal: '' })

  const reset = () => {
    setCodigo(nextCodigo)
    setDescripcion(''); setUnidad('global'); setRendimiento('1'); setSeccion('')
    setModo('composicion'); setPrecioDirecto('')
    setMateriales([]); setEquipos([]); setManoObra([])
    setMatBorrador({ desc: '', und: '', cant: '', costo: '' })
    setEqBorrador({ desc: '', cant: '', cop: '', costo: '' })
    setMoBorrador({ cargo: '', cant: '', jornal: '' })
  }

  const rendNum = parseDinero(rendimiento) ?? 1

  // PU en vivo con la misma cadena del motor
  const calculo = useMemo(() => {
    if (modo !== 'composicion') return null
    return calcularDesdeLineas(
      {
        rendimiento: rendNum,
        materiales: materiales.map(m => ({ descripcion: m.descripcion, unidad: m.unidad, cantidad: m.cantidad, costoBs: m.costoBs })),
        equipos: equipos.map(e => ({ descripcion: e.descripcion, cantidad: e.cantidad, cop: e.cop, costoBs: e.costoBs })),
        manoObra: manoObra.map(mo => ({ cargo: mo.cargo, cantidad: mo.cantidad, jornalBs: mo.jornalBs })),
      },
      parametros,
    )
  }, [modo, rendNum, materiales, equipos, manoObra, parametros])

  const puDirecto = (parseDinero(precioDirecto) ?? 0) * (1 + parametros.ivaPct / 100)
  const pu = modo === 'composicion' ? (calculo?.precioUnitarioBs ?? 0) : puDirecto
  const puSinIva = modo === 'composicion' ? (calculo?.precioUnitarioSinIvaBs ?? 0) : (parseDinero(precioDirecto) ?? 0)

  const validar = (): string | null => {
    if (!descripcion.trim()) return 'La descripción de la partida es obligatoria.'
    if (modo === 'directo') {
      if ((parseDinero(precioDirecto) ?? 0) <= 0) return 'Indica el precio directo (sin IVA).'
      return null
    }
    const nLineas = materiales.length + equipos.length + manoObra.length
    if (nLineas === 0) return 'Agrega al menos una línea de materiales, equipos o mano de obra (o cambia a precio directo).'
    return null
  }

  const agregar = () => {
    const err = validar()
    if (err) { window.alert(err); return }
    onAdd({
      partidaAnalisisId: null,
      covenin: codigo.trim() || nextCodigo,
      descripcion: descripcion.trim(),
      unidad: unidad.trim() || 'global',
      rendimiento: rendNum,
      precioUnitarioBs: pu,
      cantidad: 1,
      seccion: seccion.trim() || null,
      esPersonalizada: true,
      precioDirectoBs: modo === 'directo' ? puSinIva : null,
      lineas: modo === 'composicion'
        ? { materiales, equipos, manoObra }
        : undefined,
    })
    reset()
    onClose()
  }

  const agregarMat = () => {
    const cant = parseDinero(matBorrador.cant) ?? 0
    const costo = parseDinero(matBorrador.costo) ?? 0
    if (!matBorrador.desc.trim() || cant <= 0) return
    setMateriales([...materiales, { descripcion: matBorrador.desc.trim().toUpperCase(), unidad: matBorrador.und.trim() || null, cantidad: cant, costoBs: costo }])
    setMatBorrador({ desc: '', und: '', cant: '', costo: '' })
  }
  const agregarEq = () => {
    const cant = parseDinero(eqBorrador.cant) ?? 0
    const costo = parseDinero(eqBorrador.costo) ?? 0
    const cop = parseDinero(eqBorrador.cop)
    if (!eqBorrador.desc.trim() || cant <= 0) return
    setEquipos([...equipos, { descripcion: eqBorrador.desc.trim().toUpperCase(), cantidad: cant, cop: cop ?? null, costoBs: costo }])
    setEqBorrador({ desc: '', cant: '', cop: '', costo: '' })
  }
  const agregarMo = () => {
    const cant = parseDinero(moBorrador.cant) ?? 0
    const jornal = parseDinero(moBorrador.jornal) ?? 0
    if (!moBorrador.cargo.trim() || cant <= 0) return
    setManoObra([...manoObra, { cargo: moBorrador.cargo.trim().toUpperCase(), cantidad: cant, jornalBs: jornal }])
    setMoBorrador({ cargo: '', cant: '', jornal: '' })
  }

  if (!open) return null

  return (
    <>
      <div className="overlay show" onClick={onClose} />
      <div className="sc-dialog" role="dialog" aria-label="Partida personalizada S/C">
        <div className="drawer-head" style={{ padding: '16px 20px 12px' }}>
          <div className="drawer-head-top">
            <span className="eyebrow">Partida personalizada</span>
            <button className="close-btn" aria-label="Cerrar editor" onClick={onClose}>
              <X size={14} strokeWidth={1.8} />
            </button>
          </div>
          <h2 style={{ margin: '4px 0 0' }}>Nueva partida S/C</h2>
          <p style={{ fontSize: 10, color: '#768396', margin: '4px 0 0' }}>
            Para partidas que no existen en el catálogo CIV: compón sus insumos o estipula un precio directo.
          </p>
        </div>

        <div className="sc-dialog-body">
          {/* Datos básicos */}
          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 90px 90px', gap: 10 }}>
            <div>
              <label className="field-label">Código</label>
              <input className="field-input" value={codigo} onChange={e => setCodigo(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Descripción *</label>
              <input className="field-input" value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="P.ej. TUBERIA Ø 90&quot; SUMINISTRO Y COLOCACIÓN" />
            </div>
            <div>
              <label className="field-label">Unidad</label>
              <input className="field-input" value={unidad} onChange={e => setUnidad(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Rendimiento</label>
              <input className="field-input" value={rendimiento} onChange={e => setRendimiento(e.target.value)} inputMode="decimal" />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <label className="field-label">Sección del libro (opcional)</label>
            <input className="field-input" value={seccion} onChange={e => setSeccion(e.target.value)} placeholder="P.ej. BULEVAR, OBRAS PREPARATORIAS…" />
          </div>

          {/* Modo */}
          <div className="sc-modo" style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className={`btn ${modo === 'composicion' ? '' : 'outline'}`} onClick={() => setModo('composicion')}>
              Con composición (APU)
            </button>
            <button className={`btn ${modo === 'directo' ? '' : 'outline'}`} onClick={() => setModo('directo')}>
              Precio directo
            </button>
          </div>

          {modo === 'directo' ? (
            <div style={{ marginTop: 14 }}>
              <label className="field-label">Precio unitario estipulado (SIN IVA) *</label>
              <input className="field-input" value={precioDirecto} onChange={e => setPrecioDirecto(e.target.value)} inputMode="decimal" placeholder="P.ej. 2.067,46" />
              <p style={{ fontSize: 9, color: '#99a4b1', margin: '6px 0 0' }}>
                El I.V.A. ({parametros.ivaPct}%) se aplica al igual que en las partidas del catálogo.
              </p>
            </div>
          ) : (
            <>
              {/* MATERIALES */}
              <div className="section-title" style={{ marginTop: 14 }}><strong>1 · Materiales</strong><span>{materiales.length} líneas</span></div>
              {materiales.length > 0 && (
                <table className="apu-table">
                  <thead><tr><th>Descripción</th><th>Und.</th><th style={{ textAlign: 'right' }}>Cantidad</th><th style={{ textAlign: 'right' }}>Costo Bs.</th><th style={{ textAlign: 'right' }}>Total</th><th /></tr></thead>
                  <tbody>
                    {materiales.map((m, i) => (
                      <tr key={i}>
                        <td>{m.descripcion}</td><td>{m.unidad || '—'}</td>
                        <td style={{ textAlign: 'right' }}>{formatBs(m.cantidad, 2)}</td>
                        <td style={{ textAlign: 'right' }}>{formatBs(m.costoBs)}</td>
                        <td style={{ textAlign: 'right' }}>{formatBs(m.cantidad * m.costoBs)}</td>
                        <td><button className="row-icon danger" title="Quitar línea" onClick={() => setMateriales(materiales.filter((_, j) => j !== i))}><X size={12} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="sc-row-add">
                <input className="field-input" placeholder="Descripción del material" value={matBorrador.desc} onChange={e => setMatBorrador({ ...matBorrador, desc: e.target.value })} />
                <input className="field-input" placeholder="Und." style={{ maxWidth: 60 }} value={matBorrador.und} onChange={e => setMatBorrador({ ...matBorrador, und: e.target.value })} />
                <input className="field-input" placeholder="Cant." style={{ maxWidth: 80 }} inputMode="decimal" value={matBorrador.cant} onChange={e => setMatBorrador({ ...matBorrador, cant: e.target.value })} />
                <input className="field-input" placeholder="Costo Bs." style={{ maxWidth: 110 }} inputMode="decimal" value={matBorrador.costo} onChange={e => setMatBorrador({ ...matBorrador, costo: e.target.value })} />
                <button className="btn outline small" onClick={agregarMat} title="Agregar material"><Plus size={13} /></button>
              </div>

              {/* EQUIPOS */}
              <div className="section-title" style={{ marginTop: 12 }}><strong>2 · Equipos</strong><span>{equipos.length} líneas</span></div>
              {equipos.length > 0 && (
                <table className="apu-table">
                  <thead><tr><th>Descripción</th><th style={{ textAlign: 'right' }}>Cantidad</th><th style={{ textAlign: 'right' }}>COP</th><th style={{ textAlign: 'right' }}>Costo Bs.</th><th style={{ textAlign: 'right' }}>Total</th><th /></tr></thead>
                  <tbody>
                    {equipos.map((e, i) => (
                      <tr key={i}>
                        <td>{e.descripcion}</td>
                        <td style={{ textAlign: 'right' }}>{formatBs(e.cantidad, 2)}</td>
                        <td style={{ textAlign: 'right' }}>{e.cop != null ? formatBs(e.cop, 5) : '—'}</td>
                        <td style={{ textAlign: 'right' }}>{formatBs(e.costoBs)}</td>
                        <td style={{ textAlign: 'right' }}>{formatBs(e.cantidad * (e.cop ?? 1) * e.costoBs)}</td>
                        <td><button className="row-icon danger" title="Quitar línea" onClick={() => setEquipos(equipos.filter((_, j) => j !== i))}><X size={12} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="sc-row-add">
                <input className="field-input" placeholder="Descripción del equipo" value={eqBorrador.desc} onChange={e => setEqBorrador({ ...eqBorrador, desc: e.target.value })} />
                <input className="field-input" placeholder="Cant." style={{ maxWidth: 80 }} inputMode="decimal" value={eqBorrador.cant} onChange={e => setEqBorrador({ ...eqBorrador, cant: e.target.value })} />
                <input className="field-input" placeholder="COP" style={{ maxWidth: 80 }} inputMode="decimal" value={eqBorrador.cop} onChange={e => setEqBorrador({ ...eqBorrador, cop: e.target.value })} />
                <input className="field-input" placeholder="Costo Bs." style={{ maxWidth: 110 }} inputMode="decimal" value={eqBorrador.costo} onChange={e => setEqBorrador({ ...eqBorrador, costo: e.target.value })} />
                <button className="btn outline small" onClick={agregarEq} title="Agregar equipo"><Plus size={13} /></button>
              </div>

              {/* MANO DE OBRA */}
              <div className="section-title" style={{ marginTop: 12 }}><strong>3 · Mano de obra</strong><span>{manoObra.length} líneas</span></div>
              {manoObra.length > 0 && (
                <table className="apu-table">
                  <thead><tr><th>Cargo</th><th style={{ textAlign: 'right' }}>Jornadas</th><th style={{ textAlign: 'right' }}>Jornal Bs.</th><th style={{ textAlign: 'right' }}>Total</th><th /></tr></thead>
                  <tbody>
                    {manoObra.map((mo, i) => (
                      <tr key={i}>
                        <td>{mo.cargo}</td>
                        <td style={{ textAlign: 'right' }}>{formatBs(mo.cantidad, 2)}</td>
                        <td style={{ textAlign: 'right' }}>{formatBs(mo.jornalBs)}</td>
                        <td style={{ textAlign: 'right' }}>{formatBs(mo.cantidad * mo.jornalBs)}</td>
                        <td><button className="row-icon danger" title="Quitar línea" onClick={() => setManoObra(manoObra.filter((_, j) => j !== i))}><X size={12} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="sc-row-add">
                <input className="field-input" placeholder="Cargo (p.ej. OBRERO DE 1ra.)" value={moBorrador.cargo} onChange={e => setMoBorrador({ ...moBorrador, cargo: e.target.value })} />
                <input className="field-input" placeholder="Jornadas" style={{ maxWidth: 80 }} inputMode="decimal" value={moBorrador.cant} onChange={e => setMoBorrador({ ...moBorrador, cant: e.target.value })} />
                <input className="field-input" placeholder="Jornal Bs." style={{ maxWidth: 110 }} inputMode="decimal" value={moBorrador.jornal} onChange={e => setMoBorrador({ ...moBorrador, jornal: e.target.value })} />
                <button className="btn outline small" onClick={agregarMo} title="Agregar cargo"><Plus size={13} /></button>
              </div>
            </>
          )}

          {/* Resumen en vivo */}
          <div className="sc-live" style={{ marginTop: 16 }}>
            <div className="calc-row"><span>Costo directo unitario</span><span className="mono">Bs. {formatBs(modo === 'composicion' ? (calculo?.costoDirectoUnitarioBs ?? 0) : puSinIva)}</span></div>
            <div className="calc-row"><span>Sub-total sin I.V.A.</span><span className="mono">Bs. {formatBs(puSinIva)}</span></div>
            <div className="calc-row"><span>I.V.A. ({parametros.ivaPct}%)</span><span className="mono">Bs. {formatBs(pu - puSinIva)}</span></div>
            <div className="calc-row total"><span>Precio unitario (con I.V.A.)</span><span className="mono">Bs. {formatBs(pu)}</span></div>
          </div>
        </div>

        <div className="drawer-foot" style={{ padding: '12px 20px' }}>
          <button className="btn outline" onClick={() => { reset(); onClose() }}>Cancelar</button>
          <button className="btn" onClick={agregar}>Agregar partida S/C</button>
        </div>
      </div>
    </>
  )
}
