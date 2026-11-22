'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  X, Download, Plus, Check, Loader2, Pencil, Trash2, Save, FilePlus2, Hash, RotateCcw,
} from 'lucide-react'
import { calcularDesdeLineas, formatBs } from '@/lib/calculo'
import type {
  PartidaDetalle, ItemPartida, ApuEditState, PayloadGuardarApu,
} from './types'

type TabId = 'analisis' | 'especificaciones' | 'historial'
type Destino = null | 'sobrescribir' | 'sc' | 'codigo'

/** "1.234,56" o "1234.56" → 1234.56 (0 si no parsea) */
function parseNum(v: string): number {
  const n = Number((v || '').trim().replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/** número → texto editable con coma decimal */
function numATexto(n: number): string {
  if (!Number.isFinite(n)) return ''
  return String(n).replace('.', ',')
}

function tablaSeccion(
  titulo: string,
  headers: string[],
  filas: React.ReactNode[][],
  nota?: string
) {
  return (
    <>
      <div className="section-title">
        <strong>{titulo}</strong>
        <span>{filas.length} conceptos</span>
      </div>
      {filas.length === 0 ? (
        <p style={{ fontSize: 9, color: '#99a4b1', margin: '0 0 15px' }}>
          {nota || 'Sin conceptos en esta partida.'}
        </p>
      ) : (
        <table className="apu-table">
          <thead>
            <tr>{headers.map(h => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i}>{f.map((c, j) => <td key={j}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

export function APUDrawer({ open, detail, loading, onClose, onExport, onAdd, onGuardado, onEliminado }: {
  open: boolean
  detail: PartidaDetalle | null
  loading: boolean
  onClose: () => void
  onExport: (id: number, covenin: string) => void
  onAdd: (item: ItemPartida) => void
  onGuardado?: (id: number, mensaje: string) => void
  onEliminado?: (mensaje: string) => void
}) {
  const [tab, setTab] = useState<TabId>('analisis')
  const [edit, setEdit] = useState<ApuEditState | null>(null)
  const [destino, setDestino] = useState<Destino>(null)
  const [coveninNuevo, setCoveninNuevo] = useState('')
  const [colision, setColision] = useState<{ existe: boolean; descripcion: string | null } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const p = detail?.partida
  const c = p?.calculo
  const params = p?.parametros
  const enEdicion = !!edit

  // ---------- Recalculo en vivo mientras se edita ----------
  const calc = useMemo(() => {
    if (!edit) return p?.calculo ?? null
    const mat = edit.materiales
      .filter(m => m.descripcion.trim())
      .map(m => ({ descripcion: m.descripcion.trim(), unidad: m.unidad.trim() || null, cantidad: parseNum(m.cantidad), costoBs: parseNum(m.costoBs) }))
    const eq = edit.equipos
      .filter(e => e.descripcion.trim())
      .map(e => ({ descripcion: e.descripcion.trim(), cantidad: parseNum(e.cantidad), cop: parseNum(e.cop) || null, costoBs: parseNum(e.costoBs) }))
    const mo = edit.manoObra
      .filter(m => m.cargo.trim())
      .map(m => ({ cargo: m.cargo.trim(), cantidad: parseNum(m.cantidad), jornalBs: parseNum(m.jornalBs) }))
    const prm = {
      fcasPct: parseNum(edit.parametros.fcasPct),
      ceduPct: parseNum(edit.parametros.ceduPct),
      bonoAlimenticioDiario: parseNum(edit.parametros.bonoAlimenticioDiario),
      administracionPct: parseNum(edit.parametros.administracionPct),
      utilidadPct: parseNum(edit.parametros.utilidadPct),
      ivaPct: parseNum(edit.parametros.ivaPct),
    }
    return calcularDesdeLineas(
      { rendimiento: parseNum(edit.rendimiento) || 1, materiales: mat, equipos: eq, manoObra: mo },
      prm,
    )
  }, [edit, p])

  const agregar = () => {
    if (!p || !calc) return
    onAdd({
      partidaAnalisisId: p.id,
      covenin: p.covenin,
      descripcion: p.descripcion,
      unidad: p.unidad,
      rendimiento: p.rendimiento,
      precioUnitarioBs: calc.precioUnitarioBs,
      cantidad: 1,
    })
  }

  // ---------- Edición ----------
  const iniciarEdicion = () => {
    if (!p || !params) return
    setEdit({
      descripcion: p.descripcion,
      unidad: p.unidad,
      rendimiento: numATexto(p.rendimiento),
      materiales: p.materiales.map(m => ({
        descripcion: m.descripcion,
        unidad: m.unidad || '',
        cantidad: numATexto(m.cantidad),
        costoBs: numATexto(m.costoBs),
      })),
      equipos: p.equipos.map(e => ({
        descripcion: e.descripcion,
        cantidad: numATexto(e.cantidad),
        cop: e.cop != null ? numATexto(e.cop) : '',
        costoBs: numATexto(e.costoBs),
      })),
      manoObra: p.manoObra.map(mo => ({
        cargo: mo.cargo,
        cantidad: numATexto(mo.cantidad),
        jornalBs: numATexto(mo.jornalBs),
      })),
      parametros: {
        fcasPct: numATexto(params.fcasPct),
        ceduPct: numATexto(params.ceduPct),
        bonoAlimenticioDiario: numATexto(params.bonoAlimenticioDiario),
        administracionPct: numATexto(params.administracionPct),
        utilidadPct: numATexto(params.utilidadPct),
        ivaPct: numATexto(params.ivaPct),
      },
    })
    setTab('analisis')
    setError(null)
  }

  const cancelarEdicion = () => {
    if (destino) { setDestino(null); return }
    setEdit(null)
    setError(null)
  }

  const abrirDialogoGuardado = async () => {
    if (!p) return
    setError(null)
    setDestino('sobrescribir')
    // precargar la sugerencia de código S/C por si elige esa vía
    try {
      const r = await fetch('/api/analisis?sugerirSc=1')
      const d = await r.json()
      setCoveninNuevo(d.covenin || '')
      setColision(null)
    } catch { setCoveninNuevo('') }
  }

  // validación de código en vivo (debounce 350ms) para S/C o código propio
  useEffect(() => {
    if (destino !== 'sc' && destino !== 'codigo') { setColision(null); return }
    const code = coveninNuevo.trim()
    if (!code) { setColision(null); return }
    const t = setTimeout(async () => {
      try {
        // al crear una partida nueva el código debe chocar con TODAS las existentes,
        // incluida la que se está editando (por eso sin excluirId)
        const r = await fetch(`/api/analisis?existeCovenin=${encodeURIComponent(code)}`)
        const d = await r.json()
        setColision({ existe: !!d.existe, descripcion: d.descripcion ?? null })
      } catch { setColision(null) }
    }, 350)
    return () => clearTimeout(t)
  }, [coveninNuevo, destino, p?.id])

  const construirPayload = (): PayloadGuardarApu | null => {
    if (!edit) return null
    return {
      descripcion: edit.descripcion.trim(),
      unidad: edit.unidad.trim(),
      rendimiento: parseNum(edit.rendimiento),
      parametros: {
        fcasPct: parseNum(edit.parametros.fcasPct),
        ceduPct: parseNum(edit.parametros.ceduPct),
        bonoAlimenticioDiario: parseNum(edit.parametros.bonoAlimenticioDiario),
        administracionPct: parseNum(edit.parametros.administracionPct),
        utilidadPct: parseNum(edit.parametros.utilidadPct),
        ivaPct: parseNum(edit.parametros.ivaPct),
      },
      materiales: edit.materiales
        .filter(m => m.descripcion.trim())
        .map(m => ({ descripcion: m.descripcion.trim(), unidad: m.unidad.trim() || null, cantidad: parseNum(m.cantidad), costoBs: parseNum(m.costoBs) })),
      equipos: edit.equipos
        .filter(e => e.descripcion.trim())
        .map(e => ({ descripcion: e.descripcion.trim(), cantidad: parseNum(e.cantidad), cop: parseNum(e.cop) || null, costoBs: parseNum(e.costoBs) })),
      manoObra: edit.manoObra
        .filter(m => m.cargo.trim())
        .map(m => ({ cargo: m.cargo.trim(), cantidad: parseNum(m.cantidad), jornalBs: parseNum(m.jornalBs) })),
    }
  }

  const guardar = async () => {
    if (!p || !edit || guardando) return
    const payload = construirPayload()
    if (!payload) return
    if (destino !== 'sobrescribir' && !coveninNuevo.trim()) {
      setError('Escribe el código de la nueva partida.')
      return
    }
    if (colision?.existe) {
      setError(`El código ${coveninNuevo.trim()} ya existe en el catálogo. Elige otro.`)
      return
    }
    setGuardando(true)
    setError(null)
    try {
      let idFinal = p.id
      let mensaje = ''
      if (destino === 'sobrescribir') {
        const r = await fetch(`/api/analisis/${p.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'No se pudo sobrescribir el APU')
        mensaje = d.mensaje || `APU ${p.covenin} actualizado`
      } else {
        const r = await fetch('/api/analisis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion: 'crear', covenin: coveninNuevo.trim(), guiaId: p.guiaId, ...payload }),
        })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'No se pudo crear la partida')
        idFinal = d.id
        mensaje = d.mensaje || `Nueva partida ${d.covenin} creada`
      }
      setDestino(null)
      setEdit(null)
      onGuardado?.(idFinal, mensaje)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  const confirmarEliminar = async () => {
    if (!p || borrando) return
    setBorrando(true)
    setError(null)
    try {
      const r = await fetch(`/api/analisis/${p.id}`, { method: 'DELETE' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'No se pudo eliminar la partida')
      setConfirmarBorrar(false)
      onEliminado?.(d.mensaje || `Partida ${p.covenin} eliminada`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBorrando(false)
    }
  }

  // ---------- helpers de edición por sección ----------
  const updMat = (i: number, k: keyof ApuEditState['materiales'][number], v: string) => {
    setEdit(s => s && { ...s, materiales: s.materiales.map((m, j) => j === i ? { ...m, [k]: v } : m) })
  }
  const updEq = (i: number, k: keyof ApuEditState['equipos'][number], v: string) => {
    setEdit(s => s && { ...s, equipos: s.equipos.map((m, j) => j === i ? { ...m, [k]: v } : m) })
  }
  const updMo = (i: number, k: keyof ApuEditState['manoObra'][number], v: string) => {
    setEdit(s => s && { ...s, manoObra: s.manoObra.map((m, j) => j === i ? { ...m, [k]: v } : m) })
  }
  const delMat = (i: number) => setEdit(s => s && { ...s, materiales: s.materiales.filter((_, j) => j !== i) })
  const delEq = (i: number) => setEdit(s => s && { ...s, equipos: s.equipos.filter((_, j) => j !== i) })
  const delMo = (i: number) => setEdit(s => s && { ...s, manoObra: s.manoObra.filter((_, j) => j !== i) })
  const addMat = () => setEdit(s => s && { ...s, materiales: [...s.materiales, { descripcion: '', unidad: '', cantidad: '1', costoBs: '' }] })
  const addEq = () => setEdit(s => s && { ...s, equipos: [...s.equipos, { descripcion: '', cantidad: '1', cop: '', costoBs: '' }] })
  const addMo = () => setEdit(s => s && { ...s, manoObra: [...s.manoObra, { cargo: '', cantidad: '1', jornalBs: '' }] })
  const updParam = (k: keyof ApuEditState['parametros'], v: string) => {
    setEdit(s => s && { ...s, parametros: { ...s.parametros, [k]: v } })
  }

  const codoSeleccionado = destino === 'sc' || destino === 'codigo'
  const codigoInvalido = codoSeleccionado && (!coveninNuevo.trim() || colision?.existe)

  return (
    <>
      <div className={`overlay${open ? ' show' : ''}`} onClick={onClose} />
      <aside className={`drawer${open ? ' open' : ''}`} aria-label="Detalle de partida">
        <div className="drawer-head">
          <div className="drawer-head-top">
            <span className="eyebrow">{enEdicion ? 'Análisis de precio unitario · edición' : 'Análisis de precio unitario'}</span>
            <button className="close-btn" aria-label="Cerrar panel" onClick={enEdicion ? cancelarEdicion : onClose}>
              <X size={14} strokeWidth={1.8} />
            </button>
          </div>

          {loading && (
            <div style={{ display: 'grid', gap: 10, padding: '8px 0' }}>
              <div className="skel" style={{ width: '40%' }} />
              <div className="skel" style={{ width: '90%', height: 18 }} />
              <div className="skel" style={{ width: '60%' }} />
            </div>
          )}

          {!loading && p && c && !enEdicion && (
            <>
              <div>
                <span className="drawer-code">{p.covenin}</span>
                <span className="status-badge">Vigente</span>
              </div>
              <h2>{p.descripcion}</h2>
              <div className="drawer-meta">
                <span className="meta-chip">{p.guiaNombre || `Guía ${p.guiaId}`}</span>
                <span className="meta-chip">Unidad: {p.unidad}</span>
                <span className="meta-chip">Rendimiento: {formatBs(p.rendimiento, 2)}</span>
                {p.paginaPdf ? <span className="meta-chip">Pág. PDF: {p.paginaPdf}</span> : null}
              </div>
            </>
          )}

          {!loading && p && enEdicion && edit && (
            <>
              <div>
                <span className="drawer-code">{p.covenin}</span>
                <span className="status-badge" style={{ background: '#fff7e6', color: '#8a5b00' }}>Editando</span>
              </div>
              <input
                className="apu-edit-input"
                style={{ height: 34, fontSize: 12, fontWeight: 650, marginTop: 6 }}
                value={edit.descripcion}
                aria-label="Descripción de la partida"
                onChange={e => setEdit(s => s && { ...s, descripcion: e.target.value })}
              />
              <div className="drawer-meta" style={{ marginTop: 8 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9, color: '#647286' }}>
                  Unidad
                  <input
                    className="apu-edit-input" style={{ width: 56 }}
                    value={edit.unidad}
                    aria-label="Unidad"
                    onChange={e => setEdit(s => s && { ...s, unidad: e.target.value })}
                  />
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9, color: '#647286' }}>
                  Rendimiento
                  <input
                    className="apu-edit-input num" style={{ width: 66 }}
                    value={edit.rendimiento}
                    aria-label="Rendimiento"
                    onChange={e => setEdit(s => s && { ...s, rendimiento: e.target.value })}
                  />
                </label>
              </div>
            </>
          )}
        </div>

        {!loading && p && calc && (
          <>
            <div className="drawer-tabs">
              {(['analisis', 'especificaciones', 'historial'] as TabId[]).map(t => (
                <button
                  key={t}
                  className={`drawer-tab${tab === t ? ' active' : ''}`}
                  onClick={() => setTab(t)}
                >
                  {t === 'analisis' ? 'Análisis' : t === 'especificaciones' ? 'Especificaciones' : 'Historial'}
                </button>
              ))}
            </div>

            <div className="drawer-scroll">
              {tab === 'analisis' && !enEdicion && (
                <>
                  {tablaSeccion(
                    'Materiales',
                    ['RECURSO', 'UND.', 'CANT.', 'COSTO BS.', 'TOTAL BS.'],
                    p!.materiales.map(m => [
                      <span className="item-name" key="n">{m.descripcion}</span>,
                      <span key="u">{m.unidad || '—'}</span>,
                      <span className="mono" key="c">{formatBs(m.cantidad, 4).replace(/,?0+$/, '')}</span>,
                      <span className="mono" key="cu">{formatBs(m.costoBs)}</span>,
                      <span className="mono" key="t">{formatBs(m.totalBs)}</span>,
                    ]),
                    'Esta partida no lleva materiales.'
                  )}
                  {tablaSeccion(
                    'Equipos',
                    ['RECURSO', 'CANT.', 'C.O.P.', 'COSTO BS.', 'TOTAL BS.'],
                    p!.equipos.map(e => [
                      <span className="item-name" key="n">{e.descripcion}</span>,
                      <span className="mono" key="c">{formatBs(e.cantidad, 4).replace(/,?0+$/, '')}</span>,
                      <span className="mono" key="cop">{e.cop != null ? formatBs(e.cop, 5).replace(/,?0+$/, '') : '—'}</span>,
                      <span className="mono" key="cu">{formatBs(e.costoBs)}</span>,
                      <span className="mono" key="t">{formatBs(e.totalBs)}</span>,
                    ]),
                    'Esta partida no usa equipos.'
                  )}
                  {tablaSeccion(
                    'Mano de obra',
                    ['CARGO', 'CANT.', 'JORNAL BS.', 'TOTAL BS.'],
                    p!.manoObra.map(mo => [
                      <span className="item-name" key="n">{mo.cargo}</span>,
                      <span className="mono" key="c">{formatBs(mo.cantidad, 4).replace(/,?0+$/, '')}</span>,
                      <span className="mono" key="j">{formatBs(mo.jornalBs)}</span>,
                      <span className="mono" key="t">{formatBs(mo.totalBs)}</span>,
                    ]),
                    'Esta partida no tiene mano de obra.'
                  )}
                  <ResumenCostos c={calc} params={params!} unidad={p!.unidad} />
                </>
              )}

              {tab === 'analisis' && enEdicion && edit && (
                <>
                  {/* Materiales editables */}
                  <div className="section-title">
                    <strong>Materiales</strong>
                    <button className="btn subtle small" onClick={addMat}><Plus size={12} strokeWidth={1.8} /> Añadir material</button>
                  </div>
                  <div className="apu-edit-wrap">
                    <table className="apu-edit-table">
                      <thead><tr><th style={{ minWidth: 190 }}>RECURSO</th><th style={{ width: 54 }}>UND.</th><th style={{ width: 64 }}>CANT.</th><th style={{ width: 84 }}>COSTO BS.</th><th style={{ width: 30 }}></th></tr></thead>
                      <tbody>
                        {edit.materiales.map((m, i) => (
                          <tr key={i}>
                            <td><input className="apu-edit-input" value={m.descripcion} placeholder="Descripción del material" onChange={e => updMat(i, 'descripcion', e.target.value)} /></td>
                            <td><input className="apu-edit-input" value={m.unidad} placeholder="—" onChange={e => updMat(i, 'unidad', e.target.value)} /></td>
                            <td><input className="apu-edit-input num" value={m.cantidad} onChange={e => updMat(i, 'cantidad', e.target.value)} /></td>
                            <td><input className="apu-edit-input num" value={m.costoBs} placeholder="0,00" onChange={e => updMat(i, 'costoBs', e.target.value)} /></td>
                            <td><button className="row-del" aria-label={`Eliminar ${m.descripcion || 'material'}`} onClick={() => delMat(i)}><Trash2 size={13} strokeWidth={1.8} /></button></td>
                          </tr>
                        ))}
                        {edit.materiales.length === 0 && <tr><td colSpan={5} style={{ fontSize: 9, color: '#99a4b1', padding: 8 }}>Sin materiales — añade uno con el botón de arriba.</td></tr>}
                      </tbody>
                    </table>
                  </div>

                  {/* Equipos editables */}
                  <div className="section-title">
                    <strong>Equipos</strong>
                    <button className="btn subtle small" onClick={addEq}><Plus size={12} strokeWidth={1.8} /> Añadir equipo</button>
                  </div>
                  <div className="apu-edit-wrap">
                    <table className="apu-edit-table">
                      <thead><tr><th style={{ minWidth: 190 }}>RECURSO</th><th style={{ width: 64 }}>CANT.</th><th style={{ width: 76 }}>C.O.P.</th><th style={{ width: 84 }}>COSTO BS.</th><th style={{ width: 30 }}></th></tr></thead>
                      <tbody>
                        {edit.equipos.map((e, i) => (
                          <tr key={i}>
                            <td><input className="apu-edit-input" value={e.descripcion} placeholder="Descripción del equipo" onChange={ev => updEq(i, 'descripcion', ev.target.value)} /></td>
                            <td><input className="apu-edit-input num" value={e.cantidad} onChange={ev => updEq(i, 'cantidad', ev.target.value)} /></td>
                            <td><input className="apu-edit-input num" value={e.cop} placeholder="—" onChange={ev => updEq(i, 'cop', ev.target.value)} /></td>
                            <td><input className="apu-edit-input num" value={e.costoBs} placeholder="0,00" onChange={ev => updEq(i, 'costoBs', ev.target.value)} /></td>
                            <td><button className="row-del" aria-label={`Eliminar ${e.descripcion || 'equipo'}`} onClick={() => delEq(i)}><Trash2 size={13} strokeWidth={1.8} /></button></td>
                          </tr>
                        ))}
                        {edit.equipos.length === 0 && <tr><td colSpan={5} style={{ fontSize: 9, color: '#99a4b1', padding: 8 }}>Sin equipos — la partida puede llevar solo materiales y mano de obra.</td></tr>}
                      </tbody>
                    </table>
                  </div>

                  {/* Mano de obra editable */}
                  <div className="section-title">
                    <strong>Mano de obra</strong>
                    <button className="btn subtle small" onClick={addMo}><Plus size={12} strokeWidth={1.8} /> Añadir cargo</button>
                  </div>
                  <div className="apu-edit-wrap">
                    <table className="apu-edit-table">
                      <thead><tr><th style={{ minWidth: 190 }}>CARGO</th><th style={{ width: 64 }}>CANT.</th><th style={{ width: 84 }}>JORNAL BS.</th><th style={{ width: 30 }}></th></tr></thead>
                      <tbody>
                        {edit.manoObra.map((mo, i) => (
                          <tr key={i}>
                            <td><input className="apu-edit-input" value={mo.cargo} placeholder="Cargo (ej. OBRERO DE 1ra.)" onChange={e => updMo(i, 'cargo', e.target.value)} /></td>
                            <td><input className="apu-edit-input num" value={mo.cantidad} onChange={e => updMo(i, 'cantidad', e.target.value)} /></td>
                            <td><input className="apu-edit-input num" value={mo.jornalBs} placeholder="0,00" onChange={e => updMo(i, 'jornalBs', e.target.value)} /></td>
                            <td><button className="row-del" aria-label={`Eliminar ${mo.cargo || 'cargo'}`} onClick={() => delMo(i)}><Trash2 size={13} strokeWidth={1.8} /></button></td>
                          </tr>
                        ))}
                        {edit.manoObra.length === 0 && <tr><td colSpan={4} style={{ fontSize: 9, color: '#99a4b1', padding: 8 }}>Sin mano de obra.</td></tr>}
                      </tbody>
                    </table>
                  </div>

                  {/* Parámetros */}
                  <div className="section-title" style={{ marginTop: 14 }}><strong>Parámetros de cálculo</strong><span>aplicados al recalcular</span></div>
                  <div className="param-edit-grid">
                    <label>F.C.A.S. %<input className="apu-edit-input num" value={edit.parametros.fcasPct} onChange={e => updParam('fcasPct', e.target.value)} /></label>
                    <label>C.I.V. %<input className="apu-edit-input num" value={edit.parametros.ceduPct} onChange={e => updParam('ceduPct', e.target.value)} /></label>
                    <label>Bono alim. Bs.<input className="apu-edit-input num" value={edit.parametros.bonoAlimenticioDiario} onChange={e => updParam('bonoAlimenticioDiario', e.target.value)} /></label>
                    <label>Administración %<input className="apu-edit-input num" value={edit.parametros.administracionPct} onChange={e => updParam('administracionPct', e.target.value)} /></label>
                    <label>Utilidad %<input className="apu-edit-input num" value={edit.parametros.utilidadPct} onChange={e => updParam('utilidadPct', e.target.value)} /></label>
                    <label>I.V.A. %<input className="apu-edit-input num" value={edit.parametros.ivaPct} onChange={e => updParam('ivaPct', e.target.value)} /></label>
                  </div>

                  <ResumenCostos c={calc} params={{
                    fcasPct: parseNum(edit.parametros.fcasPct),
                    ceduPct: parseNum(edit.parametros.ceduPct),
                    bonoAlimenticioDiario: parseNum(edit.parametros.bonoAlimenticioDiario),
                    administracionPct: parseNum(edit.parametros.administracionPct),
                    utilidadPct: parseNum(edit.parametros.utilidadPct),
                    ivaPct: parseNum(edit.parametros.ivaPct),
                  }} unidad={edit.unidad || p!.unidad} />

                  <p className="calc-note">
                    <Check size={13} strokeWidth={1.8} />
                    <span>
                      Los totales se recalculan al escribir. Al guardar puedes sobrescribir el APU original
                      o crear una partida nueva (S/C o con código propio) que queda disponible en el catálogo.
                    </span>
                  </p>
                </>
              )}

              {tab === 'especificaciones' && (
                <>
                  <div className="section-title"><strong>Identificación</strong></div>
                  <div className="calc-card">
                    <div className="calc-row"><span>Código COVENIN</span><span className="mono">{p!.covenin}</span></div>
                    <div className="calc-row"><span>Guía CIV</span><span>{p!.guiaNombre || `Guía ${p!.guiaId}`}</span></div>
                    <div className="calc-row"><span>Página del PDF</span><span className="mono">{p!.paginaPdf ?? '—'}</span></div>
                    <div className="calc-row"><span>Cantidad de análisis</span><span className="mono">{p!.cantidad}</span></div>
                    <div className="calc-row"><span>Rendimiento</span><span className="mono">{formatBs(p!.rendimiento, 2)} {p!.unidad}/jornada</span></div>
                  </div>

                  <div className="section-title" style={{ marginTop: 16 }}><strong>Parámetros aplicados</strong></div>
                  <div className="calc-card">
                    <div className="calc-row"><span>F.C.A.S. — costos asociados al salario</span><span className="mono">{params?.fcasPct}%</span></div>
                    <div className="calc-row"><span>C.I.V. — sobrecarga laboral</span><span className="mono">{params?.ceduPct}%</span></div>
                    <div className="calc-row"><span>Bono alimenticio diario</span><span className="mono">Bs. {formatBs(params?.bonoAlimenticioDiario ?? 5407.53)}</span></div>
                    <div className="calc-row"><span>Administración</span><span className="mono">{params?.administracionPct}%</span></div>
                    <div className="calc-row"><span>Utilidad</span><span className="mono">{params?.utilidadPct}%</span></div>
                    <div className="calc-row"><span>I.V.A.</span><span className="mono">{params?.ivaPct}%</span></div>
                  </div>
                </>
              )}

              {tab === 'historial' && (
                <>
                  <div className="section-title"><strong>Fuentes y vigencias</strong></div>
                  <div className="calc-card">
                    <div className="calc-row"><span>Base de costos original</span><span>CIV · Edición Febrero 2011</span></div>
                    <div className="calc-row"><span>Mano de obra</span><span>Tabulador CC · vig. 19/08/2026</span></div>
                    <div className="calc-row"><span>Materiales y equipos</span><span>Factor USD/BCV 232,56× (Nov-2026)</span></div>
                    <div className="calc-row"><span>Bono alimenticio</span><span>Bs. 5.407,53/jornada · Bs. 162.226/mes</span></div>
                    <div className="calc-row"><span>Recalibración de APU</span><span>09/11/2026 · 7.594 partidas</span></div>
                  </div>
                  <p className="calc-note">
                    <Check size={13} strokeWidth={1.8} />
                    <span>
                      El análisis fue recalculado con la fórmula completa del CIV: sub-total MO → F.C.A.S. →
                      bono alimenticio → unitarios por rendimiento → costo directo → administración → utilidad → I.V.A.
                    </span>
                  </p>
                </>
              )}
            </div>

            <div className="drawer-foot">
              {!enEdicion ? (
                <>
                  <button className="btn outline" onClick={() => onExport(p!.id, p!.covenin)}>
                    <Download size={14} strokeWidth={1.8} /> Exportar APU
                  </button>
                  <button className="btn" onClick={agregar}>
                    <Plus size={14} strokeWidth={1.8} /> Agregar al presupuesto
                  </button>
                  <button className="btn subtle" title="Editar conceptos del APU" onClick={iniciarEdicion}>
                    <Pencil size={14} strokeWidth={1.8} /> Editar
                  </button>
                  {p!.esPropia && (
                    <button
                      className="btn subtle danger" title="Eliminar esta partida del catálogo"
                      onClick={() => { setConfirmarBorrar(true); setError(null) }}
                    >
                      <Trash2 size={14} strokeWidth={1.8} /> Eliminar
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button className="btn outline" onClick={cancelarEdicion} disabled={guardando}>
                    <RotateCcw size={14} strokeWidth={1.8} /> Descartar
                  </button>
                  <button className="btn" onClick={abrirDialogoGuardado} disabled={guardando}>
                    {guardando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} strokeWidth={1.8} />} Guardar cambios
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {!loading && !p && (
          <div className="empty">No se pudo cargar el análisis de esta partida.</div>
        )}

        {loading && (
          <div className="drawer-foot" style={{ borderTop: 0 }}>
            <button className="btn outline" disabled><Loader2 size={14} className="animate-spin" /> Exportar APU</button>
            <button className="btn" disabled><Plus size={14} strokeWidth={1.8} /> Agregar al presupuesto</button>
          </div>
        )}

        {/* ---------- Diálogo: destino del guardado ---------- */}
        {!loading && p && destino && (
          <div className="apu-save" role="dialog" aria-label="Guardar cambios del APU">
            <div className="apu-save-card">
              <div className="drawer-head-top" style={{ marginBottom: 4 }}>
                <h3>Guardar APU</h3>
                <button className="close-btn" aria-label="Cancelar guardado" onClick={() => setDestino(null)}><X size={14} strokeWidth={1.8} /></button>
              </div>
              <p className="apu-save-sub">Elige dónde guardar la composición editada de <strong>{p.covenin}</strong>.</p>

              <button
                className={`apu-save-opt${destino === 'sobrescribir' ? ' selected' : ''}`}
                onClick={() => setDestino('sobrescribir')}
              >
                <Save size={16} strokeWidth={1.8} />
                <span style={{ display: 'block', minWidth: 0 }}>
                  <strong>Sobrescribir el original</strong>
                  <span>Reemplaza {p.covenin} en el catálogo con los nuevos conceptos y precio. Los presupuestos ya guardados conservan el precio que tenían.</span>
                </span>
              </button>

              <button
                className={`apu-save-opt${destino === 'sc' ? ' selected' : ''}`}
                onClick={() => {
                  setDestino('sc')
                  // re-sugerir código S/C por si el campo venía con un código ocupado
                  fetch('/api/analisis?sugerirSc=1')
                    .then(r => r.json())
                    .then(d => d.covenin && setCoveninNuevo(d.covenin))
                    .catch(() => {})
                }}
              >
                <FilePlus2 size={16} strokeWidth={1.8} />
                <span style={{ display: 'block', minWidth: 0 }}>
                  <strong>Guardar como partida S/C nueva</strong>
                  <span>Crea una partida “sin contracto” con código S/C-… que queda disponible en el catálogo; el original no se toca.</span>
                </span>
              </button>

              <button
                className={`apu-save-opt${destino === 'codigo' ? ' selected' : ''}`}
                onClick={() => setDestino('codigo')}
              >
                <Hash size={16} strokeWidth={1.8} />
                <span style={{ display: 'block', minWidth: 0 }}>
                  <strong>Guardar con un código propio</strong>
                  <span>Crea una partida nueva con el código que escribas (no puede repetir un código ya registrado).</span>
                </span>
              </button>

              {codoSeleccionado && (
                <>
                  <div className="apu-save-code">
                    <input
                      className="field-input"
                      aria-label="Código de la nueva partida"
                      placeholder="Ej. S/C-1 o R.910.111.110-M"
                      value={coveninNuevo}
                      onChange={e => setCoveninNuevo(e.target.value)}
                    />
                    {colision ? (
                      colision.existe
                        ? <span className="apu-save-badge bad">Ya existe: {colision.descripcion?.slice(0, 34) || coveninNuevo}</span>
                        : <span className="apu-save-badge ok">Disponible ✓</span>
                    ) : (
                      <span className="apu-save-badge">Escribe un código</span>
                    )}
                  </div>
                  {destino === 'sc' && (
                    <p className="apu-save-sub" style={{ marginTop: 6 }}>
                      El código se sugiere automáticamente y puedes cambiarlo antes de guardar.
                    </p>
                  )}
                </>
              )}

              {error && <p style={{ fontSize: 10, color: '#dc2626', margin: '10px 0 0' }}>{error}</p>}

              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button className="btn outline" style={{ flex: 1 }} onClick={() => setDestino(null)} disabled={guardando}>
                  Cancelar
                </button>
                <button
                  className="btn" style={{ flex: 1.6 }}
                  onClick={guardar}
                  disabled={guardando || codigoInvalido}
                >
                  {guardando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} strokeWidth={1.8} />}
                  {destino === 'sobrescribir' ? 'Sobrescribir APU' : 'Crear partida'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---------- Diálogo: confirmar eliminación ---------- */}
        {!loading && p && confirmarBorrar && (
          <div className="apu-save" role="dialog" aria-label="Confirmar eliminación de la partida">
            <div className="apu-save-card">
              <div className="drawer-head-top" style={{ marginBottom: 4 }}>
                <h3>Eliminar partida</h3>
                <button className="close-btn" aria-label="Cancelar eliminación" onClick={() => setConfirmarBorrar(false)}><X size={14} strokeWidth={1.8} /></button>
              </div>
              <p className="apu-save-sub">¿Eliminar <strong>{p.covenin}</strong> del catálogo? Esta acción no se puede deshacer.</p>

              <div className="calc-card" style={{ marginBottom: 10 }}>
                <div className="calc-row">
                  <span>Descripción</span>
                  <span style={{ maxWidth: 240, textAlign: 'right' }}>{p.descripcion.length > 64 ? p.descripcion.slice(0, 64) + '…' : p.descripcion}</span>
                </div>
                <div className="calc-row"><span>Precio unitario</span><span className="mono">Bs. {formatBs(p.calculo.precioUnitarioBs)}</span></div>
                <div className="calc-row">
                  <span>Conceptos</span>
                  <span className="mono">{p.materiales.length} mat. · {p.equipos.length} eq. · {p.manoObra.length} MO</span>
                </div>
                <div className="calc-row">
                  <span>Usada en presupuestos guardados</span>
                  <span className="mono">{p.enPresupuestos ?? 0} ítem{(p.enPresupuestos ?? 0) === 1 ? '' : 's'}</span>
                </div>
              </div>

              {(p.enPresupuestos ?? 0) > 0 && (
                <p className="apu-save-sub" style={{ color: '#8a5b00' }}>
                  La partida está referenciada por {p.enPresupuestos} ítem{(p.enPresupuestos ?? 0) === 1 ? '' : 's'} de presupuestos guardados.
                  Los ítems conservan el precio y la descripción que ya tenían; solo pierden el vínculo con este análisis.
                </p>
              )}

              {error && <p style={{ fontSize: 10, color: '#dc2626', margin: '10px 0 0' }}>{error}</p>}

              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button className="btn outline" style={{ flex: 1 }} onClick={() => setConfirmarBorrar(false)} disabled={borrando}>
                  Cancelar
                </button>
                <button className="btn danger" style={{ flex: 1.6 }} onClick={confirmarEliminar} disabled={borrando}>
                  {borrando ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} strokeWidth={1.8} />}
                  Eliminar partida
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}

/** Resumen de costos compartido entre la vista y el modo edición */
function ResumenCostos({ c, params, unidad }: {
  c: NonNullable<PartidaDetalle['partida']['calculo']> & { totalDiasManoObra?: number }
  params: { fcasPct: number; ceduPct: number; bonoAlimenticioDiario: number; administracionPct: number; utilidadPct: number; ivaPct: number }
  unidad: string
}) {
  return (
    <>
      <div className="section-title" style={{ marginTop: 18 }}>
        <strong>Resumen de costos</strong>
        <span>Por {unidad}</span>
      </div>
      <div className="calc-card">
        <div className="calc-row"><span>Materiales</span><span className="mono">Bs. {formatBs(c.unitarioMaterialesBs)}</span></div>
        <div className="calc-row"><span>Equipos</span><span className="mono">Bs. {formatBs(c.unitarioEquiposBs)}</span></div>
        <div className="calc-row"><span>Sub-total mano de obra</span><span className="mono">Bs. {formatBs(c.subTotalManoObraBs)}</span></div>
        <div className="calc-row"><span>F.C.A.S. ({params.fcasPct}%)</span><span className="mono">Bs. {formatBs(c.factorCostosBs)}</span></div>
        <div className="calc-row">
          <span>Bono alimenticio (Bs. {formatBs(params.bonoAlimenticioDiario)} × {formatBs(c.totalDiasManoObra, 2)} jornadas)</span>
          <span className="mono">Bs. {formatBs(c.bonoAlimenticioBs)}</span>
        </div>
        <div className="calc-row emph"><span>Costo directo unitario</span><span className="mono">Bs. {formatBs(c.costoDirectoUnitarioBs)}</span></div>
        <div className="calc-row"><span>Administración ({params.administracionPct}%)</span><span className="mono">Bs. {formatBs(c.administracionBs)}</span></div>
        <div className="calc-row"><span>Utilidad ({params.utilidadPct}%)</span><span className="mono">Bs. {formatBs(c.utilidadBs)}</span></div>
        <div className="calc-row"><span>Sub-total sin I.V.A.</span><span className="mono">Bs. {formatBs(c.precioUnitarioSinIvaBs)}</span></div>
        <div className="calc-row"><span>I.V.A. ({params.ivaPct}%)</span><span className="mono">Bs. {formatBs(c.ivaBs)}</span></div>
        <div className="calc-row total"><span>Precio unitario</span><span className="mono">Bs. {formatBs(c.precioUnitarioBs)}</span></div>
      </div>
    </>
  )
}
