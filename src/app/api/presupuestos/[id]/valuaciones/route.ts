import { NextResponse, NextRequest } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

interface BloqueVersion {
  presupuestoItemId: number | null
  pendiente?: boolean
  covenin?: string
  descripcion?: string
  unidad?: string
  aplicado?: boolean
  cantidadAplicada?: number
  cantidadVigenteAnterior?: number | null
}

/**
 * GET /api/presupuestos/[id]/valuaciones
 *
 * Fase 2 — consolidado de valuaciones por avance: cada "Aplicar al presupuesto"
 * guarda una versión con lo aplicado y lo que estaba vigente antes. El avance de
 * la valuación N es la diferencia (cantidadAplicada − cantidadVigenteAnterior)
 * por partida, multiplicada por su precio unitario. Reuniendo todas las versiones
 * del presupuesto queda la curva: valuación 0 (inicial), valuación 1, 2…
 * Montos con y sin IVA; los bloques pendientes de catálogo no aportan (sin partida).
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const presupuestoId = parseInt(id)
    const presupuesto = await db.presupuesto.findUnique({
      where: { id: presupuestoId },
      select: { id: true, nombre: true, ivaPct: true },
    })
    if (!presupuesto) return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })

    const computos = await db.computo.findMany({
      where: { presupuestoId },
      include: { versiones: { orderBy: { numero: 'asc' } } },
    })

    const items = await db.presupuestoItem.findMany({
      where: { presupuestoId },
      select: { id: true, covenin: true, descripcion: true, precioUnitarioBs: true },
    })
    const puPorItem = new Map(items.map(i => [i.id, i]))

    const mapa = new Map<number, {
      numero: number
      fecha: string
      partidas: Array<{ covenin: string; descripcion: string; unidad: string; delta: number; pu: number; monto: number }>
      computos: number[]
    }>()
    const sinVersiones: string[] = []

    for (const c of computos) {
      if (!c.versiones.length) {
        sinVersiones.push(c.nombre)
        continue
      }
      for (const v of c.versiones) {
        let registro = mapa.get(v.numero)
        if (!registro) {
          registro = { numero: v.numero, fecha: v.fecha.toISOString(), partidas: [], computos: [] }
          mapa.set(v.numero, registro)
        }
        registro.computos.push(c.id)
        let payload: { bloques?: BloqueVersion[] } | null = null
        try { payload = JSON.parse(v.payload) as { bloques?: BloqueVersion[] } } catch { payload = null }
        for (const b of payload?.bloques || []) {
          if (b.pendiente || !b.presupuestoItemId || !b.aplicado) continue
          const delta = (b.cantidadAplicada ?? 0) - (b.cantidadVigenteAnterior ?? 0)
          if (Math.abs(delta) < 1e-9) continue
          const item = puPorItem.get(b.presupuestoItemId)
          if (!item) continue
          const existente = registro.partidas.find(p => p.covenin === item.covenin)
          const monto = delta * item.precioUnitarioBs
          if (existente) {
            existente.delta += delta
            existente.monto += monto
          } else {
            registro.partidas.push({
              covenin: item.covenin,
              descripcion: item.descripcion,
              unidad: b.unidad || '',
              delta,
              pu: item.precioUnitarioBs,
              monto,
            })
          }
        }
      }
    }

    const factorSinIva = 1 / (1 + (presupuesto.ivaPct ?? 16) / 100)
    const valuaciones = [...mapa.values()]
      .sort((a, b) => a.numero - b.numero)
      .map(v => {
        const montoConIva = v.partidas.reduce((s, p) => s + p.monto, 0)
        return {
          numero: v.numero,
          fecha: v.fecha,
          computos: [...new Set(v.computos)],
          partidas: v.partidas.sort((a, b) => a.covenin.localeCompare(b.covenin)),
          montoConIvaBs: montoConIva,
          montoSinIvaBs: montoConIva * factorSinIva,
        }
      })
    let acumulado = 0
    const conAcumulado = valuaciones.map(v => {
      acumulado += v.montoConIvaBs
      return { ...v, acumuladoConIvaBs: acumulado }
    })

    return NextResponse.json({
      presupuesto: { id: presupuesto.id, nombre: presupuesto.nombre, ivaPct: presupuesto.ivaPct },
      valuaciones: conAcumulado,
      computosSinVersiones: sinVersiones,
      nota: 'El avance de cada valuación es la diferencia entre lo aplicado y lo vigente antes de aplicar; los montos usan el PU vigente del item.',
    })
  } catch (e: any) {
    console.error('GET valuaciones error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
