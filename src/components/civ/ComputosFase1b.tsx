'use client'

/**
 * Fase 1b del módulo de cómputos — UI:
 *  - Panel de elementos constructivos (muro/losa/columna/paño) con vanos
 *    instanciados y biblioteca de vanos tipo a nivel de obra.
 *  - Asignación de elemento fuente por bloque (aviso "medir dos veces").
 *  - Regeneración de filas con vista previa (cambia la geometría y las
 *    cantidades de todas las partidas alimentadas se actualizan).
 *  - Plantilla de tipología: muro de bloque de 15 cm (Tabla 5 del contrato).
 */

import { useEffect, useState } from 'react'
import { Plus, X, RefreshCw, LayoutTemplate, Loader2, Trash2, AlertTriangle } from 'lucide-react'

export interface VanoUI {
  id: number
  nombre: string
  tipo: string
  ancho: number
  alto: number
  antepecho: number
  cantidad: number
  generaCarpinteria: boolean
}

export interface ElementoUI {
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

export interface BloqueInfoUI {
  id: number
  covenin: string
  descripcion: string
  pendiente: boolean
  elementoId: number | null
  avisoElemento: string | null
}

export interface PreviewGenUI {
  bloqueId: number
  partida: string
  modo: string
  elementoDescripcion: string
  filasGeneradas: Array<{ descripcion: string; expresion: string; signo: string; cantidad: number; aviso?: string }>
  netaVigente: number
  netaGenerada: number
  diferencia: number
  avisos: string[]
}

const TIPOS = [
  { id: 'muro', ayuda: 'largo × alto · espesor 15/20 · caras 1|2' },
  { id: 'losa', ayuda: 'largo × ancho · espesor para volumen' },
  { id: 'columna', ayuda: 'ancho × alto (sección) × largo (altura)' },
  { id: 'paño', ayuda: 'largo × alto' },
]

const num = (s: string, def = 0): number => {
  const v = parseFloat((s || '').replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(v) ? v : def
}

const fmt = (n: number, d = 2) =>
  (Math.round(n * 100) / 100).toLocaleString('es-VE', { minimumFractionDigits: d, maximumFractionDigits: d })

// ------------------------------------------------------------------
// Panel de elementos + plantilla + regeneración
// ------------------------------------------------------------------
export function ElementosPanel({ computoId, elementos, bloques, presId, onRefresh, onToast }: {
  computoId: number
  elementos: ElementoUI[]
  bloques: BloqueInfoUI[]
  presId: number | null
  onRefresh: () => Promise<void>
  onToast: (m: string) => void
}) {
  const [abierto, setAbierto] = useState(true)
  const [formAbierto, setFormAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [preview, setPreview] = useState<PreviewGenUI[] | null>(null)
  const [regenerando, setRegenerando] = useState(false)
  const [biblioteca, setBiblioteca] = useState<Array<{ id: number; nombre: string; tipo: string; ancho: number; alto: number; antepecho: number; generaCarpinteria: boolean }>>([])
  const [insertando, setInsertando] = useState(false)

  // Formulario de elemento
  const [tipo, setTipo] = useState('muro')
  const [descripcion, setDescripcion] = useState('')
  const [nivel, setNivel] = useState('')
  const [ambiente, setAmbiente] = useState('')
  const [largo, setLargo] = useState('')
  const [ancho, setAncho] = useState('')
  const [alto, setAlto] = useState('')
  const [espesor, setEspesor] = useState('')
  const [caras, setCaras] = useState('1')
  const [vanosForm, setVanosForm] = useState<Array<{ nombre: string; tipo: string; ancho: string; alto: string; antepecho: string; cantidad: string; generaCarpinteria: boolean }>>([])

  const cargarBiblioteca = async () => {
    if (!presId) return
    try {
      const r = await fetch(`/api/vanos-tipo?presupuestoId=${presId}`)
      const data = await r.json()
      setBiblioteca(data.items || [])
    } catch { /* silencioso */ }
  }
  useEffect(() => { cargarBiblioteca() }, [presId]) // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = () => {
    setTipo('muro'); setDescripcion(''); setNivel(''); setAmbiente('')
    setLargo(''); setAncho(''); setAlto(''); setEspesor(''); setCaras('1'); setVanosForm([])
  }

  const crearElemento = async () => {
    if (!descripcion.trim()) { onToast('La descripción del elemento es obligatoria'); return }
    setGuardando(true)
    try {
      const r = await fetch(`/api/computos/${computoId}/elementos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo, descripcion, nivel, ambiente,
          largo: num(largo), ancho: num(ancho), alto: num(alto),
          espesor: num(espesor), caras: num(caras, 1),
          vanos: vanosForm.map(v => ({
            nombre: v.nombre, tipo: v.tipo, ancho: num(v.ancho), alto: num(v.alto),
            antepecho: num(v.antepecho), cantidad: num(v.cantidad, 1), generaCarpinteria: v.generaCarpinteria,
          })),
        }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Error al crear')
      onToast(`Elemento "${descripcion}" creado${vanosForm.length ? ` con ${vanosForm.length} vano(s)` : ''}`)
      resetForm()
      setFormAbierto(false)
      await onRefresh()
    } catch (e: any) { onToast(`Error: ${e.message}`) }
    finally { setGuardando(false) }
  }

  const borrarElemento = async (el: ElementoUI) => {
    if (!confirm(`¿Eliminar el elemento "${el.descripcion}"? Sus filas generadas quedan desvinculadas (huérfanas).`)) return
    try {
      const r = await fetch(`/api/computos/elementos/${el.id}`, { method: 'DELETE' })
      const data = await r.json()
      if (!r.ok) throw new Error('Error al eliminar')
      await onRefresh()
      onToast(data.aviso || 'Elemento eliminado')
    } catch (e: any) { onToast(`Error: ${e.message}`) }
  }

  const guardarVanoEnBiblioteca = async (v: { nombre: string; tipo: string; ancho: string; alto: string; antepecho: string; generaCarpinteria: boolean }, idx: number) => {
    if (!presId) return
    try {
      const r = await fetch('/api/vanos-tipo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presupuestoId: presId,
          nombre: `${v.nombre} ${v.tipo} ${num(v.ancho)}×${num(v.alto)}`,
          tipo: v.tipo, ancho: num(v.ancho), alto: num(v.alto),
          antepecho: num(v.antepecho), generaCarpinteria: v.generaCarpinteria,
        }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      onToast(`"${data.vano.nombre}" guardado en la biblioteca de la obra`)
      await cargarBiblioteca()
      setVanosForm(fs => fs.map((f, i) => i === idx ? { ...f, vanoTipoId: data.vano.id } : f) as typeof fs)
    } catch (e: any) { onToast(`Error: ${e.message}`) }
  }

  const usarDeBiblioteca = (id: number) => {
    const v = biblioteca.find(x => x.id === id)
    if (!v) return
    const n = elementos.flatMap(e => e.vanos).length + vanosForm.length + 1
    setVanosForm(fs => [...fs, {
      nombre: `V-${String(n).padStart(2, '0')}`, tipo: v.tipo,
      ancho: String(v.ancho).replace('.', ','), alto: String(v.alto).replace('.', ','),
      antepecho: String(v.antepecho).replace('.', ','),
      cantidad: '1', generaCarpinteria: v.generaCarpinteria,
    }])
  }

  const asignarFuente = async (bloqueId: number, elementoId: number | null) => {
    try {
      const r = await fetch(`/api/computos/bloques/${bloqueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elementoId }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Error al asignar')
      await onRefresh()
      onToast(elementoId ? 'Elemento asignado como fuente del bloque' : 'Fuente quitada del bloque')
    } catch (e: any) { onToast(`Error: ${e.message}`) }
  }

  const previsualizarRegeneracion = async () => {
    try {
      const r = await fetch(`/api/computos/${computoId}/generar`)
      const data = await r.json()
      setPreview(data.preview || [])
    } catch (e: any) { onToast(`Error: ${e.message}`) }
  }

  const confirmarRegeneracion = async () => {
    setRegenerando(true)
    try {
      const r = await fetch(`/api/computos/${computoId}/generar`, { method: 'POST' })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Error al regenerar')
      onToast(`${data.regenerados} bloque(s) regenerados desde sus elementos — filas manuales intactas`)
      setPreview(null)
      await onRefresh()
    } catch (e: any) { onToast(`Error: ${e.message}`) }
    finally { setRegenerando(false) }
  }

  const insertarPlantillaAhora = () => insertarPlantilla(computoId, setInsertando, onToast, onRefresh)

  const bloquesSinFuente = bloques.filter(b => b.elementoId === null)

  return (
    <div className="panel-card" style={{ marginBottom: 14 }}>
      <div className="panel-title">
        Elementos del cómputo <span>{elementos.length} elemento(s) · fases 1b</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <button className="btn outline small" onClick={() => setFormAbierto(a => !a)}>
          <Plus size={13} /> {formAbierto ? 'Cerrar formulario' : 'Nuevo elemento'}
        </button>
        <button className="btn outline small" onClick={previsualizarRegeneracion} disabled={elementos.length === 0}>
          <RefreshCw size={13} /> Regenerar filas desde elementos
        </button>
        <button className="btn outline small" onClick={insertarPlantillaAhora} disabled={insertando}>
          {insertando ? <Loader2 size={13} className="animate-spin" /> : <LayoutTemplate size={13} />} Plantilla muro bloque 15
        </button>
      </div>

      {formAbierto && (
        <div style={{ border: '1px solid #e6ebf0', borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
            <div>
              <label className="field-label">Tipo</label>
              <select className="field-input" value={tipo} onChange={e => setTipo(e.target.value)}>
                {TIPOS.map(t => <option key={t.id} value={t.id}>{t.id} — {t.ayuda}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="field-label">Descripción *</label>
              <input className="field-input" value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="P.ej. MURO E-01 BAÑO 1" />
            </div>
            <div>
              <label className="field-label">Nivel</label>
              <input className="field-input" value={nivel} onChange={e => setNivel(e.target.value)} placeholder="Nivel 1" />
            </div>
            <div>
              <label className="field-label">Ambiente</label>
              <input className="field-input" value={ambiente} onChange={e => setAmbiente(e.target.value)} placeholder="BAÑO 1" />
            </div>
            <div>
              <label className="field-label">Largo (m)</label>
              <input className="field-input" value={largo} onChange={e => setLargo(e.target.value)} inputMode="decimal" />
            </div>
            {tipo !== 'muro' && tipo !== 'paño' && (
              <div>
                <label className="field-label">Ancho (m)</label>
                <input className="field-input" value={ancho} onChange={e => setAncho(e.target.value)} inputMode="decimal" />
              </div>
            )}
            {tipo === 'muro' || tipo === 'paño' || tipo === 'columna' ? (
              <div>
                <label className="field-label">{tipo === 'columna' ? 'Sección alto (m)' : 'Alto (m)'}</label>
                <input className="field-input" value={alto} onChange={e => setAlto(e.target.value)} inputMode="decimal" />
              </div>
            ) : null}
            <div>
              <label className="field-label">{tipo === 'columna' ? 'Largo/altura (m)' : 'Espesor (cm/mm según partida)'}</label>
              <input className="field-input" value={tipo === 'columna' ? largo : espesor}
                onChange={e => tipo === 'columna' ? setLargo(e.target.value) : setEspesor(e.target.value)} inputMode="decimal" />
            </div>
            {tipo === 'muro' && (
              <div>
                <label className="field-label">Caras de acabado</label>
                <select className="field-input" value={caras} onChange={e => setCaras(e.target.value)}>
                  <option value="1">1 cara</option>
                  <option value="2">2 caras</option>
                </select>
              </div>
            )}
          </div>

          {/* Vanos */}
          <div className="section-title" style={{ marginTop: 10 }}><strong>Vanos y aparatos del elemento</strong><span>{vanosForm.length}</span></div>
          {biblioteca.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <label className="field-label">Usar vano de la biblioteca de la obra</label>
              <select className="field-input" value="" onChange={e => { if (e.target.value) usarDeBiblioteca(parseInt(e.target.value)) }}>
                <option value="">— Elegir y agregar —</option>
                {biblioteca.map(v => (
                  <option key={v.id} value={v.id}>{v.nombre} ({v.tipo} {v.ancho}×{v.alto}{v.antepecho ? ` · antepecho ${v.antepecho}` : ''})</option>
                ))}
              </select>
            </div>
          )}
          {vanosForm.map((v, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 80px 70px 70px 80px 60px 1fr 32px', gap: 6, alignItems: 'center', marginBottom: 6 }}>
              <input className="field-input" value={v.nombre} onChange={e => setVanosForm(fs => fs.map((f, j) => j === i ? { ...f, nombre: e.target.value } : f))} placeholder="V-01" />
              <select className="field-input" value={v.tipo} onChange={e => setVanosForm(fs => fs.map((f, j) => j === i ? { ...f, tipo: e.target.value } : f))}>
                {['puerta', 'ventana', 'celosia', 'ducha', 'aparato'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input className="field-input" value={v.ancho} onChange={e => setVanosForm(fs => fs.map((f, j) => j === i ? { ...f, ancho: e.target.value } : f))} placeholder="ancho" inputMode="decimal" title="Ancho (m)" />
              <input className="field-input" value={v.alto} onChange={e => setVanosForm(fs => fs.map((f, j) => j === i ? { ...f, alto: e.target.value } : f))} placeholder="alto" inputMode="decimal" title="Alto (m)" />
              <input className="field-input" value={v.antepecho} onChange={e => setVanosForm(fs => fs.map((f, j) => j === i ? { ...f, antepecho: e.target.value } : f))} placeholder="antepecho" inputMode="decimal" title="Antepecho (m)" />
              <input className="field-input" value={v.cantidad} onChange={e => setVanosForm(fs => fs.map((f, j) => j === i ? { ...f, cantidad: e.target.value } : f))} placeholder="cant." inputMode="numeric" title="Cantidad" />
              <label style={{ fontSize: 10, color: '#768396', display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="checkbox" checked={v.generaCarpinteria} onChange={e => setVanosForm(fs => fs.map((f, j) => j === i ? { ...f, generaCarpinteria: e.target.checked } : f))} />
                genera carpintería
              </label>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="row-icon" title="Guardar en la biblioteca de la obra" onClick={() => guardarVanoEnBiblioteca(v, i)}>★</button>
                <button className="row-icon danger" title="Quitar vano" onClick={() => setVanosForm(fs => fs.filter((_, j) => j !== i))}><X size={12} /></button>
              </div>
            </div>
          ))}
          <button className="btn outline small" onClick={() => setVanosForm(fs => [...fs, {
            nombre: `V-${String(fs.length + elementos.flatMap(e => e.vanos).length + 1).padStart(2, '0')}`,
            tipo: 'puerta', ancho: '', alto: '', antepecho: '', cantidad: '1', generaCarpinteria: false,
          }])}>
            <Plus size={13} /> Vano manual
          </button>
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button className="btn" onClick={crearElemento} disabled={guardando}>
              {guardando ? <Loader2 size={14} className="animate-spin" /> : null} Crear elemento
            </button>
            <button className="btn outline" onClick={resetForm}>Limpiar</button>
          </div>
        </div>
      )}

      {/* Lista de elementos */}
      {elementos.length > 0 ? (
        <div className="table-scroll">
          <table className="apu-table">
            <thead>
              <tr><th>TIPO</th><th>DESCRIPCIÓN</th><th>NIVEL / AMBIENTE</th><th>GEOMETRÍA</th><th>VANOS</th><th>ALIMENTA</th><th /></tr>
            </thead>
            <tbody>
              {elementos.map(el => (
                <tr key={el.id}>
                  <td><span className="unit-tag">{el.tipo}</span></td>
                  <td><strong>{el.descripcion}</strong></td>
                  <td style={{ fontSize: 10 }}>{[el.nivel, el.ambiente].filter(Boolean).join(' · ') || '—'}</td>
                  <td style={{ fontSize: 10 }}>
                    {el.tipo === 'columna'
                      ? `${fmt(el.ancho)}×${fmt(el.alto)} m · L ${fmt(el.largo)} m`
                      : `${fmt(el.largo)}${el.ancho ? `×${fmt(el.ancho)}` : ''}×${el.alto ? fmt(el.alto) : ''}${el.espesor ? ` e=${fmt(el.espesor)}` : ''}${el.tipo === 'muro' ? ` · ${el.caras} cara(s)` : ''}`}
                  </td>
                  <td style={{ fontSize: 10 }}>
                    {el.vanos.length === 0 ? '—' : el.vanos.map(v => `${v.nombre} ${v.ancho}×${v.alto}`).join(', ')}
                  </td>
                  <td style={{ fontSize: 10 }}>{el.bloques.length} bloque(s)</td>
                  <td>
                    <button className="row-icon danger" title="Eliminar elemento" onClick={() => borrarElemento(el)}><Trash2 size={12} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ fontSize: 11, color: '#99a4b1', margin: '4px 0 0' }}>
          Sin elementos todavía. Crea un muro con sus vanos y asígnalo como fuente a los bloques:
          cambiar la altura del muro regenera todas las partidas alimentadas con vista previa.
        </p>
      )}

      {/* Asignación de fuente por bloque */}
      <div className="section-title" style={{ marginTop: 12 }}><strong>Fuente de cada bloque</strong><span>{bloquesSinFuente.length} sin elemento</span></div>
      {bloques.length === 0 ? (
        <p style={{ fontSize: 11, color: '#99a4b1', margin: 0 }}>Este cómputo aún no tiene bloques: agrega partidas del presupuesto o inserta la plantilla.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 8 }}>
          {bloques.map(b => (
            <div key={b.id} style={{ border: '1px solid #eef1f5', borderRadius: 8, padding: '6px 10px', background: b.pendiente ? '#fffdf5' : '#fff' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#1c2939', display: 'flex', gap: 6, alignItems: 'center' }}>
                <span className="code">{b.covenin}</span>
                {b.pendiente && <span className="sc-badge">pendiente</span>}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#768396', fontWeight: 500 }}>{b.descripcion.slice(0, 46)}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                <select
                  className="field-input"
                  style={{ height: 26, fontSize: 10, flex: 1 }}
                  value={b.elementoId ?? ''}
                  onChange={e => asignarFuente(b.id, e.target.value ? parseInt(e.target.value) : null)}
                >
                  <option value="">— sin elemento fuente (filas manuales) —</option>
                  {elementos.map(el => <option key={el.id} value={el.id}>{el.descripcion}</option>)}
                </select>
              </div>
              {b.avisoElemento && (
                <div style={{ fontSize: 9, color: '#9a5b00', marginTop: 3, display: 'flex', gap: 4 }}>
                  <AlertTriangle size={11} /> {b.avisoElemento}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal de regeneración */}
      {preview !== null && (
        <RegenerarModal
          preview={preview}
          regenerando={regenerando}
          onConfirm={confirmarRegeneracion}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  )
}

// ------------------------------------------------------------------
// Modal: vista previa de la regeneración
// ------------------------------------------------------------------
function RegenerarModal({ preview, regenerando, onConfirm, onClose }: {
  preview: PreviewGenUI[]
  regenerando: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <>
      <div className="overlay show" onClick={onClose} />
      <div className="sc-dialog" role="dialog" aria-label="Vista previa de regeneración" style={{ width: 'min(860px, calc(100vw - 24px))' }}>
        <div className="drawer-head" style={{ padding: '16px 20px 12px' }}>
          <div className="drawer-head-top">
            <span className="eyebrow">Vista previa · fase 1b</span>
            <button className="close-btn" onClick={onClose} aria-label="Cerrar"><X size={14} /></button>
          </div>
          <h2 style={{ margin: '4px 0 0' }}>Regenerar filas desde elementos</h2>
          <p style={{ fontSize: 10, color: '#768396', margin: '4px 0 0' }}>
            {preview.length} bloque(s) con elemento fuente. Las filas manuales y las de vínculo roto NUNCA se tocan.
          </p>
        </div>
        <div className="sc-dialog-body">
          {preview.length === 0 ? (
            <p style={{ fontSize: 11, color: '#99a4b1' }}>Ningún bloque tiene elemento fuente asignado todavía.</p>
          ) : (
            <div className="table-scroll">
              <table className="apu-table">
                <thead>
                  <tr><th>PARTIDA</th><th>MODO</th><th>NETA VIGENTE</th><th>NUEVA</th><th>DIF.</th><th>FILAS QUE SE GENERAN</th></tr>
                </thead>
                <tbody>
                  {preview.map(p => (
                    <tr key={p.bloqueId}>
                      <td style={{ maxWidth: 240 }}><strong style={{ fontSize: 10 }}>{p.partida}</strong></td>
                      <td><span className="unit-tag">{p.modo}</span></td>
                      <td style={{ textAlign: 'right' }}>{fmt(p.netaVigente)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(p.netaGenerada)}</td>
                      <td style={{ textAlign: 'right', color: Math.abs(p.diferencia) > 1e-9 ? (p.diferencia > 0 ? '#17703c' : '#b02424') : '#768396' }}>
                        {p.diferencia >= 0 ? '+' : ''}{fmt(p.diferencia)}
                      </td>
                      <td style={{ fontSize: 9, maxWidth: 300 }}>
                        {p.filasGeneradas.map((f, i) => (
                          <div key={i} title={f.expresion}>
                            {f.signo === '-' ? '− ' : ''}{f.descripcion}
                            {f.aviso ? <span style={{ color: '#9a5b00' }}> · {f.aviso}</span> : null}
                          </div>
                        ))}
                        {p.avisos.map((a, i) => <div key={`a${i}`} style={{ color: '#9a5b00' }}>⚠ {a}</div>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="drawer-foot" style={{ padding: '12px 20px' }}>
          <button className="btn outline" onClick={onClose}>Cancelar</button>
          <button className="btn" onClick={onConfirm} disabled={regenerando || preview.length === 0}>
            {regenerando ? <Loader2 size={14} className="animate-spin" /> : null} Regenerar {preview.length} bloque(s)
          </button>
        </div>
      </div>
    </>
  )
}

// ------------------------------------------------------------------
// Plantilla muro bloque 15 (Tabla 5 del contrato)
// ------------------------------------------------------------------
export async function insertarPlantilla(
  computoId: number,
  setLoading: (v: boolean) => void,
  onToast: (m: string) => void,
  onRefresh: () => Promise<void>,
) {
  setLoading(true)
  try {
    const r = await fetch(`/api/computos/${computoId}/plantilla`, { method: 'POST' })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error || 'Error al insertar plantilla')
    onToast(`Plantilla insertada: ${data.bloquesCreados} bloques (${data.conPartida.length} con partida · ${data.pendientes.length} pendientes de catálogo)`)
    await onRefresh()
  } catch (e: any) {
    onToast(`Error: ${e.message}`)
  } finally {
    setLoading(false)
  }
}
