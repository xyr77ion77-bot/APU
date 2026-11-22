import { NextResponse, NextRequest } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * POST /api/presupuestos/[id]/duplicar
 *
 * Crea una copia editable del presupuesto: cabecera (nombre "Copia de …",
 * parámetros y totales congelados) + todos los items con sus snapshots,
 * secciones y líneas S/C. Los cómputos NO se duplican (son el historial
 * reproducible del original); las cantidades ya aplicadas viajan en los items.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const origen = await db.presupuesto.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          orderBy: { posicion: 'asc' },
          include: { materiales: true, equipos: true, manoObra: true },
        },
      },
    })
    if (!origen) {
      return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })
    }

    const copia = await db.presupuesto.create({
      data: {
        nombre: `Copia de ${origen.nombre}`.slice(0, 120),
        cliente: origen.cliente,
        obra: origen.obra,
        fecha: origen.fecha,
        descripcion: origen.descripcion,
        fcasPct: origen.fcasPct,
        ceduPct: origen.ceduPct,
        bonoAlimenticioDiario: origen.bonoAlimenticioDiario,
        administracionPct: origen.administracionPct,
        utilidadPct: origen.utilidadPct,
        ivaPct: origen.ivaPct,
        totalCostoDirectoBs: origen.totalCostoDirectoBs,
        totalAdministracionBs: origen.totalAdministracionBs,
        totalUtilidadBs: origen.totalUtilidadBs,
        totalSinIvaBs: origen.totalSinIvaBs,
        totalIvaBs: origen.totalIvaBs,
        totalConIvaBs: origen.totalConIvaBs,
        items: {
          create: origen.items.map(item => ({
            partidaAnalisisId: item.partidaAnalisisId,
            covenin: item.covenin,
            descripcion: item.descripcion,
            unidad: item.unidad,
            cantidad: item.cantidad,
            rendimiento: item.rendimiento,
            precioUnitarioBs: item.precioUnitarioBs,
            totalBs: item.totalBs,
            posicion: item.posicion,
            seccion: item.seccion,
            esPersonalizada: item.esPersonalizada,
            notas: item.notas,
            materiales: {
              create: [...item.materiales]
                .sort((a, b) => a.posicion - b.posicion)
                .map(m => ({
                  descripcion: m.descripcion, unidad: m.unidad,
                  cantidad: m.cantidad, costoBs: m.costoBs,
                  totalBs: m.totalBs, posicion: m.posicion,
                })),
            },
            equipos: {
              create: [...item.equipos]
                .sort((a, b) => a.posicion - b.posicion)
                .map(e => ({
                  descripcion: e.descripcion, cantidad: e.cantidad,
                  cop: e.cop, costoBs: e.costoBs,
                  totalBs: e.totalBs, posicion: e.posicion,
                })),
            },
            manoObra: {
              create: [...item.manoObra]
                .sort((a, b) => a.posicion - b.posicion)
                .map(mo => ({
                  cargo: mo.cargo, cantidad: mo.cantidad,
                  jornalBs: mo.jornalBs, totalBs: mo.totalBs, posicion: mo.posicion,
                })),
            },
          })),
        },
      },
      include: { items: { include: { materiales: true, equipos: true, manoObra: true } } },
    })

    return NextResponse.json({
      presupuesto: { id: copia.id, nombre: copia.nombre, itemCount: copia.items.length },
      mensaje: `Presupuesto duplicado como #${copia.id}`,
    })
  } catch (e: any) {
    console.error('Duplicar presupuesto error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
