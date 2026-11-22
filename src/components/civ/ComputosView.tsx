'use client'

import { ElementosPanel, insertarPlantilla } from './ComputosFase1b'
// ============================================================
// Cómputos Métricos — Fase 1a (contrato de diseño v1.0)
// Filas con signo y expresión visible, regla de medición por partida,
// ajuste adoptado con justificación, aplicar al presupuesto con preview
// y versión reproducible, export XLSX con el layout de la planilla.
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Plus, Trash2, RefreshCw, Loader2, Calculator, FileSpreadsheet, Save,
  ArrowUp, ArrowDown, X, ChevronDown, AlertTriangle, CheckCircle2, Minus,
  BarChart3, Copy,
} from 'lucide-react'
import {
  calcularFila, resumenBloque, fmtCantidad, fmtM2,
  MODOS_MEDICION, MODOS_DESPERDICIO, type FilaComputoInput,
} from '@/lib/computos'
import type { PresupuestoListItem } from './types'

// ---------- Tipos locales ----------

interface ComputoListItem {
  id: number
  nombre: string
  valuacion: number
  updatedAt: string
  presupuesto: { id: number; nombre: string; obra: string | null; fecha: string | null }
  bloquesCount: number
  ultimaVersion: number
  partidasComputadas: number
}

interface FilaUI {
  key: string
  descripcion: string
  tipo: 'dimensiones' | 'directa'
  numero: string
  largo: string
  ancho: string
  alto: string
  valorDirecto: string
  signo: '+' | '-'
}

interface ReglaUI {
  modo: string
  descuentaVanos: boolean
  umbralVanosM2: number
  sumaRevelados: boolean
  multiplicaCaras?: boolean
  perfilAceroId?: number | null
  separacionAceroM?: number | null
  desperdicioModo: string
  desperdicioPct: number
}

interface PerfilUI {
  id: number
  codigo: string
  familia: string
  descripcion: string
  pesoKgM: number
}

interface ValuacionesResp {
  presupuesto: { id: number; nombre: string; ivaPct: number }
  valuaciones: Array<{
    numero: number
    fecha: string
    computos: number[]
    partidas: Array<{ covenin: string; descripcion: string; unidad: string; delta: number; pu: number; monto: number }>
    montoConIvaBs: number
    montoSinIvaBs: number
    acumuladoConIvaBs: number
  }>
  computosSinVersiones: string[]
  nota: string
}

const fmtBsVal = (n: number) =>
  n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface BloqueUI {
  id: number
  itemId: number | null
  pendiente: boolean
  elementoId: number | null
  avisoElemento: string | null
  covenin: string
  descripcion: string
  unidad: string
  precioUnitarioBs: number
  vigente: number
  regla: ReglaUI
  filas: FilaUI[]
  ajusteActivo: boolean
  ajuste: string
  justificacion: string
}

interface DetalleUI {
  id: number
  nombre: string
  valuacion: number
  medidoPor: string
  contratista: string
  inspector: string
  residente: string
  obra: string | null
  fecha: string | null
  presupuestoNombre: string
  bloques: BloqueUI[]
  elementos: ElementoUI[]
  ultimaVersion: number
}

interface ElementoUI {
  id: number
  tipo: string
  descripcion: string
  nivel: string
  ambiente: string
  largo: number
  ancho: number
  alto: number
  espesor: number
  caras: number
  vanos: VanoUI[]
  bloques: number[]
}

interface VanoUI {
  id: number
  nombre: string
  tipo: string
  ancho: number
  alto: number
  antepecho: number
  cantidad: number
  generaCarpinteria: boolean
}

interface PreviewFila {
  covenin: string
  descripcion: string
  unidad: string
  aplica: boolean
  cantidadNeta: number
  desperdicioModo: string
  desperdicioPct: number
  cantidadAplicada: number
  cantidadVigente: number
  diferencia: number
  justificacion: string | null
  advertencias: string[]
}

interface ItemPresupuesto {
  id: number
  covenin: string
  descripcion: string
  unidad: string
  cantidad: number
}

let filaKey = 0
const nuevaFila = (signo: '+' | '-' = '+'): FilaUI => ({
  key: `f${++filaKey}`,
  descripcion: '',
  tipo: 'dimensiones',
  numero: '1',
  largo: '',
  ancho: '',
  alto: '',
  valorDirecto: '',
  signo,
})

const num = (s: string): number => {
  const v = parseFloat((s || '').replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(v) ? v : 0
}

const filaAInput = (f: FilaUI): FilaComputoInput => ({
  tipo: f.tipo,
  numero: num(f.numero),
  largo: num(f.largo),
  ancho: num(f.ancho),
  alto: num(f.alto),
  valorDirecto: num(f.valorDirecto),
  signo: f.signo,
})

// ============================================================

export function ComputosView({ onToast, onView }: {
  onToast: (msg: string) => void
  onView: (v: 'presupuesto' | 'guardados') => void
}) {
  const [presupuestos, setPresupuestos] = useState<PresupuestoListItem[]>([])
  const [presId, setPresId] = useState<number | null>(null)
  const [computos, setComputos] = useState<ComputoListItem[]>([])
  const [detalle, setDetalle] = useState<DetalleUI | null>(null)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [bloquesGuardando, setBloquesGuardando] = useState<Set<number>>(new Set())
  const [preview, setPreview] = useState<PreviewFila[] | null>(null)
  const [aplicando, setAplicando] = useState(false)
  const [itemsDisponibles, setItemsDisponibles] = useState<ItemPresupuesto[]>([])
  const [perfiles, setPerfiles] = useState<PerfilUI[]>([])
  const [valuaciones, setValuaciones] = useState<ValuacionesResp | null>(null)
  const [valuacionesCargando, setValuacionesCargando] = useState(false)

  // Presupuestos guardados (un cómputo siempre vive dentro de un presupuesto, A2)
  const cargarPresupuestos = useCallback(async () => {
    setCargando(true)
    try {
      const r = await fetch('/api/presupuestos')
      const data = await r.json()
      setPresupuestos(data.items || [])
    } catch { onToast('Error al cargar presupuestos') }
    finally { setCargando(false) }
  }, [onToast])

  useEffect(() => { cargarPresupuestos() }, [cargarPresupuestos])

  const cargarComputos = useCallback(async (pid: number) => {
    try {
      const r = await fetch(`/api/computos?presupuestoId=${pid}`)
      const data = await r.json()
      setComputos(data.items || [])
    } catch { onToast('Error al cargar cómputos') }
  }, [onToast])

  const abrirComputo = useCallback(async (id: number) => {
    setGuardando(true)
    try {
      const r = await fetch(`/api/computos/${id}`)
      const data = await r.json()
      const c = data.computo
      setDetalle({
        id: c.id,
        nombre: c.nombre,
        valuacion: c.valuacion,
        medidoPor: c.medidoPor || '',
        contratista: c.contratista || '',
        inspector: c.inspector || '',
        residente: c.residente || '',
        obra: c.presupuesto?.obra || null,
        fecha: c.presupuesto?.fecha || null,
        presupuestoNombre: c.presupuesto?.nombre || '',
        ultimaVersion: c.versiones?.[0]?.numero ?? 0,
        elementos: (c.elementos || []).map((e: any) => ({
          id: e.id, tipo: e.tipo, descripcion: e.descripcion, nivel: e.nivel,
          ambiente: e.ambiente, largo: e.largo, ancho: e.ancho, alto: e.alto,
          espesor: e.espesor, caras: e.caras,
          vanos: (e.vanos || []).map((v: any) => ({
            id: v.id, nombre: v.nombre, tipo: v.tipo, ancho: v.ancho, alto: v.alto,
            antepecho: v.antepecho, cantidad: v.cantidad, generaCarpinteria: v.generaCarpinteria,
          })),
          bloques: (e.bloques || []).map((b: any) => b.id),
        })),
        bloques: (c.bloques || []).map((b: any) => ({
          id: b.id,
          itemId: b.item?.id ?? null,
          pendiente: !!b.pendiente,
          elementoId: b.elementoId ?? null,
          avisoElemento: b.avisoElemento ?? null,
          covenin: b.item?.covenin ?? b.covenin ?? 'S/C',
          descripcion: b.item?.descripcion ?? b.descripcionPendiente ?? 'Pendiente de catálogo',
          unidad: b.item?.unidad ?? b.unidadPendiente ?? '',
          precioUnitarioBs: b.item?.precioUnitarioBs ?? 0,
          vigente: b.item?.cantidad ?? 0,
          regla: b.regla,
          filas: b.filas.length > 0
            ? b.filas.map((f: any) => ({
                key: `f${++filaKey}`,
                descripcion: f.descripcion || '',
                tipo: f.tipo,
                numero: String(f.numero ?? 1),
                largo: f.largo ? String(f.largo) : '',
                ancho: f.ancho ? String(f.ancho) : '',
                alto: f.alto ? String(f.alto) : '',
                valorDirecto: f.valorDirecto !== null && f.valorDirecto !== undefined ? String(f.valorDirecto) : '',
                signo: f.signo,
              }))
            : [nuevaFila()],
          ajusteActivo: b.ajusteAdoptado !== null && b.ajusteAdoptado !== undefined,
          ajuste: b.ajusteAdoptado !== null && b.ajusteAdoptado !== undefined ? String(b.ajusteAdoptado) : '',
          justificacion: b.justificacion || '',
        })),
      })
    } catch { onToast('Error al abrir el cómputo') }
    finally { setGuardando(false) }
  }, [onToast])

  // Al elegir presupuesto: cargar cómputos y salir del editor
  const seleccionarPresupuesto = useCallback(async (pid: number | null) => {
    setPresId(pid)
    setDetalle(null)
    if (pid) await cargarComputos(pid)
    else setComputos([])
  }, [cargarComputos])

  // Partidas del presupuesto disponibles para agregar como bloque
  const cargarItemsDisponibles = useCallback(async (pid: number) => {
    try {
      const r = await fetch(`/api/presupuestos/${pid}`)
      const data = await r.json()
      const items: ItemPresupuesto[] = (data.items || data.presupuesto?.items || []).map((i: any) => ({
        id: i.id, covenin: i.covenin, descripcion: i.descripcion, unidad: i.unidad, cantidad: i.cantidad,
      }))
      setItemsDisponibles(items)
    } catch { setItemsDisponibles([]) }
  }, [])

  useEffect(() => {
    if (detalle && presId) cargarItemsDisponibles(presId)
  }, [detalle, presId, cargarItemsDisponibles])

  // Catálogo de perfiles disponible para la obra (generales + propios)
  useEffect(() => {
    if (!presId) { setPerfiles([]); return }
    fetch(`/api/perfiles?presupuestoId=${presId}`)
      .then(r => r.json())
      .then(d => setPerfiles(d.items || []))
      .catch(() => setPerfiles([]))
  }, [presId])

  const crearComputo = async () => {
    if (!presId || !nombreNuevo.trim()) return
    try {
      const r = await fetch('/api/computos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presupuestoId: presId, nombre: nombreNuevo.trim() }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Error al crear')
      setNombreNuevo('')
      onToast('Cómputo creado (valuación 0 — cómputo inicial)')
      await cargarComputos(presId)
      abrirComputo(data.computo.id)
    } catch (e: any) { onToast(`Error: ${e.message}`) }
  }

  const duplicarComputo = async (c: ComputoListItem) => {
    try {
      const r = await fetch(`/api/computos/${c.id}/duplicar`, { method: 'POST' })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Error al duplicar')
      onToast(`${c.nombre} duplicado · nuevo #${data.computo.id} (filas y elementos conservados)`)
      if (presId) await cargarComputos(presId)
    } catch (e: any) { onToast(`Error: ${e.message}`) }
  }

  const verValuaciones = async () => {
    if (!presId) return
    setValuacionesCargando(true)
    try {
      const r = await fetch(`/api/presupuestos/${presId}/valuaciones`)
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setValuaciones(data)
    } catch (e: any) { onToast(`Error: ${e.message}`) }
    finally { setValuacionesCargando(false) }
  }

  const guardarCabecera = async () => {
    if (!detalle) return
    try {
      const r = await fetch(`/api/computos/${detalle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: detalle.nombre,
          medidoPor: detalle.medidoPor,
          contratista: detalle.contratista,
          inspector: detalle.inspector,
          residente: detalle.residente,
        }),
      })
      if (!r.ok) throw new Error((await r.json()).error)
      onToast('Cabecera y firmas guardadas')
    } catch (e: any) { onToast(`Error: ${e.message}`) }
  }

  // ---------- Operaciones de bloque ----------

  const setBloque = (bloqueId: number, patch: Partial<BloqueUI>) => {
    setDetalle(d => d ? {
      ...d,
      bloques: d.bloques.map(b => b.id === bloqueId ? { ...b, ...patch } : b),
    } : d)
  }

  const setFila = (bloqueId: number, key: string, patch: Partial<FilaUI>) => {
    setDetalle(d => d ? {
      ...d,
      bloques: d.bloques.map(b => b.id !== bloqueId ? b : {
        ...b,
        filas: b.filas.map(f => f.key === key ? { ...f, ...patch } : f),
      }),
    } : d)
  }

  const moverFila = (bloqueId: number, idx: number, dir: -1 | 1) => {
    setDetalle(d => {
      if (!d) return d
      return {
        ...d,
        bloques: d.bloques.map(b => {
          if (b.id !== bloqueId) return b
          const filas = [...b.filas]
          const j = idx + dir
          if (j < 0 || j >= filas.length) return b
          ;[filas[idx], filas[j]] = [filas[j], filas[idx]]
          return { ...b, filas }
        }),
      }
    })
  }

  const agregarBloque = async (itemId: number) => {
    if (!detalle || !itemId) return
    try {
      const r = await fetch(`/api/computos/${detalle.id}/bloques`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presupuestoItemId: itemId }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Error al agregar')
      if (data.aviso) onToast(data.aviso)
      else onToast('Bloque agregado con regla precargada')
      await abrirComputo(detalle.id)
    } catch (e: any) { onToast(`Error: ${e.message}`) }
  }

  const guardarBloque = async (b: BloqueUI) => {
    setBloquesGuardando(s => new Set(s).add(b.id))
    try {
      const r = await fetch(`/api/computos/bloques/${b.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regla: b.regla,
          filas: b.filas.map(filaAInput),
          ajusteAdoptado: b.ajusteActivo ? num(b.ajuste) : null,
          justificacion: b.justificacion,
        }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Error al guardar')
      onToast('Bloque guardado: neto, ajuste y expresiones actualizados')
      await abrirComputo(detalle!.id)
      await cargarComputos(presId!)
    } catch (e: any) { onToast(`Error: ${e.message}`) }
    finally {
      setBloquesGuardando(s => {
        const n = new Set(s)
        n.delete(b.id)
        return n
      })
    }
  }

  const quitarBloque = async (b: BloqueUI) => {
    if (!detalle) return
    if (!confirm(`¿Quitar el bloque de "${b.covenin}" del cómputo?`)) return
    try {
      const r = await fetch(`/api/computos/bloques/${b.id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Error al quitar')
      await abrirComputo(detalle.id)
      onToast('Bloque quitado')
    } catch (e: any) { onToast(`Error: ${e.message}`) }
  }

  // ---------- Aplicar al presupuesto (A1) ----------

  const pedirPreview = async () => {
    if (!detalle) return
    try {
      const r = await fetch(`/api/computos/${detalle.id}/aplicar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setPreview(data.preview)
    } catch (e: any) { onToast(`Error: ${e.message}`) }
  }

  const confirmarAplicar = async () => {
    if (!detalle) return
    setAplicando(true)
    try {
      const r = await fetch(`/api/computos/${detalle.id}/aplicar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmar: true }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      onToast(`Cómputo aplicado al presupuesto — versión v${data.version} guardada (reproducible)`)
      setPreview(null)
      await abrirComputo(detalle.id)
      await cargarComputos(presId!)
    } catch (e: any) { onToast(`Error: ${e.message}`) }
    finally { setAplicando(false) }
  }

  const exportar = async () => {
    if (!detalle) return
    try {
      const r = await fetch(`/api/computos/${detalle.id}/export`)
      if (!r.ok) throw new Error('Error al generar el Excel')
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = (r.headers.get('Content-Disposition') || '').match(/filename="(.+)"/)?.[1] || 'computo.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      onToast('Planilla exportada (hoja CÓMPUTO + CONSOLIDADO)')
    } catch (e: any) { onToast(`Error: ${e.message}`) }
  }

  const eliminarComputo = async (c: ComputoListItem) => {
    if (!confirm(`¿Eliminar el cómputo "${c.nombre}"? Las cantidades ya aplicadas al presupuesto no se revierten.`)) return
    try {
      const r = await fetch(`/api/computos/${c.id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Error al eliminar')
      if (detalle?.id === c.id) setDetalle(null)
      if (presId) await cargarComputos(presId)
      onToast('Cómputo eliminado')
    } catch (e: any) { onToast(`Error: ${e.message}`) }
  }

  // ---------- Cálculos en vivo ----------

  const resumenDe = (b: BloqueUI) => {
    const inputs = b.filas.map(filaAInput)
    const ajuste = b.ajusteActivo && b.ajuste.trim() !== '' ? num(b.ajuste) : null
    return resumenBloque(inputs, b.regla, ajuste, b.justificacion)
  }

  const itemsSinBloque = useMemo(() => {
    const usados = new Set(detalle?.bloques.map(b => b.itemId).filter((x): x is number => x !== null) ?? [])
    return itemsDisponibles.filter(i => !usados.has(i.id))
  }, [detalle, itemsDisponibles])

  const presSel = presupuestos.find(p => p.id === presId) || null

  // ============================================================
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Cómputos métricos</h1>
          <p>
            Planilla de mediciones por partida con filas con signo y expresión visible.
            La cantidad adoptada se aplica al presupuesto con vista previa y queda versionada.
          </p>
        </div>
        <div className="head-tools">
          <select
            className="btn outline"
            value={presId ?? ''}
            onChange={e => seleccionarPresupuesto(e.target.value ? parseInt(e.target.value) : null)}
            style={{ maxWidth: 340 }}
          >
            <option value="">— Elegir presupuesto guardado —</option>
            {presupuestos.map(p => (
              <option key={p.id} value={p.id}>{p.nombre} ({p.itemCount} partidas)</option>
            ))}
          </select>
        </div>
      </div>

      {presupuestos.length === 0 && !cargando && (
        <div className="summary-strip">
          <span className="summary-pill"><AlertTriangle size={13} /> Aún no hay presupuestos guardados</span>
          <span className="summary-spacer" />
          <button className="btn outline" onClick={() => onView('presupuesto')}>Ir a Presupuesto</button>
        </div>
      )}

      {presSel && !detalle && (
        <>
          <div className="summary-strip">
            <span className="summary-pill"><span className="dot" />{presSel.nombre}</span>
            {presSel.obra && <span className="summary-pill">Obra: <strong>{presSel.obra}</strong></span>}
            {presSel.fecha && <span className="summary-pill">Fecha: {presSel.fecha}</span>}
            <span className="summary-pill">{computos.length} cómputos</span>
            <span className="summary-spacer" />
            <button className="btn outline" onClick={verValuaciones} disabled={valuacionesCargando}>
              <BarChart3 size={14} /> Valuaciones
            </button>
            <button className="btn outline" onClick={() => seleccionarPresupuesto(null)}>Cambiar presupuesto</button>
          </div>

          {/* Nuevo cómputo */}
          <div className="summary-strip" style={{ marginBottom: 14 }}>
            <input
              className="input"
              placeholder="Nombre del nuevo cómputo (ej. Mampostería y acabados, Nivel 1)"
              value={nombreNuevo}
              onChange={e => setNombreNuevo(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') crearComputo() }}
              style={{ flex: 1, minWidth: 260 }}
            />
            <button className="btn" onClick={crearComputo} disabled={!nombreNuevo.trim()}>
              <Plus size={14} /> Nuevo cómputo (valuación 0)
            </button>
          </div>

          {/* Lista de cómputos */}
          <div className="table-frame">
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 45 }}>#</th>
                    <th>NOMBRE</th>
                    <th style={{ width: 110 }}>VALUACIÓN</th>
                    <th style={{ width: 150 }}>BLOQUES</th>
                    <th style={{ width: 150 }}>ESTADO</th>
                    <th style={{ width: 200 }}>ACTUALIZADO</th>
                    <th style={{ width: 130 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {computos.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted, #888)', padding: 24 }}>
                      Sin cómputos todavía: crea el primero con el nombre de la partida o del nivel.
                    </td></tr>
                  )}
                  {computos.map((c, i) => (
                    <tr key={c.id}>
                      <td>{i + 1}</td>
                      <td><strong>{c.nombre}</strong></td>
                      <td>{c.valuacion === 0 ? '0 — inicial' : c.valuacion}</td>
                      <td>{c.bloquesCount} bloques · {c.partidasComputadas} con cantidad</td>
                      <td>
                        {c.ultimaVersion > 0
                          ? <span style={{ color: '#2F7D4F', fontWeight: 600 }}>Aplicado (v{c.ultimaVersion})</span>
                          : <span style={{ color: '#8A6D3B' }}>Borrador</span>}
                      </td>
                      <td>{new Date(c.updatedAt).toLocaleString('es-VE')}</td>
                      <td>
                        <button className="btn outline" onClick={() => abrirComputo(c.id)}>Abrir</button>{' '}
                        <button className="btn outline" title="Duplicar cómputo" onClick={() => duplicarComputo(c)}>
                          <Copy size={13} />
                        </button>{' '}
                        <button className="btn outline" title="Eliminar" onClick={() => eliminarComputo(c)}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ================= EDITOR DE CÓMPUTO ================= */}
      {detalle && (
        <>
          <div className="summary-strip" style={{ marginBottom: 12 }}>
            <span className="summary-pill"><Calculator size={13} /><strong>{detalle.nombre}</strong></span>
            <span className="summary-pill">Valuación: {detalle.valuacion === 0 ? '0 — cómputo inicial' : detalle.valuacion}</span>
            {detalle.obra && <span className="summary-pill">Obra: <strong>{detalle.obra}</strong></span>}
            {detalle.fecha && <span className="summary-pill">Fecha: {detalle.fecha}</span>}
            {detalle.ultimaVersion > 0 && (
              <span className="summary-pill" style={{ color: '#2F7D4F' }}>
                <CheckCircle2 size={13} /> Aplicado v{detalle.ultimaVersion}
              </span>
            )}
            <span className="summary-spacer" />
            <button className="btn outline" onClick={exportar}><FileSpreadsheet size={14} /> Exportar XLSX</button>
            <button className="btn" onClick={pedirPreview} disabled={detalle.bloques.length === 0}>
              <Save size={14} /> Aplicar al presupuesto
            </button>
            <button className="btn outline" onClick={() => seleccionarPresupuesto(presId)}>Cerrar</button>
          </div>

          {/* Cabecera: firmas configurables (A6) */}
          <div className="table-frame" style={{ marginBottom: 16, padding: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              {([
                ['medidoPor', 'MEDIDO POR'],
                ['contratista', 'CONTRATISTA'],
                ['inspector', 'ING. INSPECTOR'],
                ['residente', 'ING. RESIDENTE'],
              ] as const).map(([campo, label]) => (
                <label key={campo} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, fontWeight: 600, color: '#6B7280' }}>
                  {label}
                  <input
                    className="input"
                    value={(detalle as any)[campo]}
                    onChange={e => setDetalle({ ...detalle, [campo]: e.target.value })}
                    placeholder="Nombre y apellido"
                  />
                </label>
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              <button className="btn outline" onClick={guardarCabecera}><Save size={13} /> Guardar cabecera y firmas</button>
            </div>
          </div>

          {/* Fase 1b: elementos constructivos, vanos, plantilla y regeneración */}
          <ElementosPanel
            computoId={detalle.id}
            elementos={detalle.elementos}
            bloques={detalle.bloques.map(b => ({
              id: b.id, covenin: b.covenin, descripcion: b.descripcion,
              pendiente: b.pendiente, elementoId: b.elementoId, avisoElemento: b.avisoElemento,
            }))}
            presId={presId}
            onRefresh={async () => { await abrirComputo(detalle.id) }}
            onToast={onToast}
          />

          {/* Bloques por partida */}
          {detalle.bloques.length === 0 && (
            <div className="summary-strip" style={{ marginBottom: 14 }}>
              <span className="summary-pill"><AlertTriangle size={13} /> Agrega la primera partida del presupuesto como bloque de medición</span>
            </div>
          )}

          {detalle.bloques.map(b => {
            const res = resumenDe(b)
            const guardandoB = bloquesGuardando.has(b.id)
            return (
              <div key={b.id} className="table-frame" style={{ marginBottom: 18, padding: 0 }}>
                {/* Título del bloque */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#1A2330', color: '#fff' }}>
                  <strong style={{ fontSize: 13 }}>{b.covenin}</strong>
                  <span style={{ fontSize: 12, opacity: 0.85, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.descripcion}</span>
                  <span style={{ fontSize: 12, background: 'rgba(255,255,255,.12)', padding: '2px 8px', borderRadius: 999 }}>{b.unidad}</span>
                  <button className="btn outline" style={{ padding: '3px 8px' }} title="Quitar bloque" onClick={() => quitarBloque(b)}>
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Fichas de regla de medición (partida, no fila — F3) */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 14px', background: '#F8F0EB', borderBottom: '1px solid #EADFD8', alignItems: 'center' }}>
                  <label style={chipLabel}>
                    Medición
                    <select style={chipInput} value={b.regla.modo}
                      onChange={e => setBloque(b.id, { regla: { ...b.regla, modo: e.target.value } })}>
                      {MODOS_MEDICION.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                  </label>
                  <label style={chipLabel}>
                    <input type="checkbox" checked={b.regla.descuentaVanos}
                      onChange={e => setBloque(b.id, { regla: { ...b.regla, descuentaVanos: e.target.checked } })} />
                    Descuenta vanos
                  </label>
                  {b.regla.descuentaVanos && (
                    <label style={chipLabel}>
                      Umbral m²
                      <input style={{ ...chipInput, width: 64 }} type="number" step="0.1" min="0"
                        value={b.regla.umbralVanosM2}
                        onChange={e => setBloque(b.id, { regla: { ...b.regla, umbralVanosM2: parseFloat(e.target.value) || 0 } })} />
                    </label>
                  )}
                  <label style={chipLabel}>
                    <input type="checkbox" checked={b.regla.sumaRevelados}
                      onChange={e => setBloque(b.id, { regla: { ...b.regla, sumaRevelados: e.target.checked } })} />
                    Suma revelados
                  </label>
                  {b.regla.modo === 'paño' && (
                    <label style={chipLabel} title="El acabado reviste las 2 caras del muro (friso/cerámica/pintura); la mampostería mide el muro una vez">
                      <input type="checkbox" checked={b.regla.multiplicaCaras ?? false}
                        onChange={e => setBloque(b.id, { regla: { ...b.regla, multiplicaCaras: e.target.checked } })} />
                      Multiplica caras
                    </label>
                  )}
                  {b.regla.modo === 'peso' && (
                    <>
                      <label style={chipLabel} title="Perfil del catálogo con peso kg/m">
                        Perfil
                        <select style={chipInput} value={b.regla.perfilAceroId ?? ''}
                          onChange={e => setBloque(b.id, { regla: { ...b.regla, perfilAceroId: e.target.value ? parseInt(e.target.value) : null } })}>
                          <option value="">— sin perfil (solo longitud) —</option>
                          {perfiles.map(p => (
                            <option key={p.id} value={p.id}>{p.codigo} · {p.pesoKgM.toLocaleString('es-VE', { minimumFractionDigits: 3 })} kg/m</option>
                          ))}
                        </select>
                      </label>
                      <label style={chipLabel} title="Separación de las barras para acero de refuerzo (p.ej. 0,20 m)">
                        Separación (m)
                        <input style={{ ...chipInput, width: 64 }} type="number" step="0.05" min="0"
                          value={b.regla.separacionAceroM ?? ''}
                          onChange={e => setBloque(b.id, { regla: { ...b.regla, separacionAceroM: e.target.value ? parseFloat(e.target.value) : null } })} />
                      </label>
                    </>
                  )}
                  <label style={chipLabel}>
                    Desperdicio
                    <select style={chipInput} value={b.regla.desperdicioModo}
                      onChange={e => setBloque(b.id, { regla: { ...b.regla, desperdicioModo: e.target.value } })}>
                      {MODOS_DESPERDICIO.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                  </label>
                  <label style={chipLabel}>
                    %
                    <input style={{ ...chipInput, width: 56 }} type="number" step="0.5" min="0"
                      value={b.regla.desperdicioPct}
                      onChange={e => setBloque(b.id, { regla: { ...b.regla, desperdicioPct: parseFloat(e.target.value) || 0 } })} />
                  </label>
                  <span style={{ fontSize: 11, color: '#8A4B1F', fontWeight: 600 }}>
                    {b.regla.desperdicioModo === 'sobre_pu'
                      ? `Va al presupuesto: neta (${fmtCantidad(res.cantidadAlPresupuesto)} ${b.unidad})`
                      : `Va al presupuesto: neta + ${b.regla.desperdicioPct}% = ${fmtCantidad(res.cantidadAlPresupuesto)} ${b.unidad}`}
                  </span>
                </div>

                {/* Tabla de filas */}
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>Nº</th>
                        <th>DESCRIPCIÓN</th>
                        <th style={{ width: 110 }}>TIPO</th>
                        <th style={{ width: 62 }}>Nº</th>
                        <th style={{ width: 76 }}>LARGO</th>
                        <th style={{ width: 76 }}>ANCHO</th>
                        <th style={{ width: 76 }}>ALTO</th>
                        <th style={{ width: 84 }}>DIRECTO</th>
                        <th style={{ width: 40 }}>+</th>
                        <th style={{ width: 190 }}>EXPRESIÓN</th>
                        <th style={{ width: 90 }}>CANT.</th>
                        <th style={{ width: 64 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.filas.map((f, idx) => {
                        const calc = calcularFila(filaAInput(f))
                        return (
                          <tr key={f.key}>
                            <td style={{ textAlign: 'center', color: '#6B7280' }}>{idx + 1}</td>
                            <td>
                              <input className="input" style={inputCompacto} placeholder="Descripción de la medición"
                                value={f.descripcion}
                                onChange={e => setFila(b.id, f.key, { descripcion: e.target.value })} />
                            </td>
                            <td>
                              <select style={inputCompacto} value={f.tipo}
                                onChange={e => setFila(b.id, f.key, { tipo: e.target.value as 'dimensiones' | 'directa' })}>
                                <option value="dimensiones">L×A×H</option>
                                <option value="directa">Directa</option>
                              </select>
                            </td>
                            {(['numero', 'largo', 'ancho', 'alto'] as const).map(campo => (
                              <td key={campo}>
                                <input style={inputCompacto} type="text" disabled={f.tipo === 'directa'}
                                  value={f.tipo === 'directa' ? '' : f[campo]}
                                  onChange={e => setFila(b.id, f.key, { [campo]: e.target.value } as Partial<FilaUI>)}
                                  placeholder={campo === 'numero' ? '1' : '—'} />
                              </td>
                            ))}
                            <td>
                              <input style={inputCompacto} type="text" disabled={f.tipo !== 'directa'}
                                value={f.tipo === 'directa' ? f.valorDirecto : ''}
                                onChange={e => setFila(b.id, f.key, { valorDirecto: e.target.value })} />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                className="btn outline"
                                style={{ padding: '2px 7px', fontWeight: 700, color: f.signo === '-' ? '#B42318' : undefined }}
                                title={f.signo === '+' ? 'Fila de suma' : 'Fila deductiva (descuento)'}
                                onClick={() => setFila(b.id, f.key, { signo: f.signo === '+' ? '-' : '+' })}>
                                {f.signo === '+' ? '+' : '−'}
                              </button>
                            </td>
                            <td style={{ fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap' }}>{calc.expresion}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: calc.cantidad < 0 ? '#B42318' : undefined }}>
                              {fmtCantidad(calc.cantidad)}
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <button className="btn outline" style={btnMini} title="Subir" onClick={() => moverFila(b.id, idx, -1)}><ArrowUp size={11} /></button>{' '}
                              <button className="btn outline" style={btnMini} title="Bajar" onClick={() => moverFila(b.id, idx, 1)}><ArrowDown size={11} /></button>{' '}
                              <button className="btn outline" style={btnMini} title="Eliminar fila" onClick={() => setBloque(b.id, { filas: b.filas.filter(x => x.key !== f.key) })}><X size={11} /></button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pie del bloque: neto, ajuste, adoptada */}
                <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', background: '#FDFBF9', borderTop: '1px solid #EEE' }}>
                  <button className="btn outline" onClick={() => setBloque(b.id, { filas: [...b.filas, nuevaFila()] })}>
                    <Plus size={13} /> Fila dimensionada
                  </button>
                  <button className="btn outline" onClick={() => setBloque(b.id, { filas: [...b.filas, { ...nuevaFila(), tipo: 'directa' }] })}>
                    <Plus size={13} /> Cantidad directa
                  </button>
                  <button className="btn outline" onClick={() => setBloque(b.id, { filas: [...b.filas, nuevaFila('-')] })}>
                    <Minus size={13} /> Deducción
                  </button>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    {res.advertencias.map((a, i) => (
                      <span key={i} style={{ fontSize: 11, color: '#B42318', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                        <AlertTriangle size={12} /> {a}
                      </span>
                    ))}
                    <span style={{ fontSize: 12, color: '#6B7280' }}>
                      Neto: <strong style={{ color: '#1A2330' }}>{fmtCantidad(res.cantidadNeta)} {b.unidad}</strong>
                    </span>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                      <input type="checkbox" checked={b.ajusteActivo}
                        onChange={e => setBloque(b.id, { ajusteActivo: e.target.checked })} />
                      Ajuste adoptado
                    </label>
                    {b.ajusteActivo && (
                      <>
                        <input className="input" style={{ width: 96 }} type="text" placeholder="Cantidad"
                          value={b.ajuste} onChange={e => setBloque(b.id, { ajuste: e.target.value })} />
                        <input className="input" style={{ width: 230 }} type="text" placeholder="Justificación obligatoria (A4)"
                          value={b.justificacion} onChange={e => setBloque(b.id, { justificacion: e.target.value })} />
                      </>
                    )}
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#8A4B1F' }}>
                      Adoptada: {fmtCantidad(res.cantidadAdoptada)} {b.unidad}
                    </span>
                    <button className="btn" onClick={() => guardarBloque(b)} disabled={guardandoB}>
                      {guardandoB ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Guardar bloque
                    </button>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Agregar bloque desde partidas del presupuesto */}
          <div className="summary-strip" style={{ marginBottom: 20 }}>
            <select className="input" style={{ flex: 1, minWidth: 280 }} value="" disabled={itemsSinBloque.length === 0}
              onChange={e => { const v = parseInt(e.target.value); if (v) agregarBloque(v) }}>
              <option value="">
                {itemsSinBloque.length === 0 ? 'Todas las partidas del presupuesto ya tienen bloque' : '— Agregar partida del presupuesto como bloque —'}
              </option>
              {itemsSinBloque.map(i => (
                <option key={i.id} value={i.id}>{i.covenin} · {i.descripcion.slice(0, 70)} ({i.unidad})</option>
              ))}
            </select>
            <span style={{ fontSize: 12, color: '#6B7280' }}>La regla se precarga: modo según la unidad y % de desperdicio según el material (C)</span>
          </div>
        </>
      )}

      {/* ================= MODAL: PREVIEW DE APLICACIÓN (A1) ================= */}
      {preview && (
        <div style={modalOverlay} onClick={() => !aplicando && setPreview(null)}>
          <div style={modalCaja} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <strong style={{ fontSize: 15 }}>Aplicar al presupuesto — vista previa</strong>
              <span style={{ flex: 1 }} />
              <button className="btn outline" onClick={() => setPreview(null)} disabled={aplicando}><X size={14} /></button>
            </div>
            <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 12px' }}>
              Se actualiza la cantidad de cada partida existente (no se crean partidas). La cantidad que viaja
              respeta el modo de desperdicio de cada bloque. Al confirmar se guarda una versión reproducible.
            </p>
            <div className="table-frame" style={{ maxHeight: 380, overflow: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>PARTIDA</th><th>DESCRIPCIÓN</th><th>UNIDAD</th>
                    <th>NETA</th><th>DESPERDICIO</th><th>AL PRESUPUESTO</th><th>VIGENTE</th><th>DIFERENCIA</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((p, i) => (
                    <tr key={i} style={!p.aplica ? { opacity: 0.55 } : undefined}>
                      <td><strong>{p.covenin}</strong></td>
                      <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.descripcion}</td>
                      <td>{p.unidad}</td>
                      <td style={{ textAlign: 'right' }}>{fmtCantidad(p.cantidadNeta)}</td>
                      <td style={{ fontSize: 11, color: '#6B7280' }}>
                        {!p.aplica ? <strong style={{ color: '#8A6D3B' }}>sin medir — no aplica</strong>
                          : p.desperdicioModo === 'sobre_pu' || !p.desperdicioPct
                            ? 'en el PU' : `+${p.desperdicioPct}% en cantidad`}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: p.aplica ? '#8A4B1F' : '#6B7280' }}>{fmtCantidad(p.cantidadAplicada)}</td>
                      <td style={{ textAlign: 'right' }}>{fmtCantidad(p.cantidadVigente)}</td>
                      <td style={{
                        textAlign: 'right', fontWeight: 600,
                        color: !p.aplica ? '#6B7280' : Math.abs(p.diferencia) < 1e-9 ? '#6B7280' : (p.diferencia > 0 ? '#2F7D4F' : '#B42318'),
                      }}>
                        {p.aplica ? `${p.diferencia >= 0 ? '+' : ''}${fmtCantidad(p.diferencia)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.some(p => p.advertencias.length > 0) && (
              <div style={{ marginTop: 10, fontSize: 11, color: '#8A6D3B' }}>
                {preview.flatMap(p => p.advertencias).slice(0, 4).map((a, i) => (
                  <div key={i}><AlertTriangle size={11} style={{ display: 'inline', marginRight: 4 }} />{a}</div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button className="btn outline" onClick={() => setPreview(null)} disabled={aplicando}>Cancelar</button>
              <button className="btn" onClick={confirmarAplicar} disabled={aplicando}>
                {aplicando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Aplicar todo y guardar versión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fase 2 — valuaciones por avance */}
      {valuaciones && (
        <div className="overlay show" onClick={() => setValuaciones(null)} />
      )}
      {valuaciones && (
        <div className="sc-dialog sc-dialog-wide" role="dialog" aria-label="Valuaciones por avance">
          <div className="drawer-head" style={{ padding: '16px 20px 10px' }}>
            <div className="drawer-head-top">
              <span className="eyebrow">Fase 2 · avance de obra</span>
              <button className="close-btn" onClick={() => setValuaciones(null)} aria-label="Cerrar"><X size={14} /></button>
            </div>
            <h2 style={{ margin: '4px 0 0' }}>Valuaciones — {valuaciones.presupuesto.nombre}</h2>
            <p style={{ fontSize: 10, color: '#768396', margin: '4px 0 0' }}>
              El avance de cada valuación = (cantidad aplicada − vigente antes) × PU, por partida. Montos con IVA del presupuesto ({valuaciones.presupuesto.ivaPct}%).
            </p>
          </div>
          <div className="sc-dialog-body">
            {valuaciones.valuaciones.length === 0 ? (
              <p style={{ fontSize: 12, color: '#99A4B1', padding: 12 }}>
                Aún no hay versiones aplicadas: el consolidado aparece al aplicar cómputos al presupuesto.
              </p>
            ) : (
              <>
                <div className="table-scroll">
                  <table className="apu-table">
                    <thead>
                      <tr>
                        <th>VALUACIÓN</th><th>FECHA</th><th>PARTIDAS CON AVANCE</th>
                        <th style={{ textAlign: 'right' }}>SIN IVA (Bs.)</th>
                        <th style={{ textAlign: 'right' }}>CON IVA (Bs.)</th>
                        <th style={{ textAlign: 'right' }}>ACUMULADO (Bs.)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {valuaciones.valuaciones.map(v => (
                        <tr key={v.numero}>
                          <td><strong>{v.numero === 0 ? '0 — inicial' : `#${v.numero}`}</strong></td>
                          <td style={{ fontSize: 10 }}>{new Date(v.fecha).toLocaleDateString('es-VE')}</td>
                          <td style={{ fontSize: 10 }}>
                            {v.partidas.slice(0, 4).map(p => (
                              <div key={p.covenin} title={p.descripcion}>
                                {p.covenin} {p.delta >= 0 ? '+' : ''}{fmtCantidad(p.delta)} {p.unidad}
                              </div>
                            ))}
                            {v.partidas.length > 4 && <div style={{ color: '#768396' }}>+{v.partidas.length - 4} partidas más</div>}
                          </td>
                          <td style={{ textAlign: 'right' }}>{fmtBsVal(v.montoSinIvaBs)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtBsVal(v.montoConIvaBs)}</td>
                          <td style={{ textAlign: 'right', color: '#17703C' }}>{fmtBsVal(v.acumuladoConIvaBs)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {valuaciones.computosSinVersiones.length > 0 && (
                  <div style={{ marginTop: 10, fontSize: 11, color: '#8A6D3B' }}>
                    <AlertTriangle size={11} style={{ display: 'inline', marginRight: 4 }} />
                    Cómputos sin aplicar (no generan valuación): {valuaciones.computosSinVersiones.join(', ')}
                  </div>
                )}
              </>
            )}
            <p style={{ fontSize: 9.5, color: '#99A4B1', margin: '10px 0 0' }}>{valuaciones.nota}</p>
          </div>
          <div className="drawer-foot" style={{ padding: '12px 20px' }}>
            <button className="btn outline" onClick={() => setValuaciones(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </>
  )
}

// ---------- estilos locales ----------

const chipLabel: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11,
  fontWeight: 600, color: '#6B5A50', background: '#fff',
  border: '1px solid #EADFD8', borderRadius: 999, padding: '3px 10px',
}
const chipInput: React.CSSProperties = {
  border: 'none', background: 'transparent', fontSize: 11, fontWeight: 600, color: '#1A2330',
}
const inputCompacto: React.CSSProperties = {
  width: '100%', minWidth: 60, border: '1px solid transparent', background: 'transparent',
  padding: '3px 6px', fontSize: 12, borderRadius: 6,
}
const btnMini: React.CSSProperties = { padding: '2px 5px' }
const modalOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(15,20,28,.55)', zIndex: 60,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
}
const modalCaja: React.CSSProperties = {
  background: '#fff', borderRadius: 14, padding: 20, width: 'min(880px, 100%)',
  boxShadow: '0 24px 60px rgba(0,0,0,.3)', maxHeight: '90vh', overflow: 'auto',
}
