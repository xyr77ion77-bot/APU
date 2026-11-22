'use client'

import { useState, useEffect, useCallback } from 'react'
import { Download } from 'lucide-react'
import { Sidebar } from '@/components/civ/Sidebar'
import { Topbar } from '@/components/civ/Topbar'
import { CatalogoView } from '@/components/civ/CatalogoView'
import { APUDrawer } from '@/components/civ/APUDrawer'
import { PresupuestoView } from '@/components/civ/PresupuestoView'
import { ComputosView } from '@/components/civ/ComputosView'
import { GuardadosView } from '@/components/civ/GuardadosView'
import { TabuladorView } from '@/components/civ/TabuladorView'
import { ConfiguracionView } from '@/components/civ/ConfiguracionView'
import { RecientesView, guardarReciente } from '@/components/civ/RecientesView'
import { PARAMETROS_DEFAULT, type ParametrosCalculo } from '@/lib/calculo'
import type { ViewId, ItemPartida, GuiaInfo, PartidaDetalle } from '@/components/civ/types'

const PARAMS_KEY = 'civ-parametros'

function cargarParametros(): ParametrosCalculo {
  try {
    const raw = localStorage.getItem(PARAMS_KEY)
    if (raw) return { ...PARAMETROS_DEFAULT, ...JSON.parse(raw) }
  } catch { /* storage no disponible */ }
  return { ...PARAMETROS_DEFAULT }
}

export default function HomePage() {
  const [view, setView] = useState<ViewId>('catalogo')
  const [items, setItems] = useState<ItemPartida[]>([])
  const [parametros, setParametrosState] = useState<ParametrosCalculo>(PARAMETROS_DEFAULT)
  const [stats, setStats] = useState<{ partidas: number; insumos: number; guias: GuiaInfo[] } | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [detail, setDetail] = useState<PartidaDetalle | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [guardadosKey, setGuardadosKey] = useState(0)
  const [catalogoKey, setCatalogoKey] = useState(0) // incrementa al eliminar una partida → recarga el listado del catálogo

  // Cargar parámetros persistidos y stats al montar
  useEffect(() => {
    setParametrosState(cargarParametros())
    Promise.all([
      fetch('/api/stats/analisis').then(r => r.json()),
      fetch('/api/stats').then(r => r.json()),
    ])
      .then(([a, s]) => {
        setStats({
          partidas: a.partidas ?? 0,
          insumos: s?.totals?.insumos ?? 0,
          guias: a.porGuia ?? [],
        })
      })
      .catch(() => {})
  }, [])

  // Persistir parámetros cuando cambian
  useEffect(() => {
    try { localStorage.setItem(PARAMS_KEY, JSON.stringify(parametros)) } catch { /* noop */ }
  }, [parametros])

  // Toast con auto-cierre
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  // Escape cierra el drawer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const showToast = useCallback((msg: string) => setToast(msg), [])

  const setParametros = (p: ParametrosCalculo) => setParametrosState(p)

  const onOpenDetail = async (id: number) => {
    setDrawerOpen(true)
    setLoadingDetail(true)
    setDetail(null)
    try {
      const r = await fetch(`/api/analisis?id=${id}`)
      const d = await r.json()
      if (d?.partida) {
        setDetail(d)
        guardarReciente({
          id: d.partida.id,
          covenin: d.partida.covenin,
          descripcion: d.partida.descripcion,
          unidad: d.partida.unidad,
          rendimiento: d.partida.rendimiento,
          precioUnitarioBs: d.partida.calculo.precioUnitarioBs,
          costoDirectoUnitarioBs: d.partida.calculo.costoDirectoUnitarioBs,
          guiaNombre: d.partida.guiaNombre || '',
          ts: Date.now(),
        })
      } else {
        showToast(d?.error || 'No se pudo cargar la partida')
      }
    } catch {
      showToast('Error de red al cargar la partida')
    } finally {
      setLoadingDetail(false)
    }
  }

  const addToBudget = (item: ItemPartida) => {
    const existing = items.findIndex(i => i.partidaAnalisisId === item.partidaAnalisisId)
    if (existing >= 0) {
      const newItems = [...items]
      newItems[existing] = { ...newItems[existing], cantidad: newItems[existing].cantidad + 1 }
      setItems(newItems)
    } else {
      setItems([...items, item])
    }
    showToast('Partida agregada al presupuesto')
  }

  const exportarAPU = async (id: number, covenin: string) => {
    try {
      const r = await fetch(`/api/analisis/export?id=${id}`)
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: 'Error desconocido' }))
        showToast(`Error al exportar: ${err.error || r.statusText}`)
        return
      }
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const cd = r.headers.get('Content-Disposition') || ''
      const m = cd.match(/filename="([^"]+)"/)
      a.download = m ? m[1] : `APU_${covenin}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast(`APU ${covenin} exportado a Excel`)
    } catch {
      showToast('Error de red al exportar el APU')
    }
  }

  return (
    <div className="civ-app">
      <div className="app">
        <Sidebar view={view} onView={setView} itemCount={items.length} stats={stats} />
        <main className="main">
          <Topbar view={view} onOpenTabulador={() => setView('tabuladores')} />
          <section className="content">
            {view === 'catalogo' && (
              <CatalogoView
                guias={stats?.guias ?? []}
                onView={setView}
                onOpenDetail={onOpenDetail}
                onAdd={addToBudget}
                budgetCount={items.length}
                refreshKey={catalogoKey}
              />
            )}
            {view === 'presupuesto' && (
              <PresupuestoView
                items={items}
                setItems={setItems}
                parametros={parametros}
                onView={setView}
                onToast={showToast}
                onSaved={() => setGuardadosKey(k => k + 1)}
              />
            )}
            {view === 'computos' && (
              <ComputosView onToast={showToast} onView={setView} />
            )}
            {view === 'guardados' && (
              <GuardadosView onToast={showToast} refreshKey={guardadosKey} />
            )}
            {view === 'recientes' && (
              <RecientesView onOpenDetail={onOpenDetail} onAdd={addToBudget} onToast={showToast} />
            )}
            {view === 'tabuladores' && <TabuladorView onToast={showToast} />}
            {view === 'configuracion' && (
              <ConfiguracionView parametros={parametros} setParametros={setParametros} onToast={showToast} />
            )}
          </section>
        </main>
      </div>

      <APUDrawer
        open={drawerOpen}
        detail={detail}
        loading={loadingDetail}
        onClose={() => setDrawerOpen(false)}
        onExport={exportarAPU}
        onAdd={addToBudget}
        onGuardado={(id, mensaje) => {
          showToast(mensaje)
          onOpenDetail(id)
        }}
        onEliminado={mensaje => {
          showToast(mensaje)
          setDrawerOpen(false)
          setCatalogoKey(k => k + 1)
        }}
      />

      <div className={`toast${toast ? ' show' : ''}`} role="status">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          {toast?.startsWith('APU') && <Download size={13} strokeWidth={1.8} />}
          {toast}
        </span>
      </div>
    </div>
  )
}
