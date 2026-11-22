import { NextResponse, NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { calcularPresupuesto, totalizarPresupuesto, PARAMETROS_DEFAULT } from '@/lib/calculo'
import { calcularDesdeLineas, type ParametrosCalculo } from '@/lib/calculo-core'

export const dynamic = 'force-dynamic'

// Líneas de una partida personalizada (S/C) enviadas desde el editor de la UI
interface LineaMaterialIn { descripcion: string; unidad?: string; cantidad: number; costoBs: number }
interface LineaEquipoIn { descripcion: string; cantidad: number; cop?: number; costoBs: number }
interface LineaManoObraIn { cargo: string; cantidad: number; jornalBs: number }

interface ItemIn {
  partidaAnalisisId?: number   // partida del catálogo (APU de la BD)
  cantidad: number
  notas?: string
  seccion?: string
  // --- Solo para partidas personalizadas (S/C) ---
  codigo?: string              // p.ej. "S/C-TUBERIA" (autogenerado si falta)
  descripcion?: string
  unidad?: string
  rendimiento?: number
  precioDirectoBs?: number     // precio unitario estipulado SIN IVA (si no hay composición)
  materiales?: LineaMaterialIn[]
  equipos?: LineaEquipoIn[]
  manoObra?: LineaManoObraIn[]
}

/**
 * GET /api/presupuestos
 *   Lista todos los presupuestos guardados
 */
export async function GET() {
  try {
    const presupuestos = await db.presupuesto.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { items: true } } },
    })
    return NextResponse.json({
      items: presupuestos.map(p => ({
        id: p.id,
        nombre: p.nombre,
        cliente: p.cliente,
        obra: p.obra,
        fecha: p.fecha,
        itemCount: p._count.items,
        totalConIvaBs: p.totalConIvaBs,
        parametros: {
          fcasPct: p.fcasPct,
          ceduPct: p.ceduPct,
          bonoAlimenticioDiario: p.bonoAlimenticioDiario,
          administracionPct: p.administracionPct,
          utilidadPct: p.utilidadPct,
          ivaPct: p.ivaPct,
        },
        updatedAt: p.updatedAt,
        createdAt: p.createdAt,
      }))
    })
  } catch (e: any) {
    console.error('Presupuestos GET error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

/**
 * POST /api/presupuestos
 * Body: {
 *   nombre: string, cliente?, obra?, fecha?, descripcion?,
 *   parametros?: Partial<ParametrosCalculo>,
 *   items: [
 *     { partidaAnalisisId, cantidad, notas?, seccion? }                        // partida de la BD
 *     | { codigo?, descripcion, unidad, rendimiento, cantidad, notas?, seccion?, // partida S/C
 *         precioDirectoBs?, materiales?, equipos?, manoObra? }
 *   ]
 * }
 * Crea un presupuesto con partidas del catálogo y/o personalizadas (S/C) y recalcula
 * todos los precios unitarios con los parámetros del presupuesto.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nombre, cliente, obra, fecha, descripcion, parametros, items } = body as {
      nombre: string
      cliente?: string
      obra?: string
      fecha?: string
      descripcion?: string
      parametros?: Partial<ParametrosCalculo>
      items: ItemIn[]
    }

    if (!nombre) {
      return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Se requiere al menos 1 item' }, { status: 400 })
    }

    const paramsFinal: ParametrosCalculo = { ...PARAMETROS_DEFAULT, ...(parametros || {}) }

    // --- Calcular cada item en su posición original ---
    const scCounter = { n: items.filter(i => !i.partidaAnalisisId).length }
    const autoCodigo = () => `S/C-${String(scCounter.n++ + 1).padStart(3, '0')}`

    const calculados: Array<{
      esPersonalizada: boolean
      partidaAnalisisId: number | null
      covenin: string
      descripcion: string
      unidad: string
      cantidad: number
      rendimiento: number | null
      precioUnitarioBs: number
      totalBs: number
      notas: string | null
      seccion: string | null
      precioDirectoBs: number | null
      desglose?: ReturnType<typeof calcularDesdeLineas>
      // Líneas crudas para persistir (conservan COP de equipos)
      lineasRaw?: { mats: LineaMaterialIn[]; eqs: LineaEquipoIn[]; mos: LineaManoObraIn[] }
    }> = []

    for (const item of items) {
      const notas = item.notas || null
      const seccion = item.seccion?.trim() || null

      if (item.partidaAnalisisId) {
        // --- Partida del catálogo ---
        const [calc] = await calcularPresupuesto(
          [{ partidaAnalisisId: item.partidaAnalisisId, cantidad: item.cantidad }],
          paramsFinal,
        )
        if (!calc) continue
        calculados.push({
          esPersonalizada: false,
          partidaAnalisisId: calc.partidaAnalisisId,
          covenin: calc.covenin,
          descripcion: calc.descripcion,
          unidad: calc.unidad,
          cantidad: calc.cantidad,
          rendimiento: calc.rendimiento,
          precioUnitarioBs: calc.precioUnitarioBs,
          totalBs: calc.totalBs,
          notas,
          seccion,
          precioDirectoBs: null,
          desglose: calc.desglose,
        })
      } else {
        // --- Partida personalizada (S/C) ---
        const mats = item.materiales || []
        const eqs = item.equipos || []
        const mos = item.manoObra || []
        const tieneComposicion = mats.length + eqs.length + mos.length > 0
        const rendimiento = (item.rendimiento && item.rendimiento > 0) ? item.rendimiento : 1

        let precioUnitarioBs: number
        let desglose: ReturnType<typeof calcularDesdeLineas> | undefined
        let precioDirectoBs: number | null = null

        if (tieneComposicion) {
          desglose = calcularDesdeLineas(
            {
              rendimiento,
              materiales: mats.map(m => ({
                descripcion: m.descripcion,
                unidad: m.unidad,
                cantidad: m.cantidad,
                costoBs: m.costoBs,
              })),
              equipos: eqs.map(e => ({
                descripcion: e.descripcion,
                cantidad: e.cantidad,
                cop: e.cop,
                costoBs: e.costoBs,
              })),
              manoObra: mos.map(mo => ({
                cargo: mo.cargo,
                cantidad: mo.cantidad,
                jornalBs: mo.jornalBs,
              })),
            },
            paramsFinal,
          )
          precioUnitarioBs = desglose.precioUnitarioBs
        } else if (item.precioDirectoBs && item.precioDirectoBs > 0) {
          // Precio directo estipulado (sin desglose) — se interpreta SIN IVA
          precioDirectoBs = item.precioDirectoBs
          precioUnitarioBs = precioDirectoBs * (1 + paramsFinal.ivaPct / 100)
        } else {
          return NextResponse.json(
            { error: 'La partida personalizada requiere composición (materiales/equipos/mano de obra) o precioDirectoBs' },
            { status: 400 },
          )
        }

        calculados.push({
          esPersonalizada: true,
          partidaAnalisisId: null,
          covenin: item.codigo?.trim() || autoCodigo(),
          descripcion: item.descripcion?.trim() || 'Partida personalizada (S/C)',
          unidad: item.unidad?.trim() || 'global',
          cantidad: item.cantidad,
          rendimiento,
          precioUnitarioBs,
          totalBs: item.cantidad * precioUnitarioBs,
          notas,
          seccion,
          precioDirectoBs,
          desglose,
          lineasRaw: { mats, eqs, mos },
        })
      }
    }

    if (calculados.length === 0) {
      return NextResponse.json({ error: 'Ninguna partida válida en items' }, { status: 400 })
    }

    // --- Totalizar ---
    const itemsCalc = calculados.map(c => ({
      partidaAnalisisId: c.partidaAnalisisId,
      covenin: c.covenin,
      descripcion: c.descripcion,
      unidad: c.unidad,
      cantidad: c.cantidad,
      rendimiento: c.rendimiento,
      precioUnitarioBs: c.precioUnitarioBs,
      totalBs: c.totalBs,
      desglose: c.desglose,
    }))
    const totalizacion = totalizarPresupuesto(itemsCalc, paramsFinal, { nombre, cliente, obra, fecha, descripcion })

    // --- Guardar en DB (items con sus líneas de composición si son S/C) ---
    const presupuesto = await db.presupuesto.create({
      data: {
        nombre,
        cliente: cliente || null,
        obra: obra || null,
        fecha: fecha || null,
        descripcion: descripcion || null,
        fcasPct: paramsFinal.fcasPct,
        ceduPct: paramsFinal.ceduPct,
        bonoAlimenticioDiario: paramsFinal.bonoAlimenticioDiario,
        administracionPct: paramsFinal.administracionPct,
        utilidadPct: paramsFinal.utilidadPct,
        ivaPct: paramsFinal.ivaPct,
        totalCostoDirectoBs: totalizacion.subtotalCostoDirectoBs,
        totalAdministracionBs: totalizacion.subtotalAdministracionBs,
        totalUtilidadBs: totalizacion.subtotalUtilidadBs,
        totalSinIvaBs: totalizacion.subtotalSinIvaBs,
        totalIvaBs: totalizacion.totalIvaBs,
        totalConIvaBs: totalizacion.totalConIvaBs,
        items: {
          create: calculados.map((c, idx) => ({
            partidaAnalisisId: c.partidaAnalisisId,
            covenin: c.covenin,
            descripcion: c.descripcion,
            unidad: c.unidad,
            cantidad: c.cantidad,
            rendimiento: c.rendimiento,
            precioUnitarioBs: c.precioUnitarioBs,
            totalBs: c.totalBs,
            posicion: idx,
            notas: c.notas,
            seccion: c.seccion,
            esPersonalizada: c.esPersonalizada,
            ...(c.esPersonalizada
              ? {
                  materiales: {
                    create: (c.lineasRaw?.mats || []).map((m, i) => ({
                      descripcion: m.descripcion,
                      unidad: m.unidad ?? null,
                      cantidad: m.cantidad,
                      costoBs: m.costoBs,
                      totalBs: m.cantidad * m.costoBs,
                      posicion: i,
                    })),
                  },
                  equipos: {
                    create: (c.lineasRaw?.eqs || []).map((e, i) => ({
                      descripcion: e.descripcion,
                      cantidad: e.cantidad,
                      cop: e.cop ?? null,
                      costoBs: e.costoBs,
                      totalBs: e.cantidad * (e.cop ?? 1) * e.costoBs,
                      posicion: i,
                    })),
                  },
                  manoObra: {
                    create: (c.lineasRaw?.mos || []).map((mo, i) => ({
                      cargo: mo.cargo,
                      cantidad: mo.cantidad,
                      jornalBs: mo.jornalBs,
                      totalBs: mo.cantidad * mo.jornalBs,
                      posicion: i,
                    })),
                  },
                }
              : {}),
          })),
        },
      },
      include: { items: { include: { materiales: true, equipos: true, manoObra: true } } },
    })

    return NextResponse.json({
      presupuesto: {
        id: presupuesto.id,
        nombre: presupuesto.nombre,
        itemCount: presupuesto.items.length,
        totalConIvaBs: presupuesto.totalConIvaBs,
        totalSinIvaBs: presupuesto.totalSinIvaBs,
        totalIvaBs: presupuesto.totalIvaBs,
        parametros: paramsFinal,
      },
      calculo: totalizacion,
    })
  } catch (e: any) {
    console.error('Presupuestos POST error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
