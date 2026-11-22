import { NextResponse, NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { calcularPartida, totalizarPresupuesto, PARAMETROS_DEFAULT, type ParametrosCalculo } from '@/lib/calculo'
import { calcularDesdeLineas } from '@/lib/calculo-core'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * GET /api/presupuestos/[id]
 * Devuelve un presupuesto con todos sus items y desglose completo.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const presupuesto = await db.presupuesto.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          orderBy: { posicion: 'asc' },
          include: {
            partidaAnalisis: {
              include: { materiales: true, equipos: true, manoObra: true },
            },
            materiales: true,
            equipos: true,
            manoObra: true,
          },
        },
      },
    })
    
    if (!presupuesto) {
      return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })
    }
    
    // Recalcular cada item con los parámetros del presupuesto
    const paramsFinal: ParametrosCalculo = {
      fcasPct: presupuesto.fcasPct,
      ceduPct: presupuesto.ceduPct,
      bonoAlimenticioDiario: presupuesto.bonoAlimenticioDiario,
      administracionPct: presupuesto.administracionPct,
      utilidadPct: presupuesto.utilidadPct,
      ivaPct: presupuesto.ivaPct,
    }
    
    const itemsConDesglose = presupuesto.items.map(item => {
      // Ordenar las líneas por posición para presentaciones estables
      const materiales = [...item.materiales].sort((a, b) => a.posicion - b.posicion)
      const equipos = [...item.equipos].sort((a, b) => a.posicion - b.posicion)
      const manoObra = [...item.manoObra].sort((a, b) => a.posicion - b.posicion)
      const esPersonalizada = item.esPersonalizada

      // Desglose: partidas de BD recalculan desde el APU; S/C desde sus líneas;
      // S/C sin composición = precio directo estipulado (PU sin IVA derivado)
      let calculo = null as ReturnType<typeof calcularPartida> | null
      if (item.partidaAnalisis) {
        calculo = calcularPartida(item.partidaAnalisis, paramsFinal)
      } else if (esPersonalizada && (materiales.length + equipos.length + manoObra.length) > 0) {
        calculo = calcularDesdeLineas(
          {
            rendimiento: item.rendimiento || 1,
            materiales: materiales.map(m => ({
              descripcion: m.descripcion, unidad: m.unidad,
              cantidad: m.cantidad, costoBs: m.costoBs,
            })),
            equipos: equipos.map(e => ({
              descripcion: e.descripcion, cantidad: e.cantidad,
              cop: e.cop, costoBs: e.costoBs,
            })),
            manoObra: manoObra.map(mo => ({
              cargo: mo.cargo, cantidad: mo.cantidad, jornalBs: mo.jornalBs,
            })),
          },
          paramsFinal,
        )
      }

      return {
        id: item.id,
        posicion: item.posicion,
        partidaAnalisisId: item.partidaAnalisisId,
        covenin: item.covenin,
        descripcion: item.descripcion,
        unidad: item.unidad,
        cantidad: item.cantidad,
        rendimiento: item.rendimiento,
        precioUnitarioBs: item.precioUnitarioBs,
        totalBs: item.totalBs,
        notas: item.notas,
        seccion: item.seccion,
        esPersonalizada,
        // Para S/C con precio directo: PU estipulado sin IVA (para recargar en el editor)
        precioDirectoBs: (esPersonalizada && materiales.length + equipos.length + manoObra.length === 0)
          ? item.precioUnitarioBs / (1 + paramsFinal.ivaPct / 100)
          : null,
        // Composición: de las líneas S/C propias o del APU de la BD
        composicion: esPersonalizada
          ? { materiales, equipos, manoObra }
          : item.partidaAnalisis
            ? { materiales: item.partidaAnalisis.materiales, equipos: item.partidaAnalisis.equipos, manoObra: item.partidaAnalisis.manoObra }
            : null,
        desglose: calculo,
      }
    })
    
    const totalizacion = totalizarPresupuesto(
      itemsConDesglose.map(i => ({
        partidaAnalisisId: i.partidaAnalisisId,
        covenin: i.covenin,
        descripcion: i.descripcion,
        unidad: i.unidad,
        cantidad: i.cantidad,
        rendimiento: i.rendimiento,
        precioUnitarioBs: i.precioUnitarioBs,
        totalBs: i.totalBs,
        desglose: i.desglose ?? undefined,
      })),
      paramsFinal,
      { nombre: presupuesto.nombre, cliente: presupuesto.cliente, obra: presupuesto.obra, fecha: presupuesto.fecha, descripcion: presupuesto.descripcion },
    )
    
    return NextResponse.json({
      presupuesto: {
        id: presupuesto.id,
        nombre: presupuesto.nombre,
        cliente: presupuesto.cliente,
        obra: presupuesto.obra,
        fecha: presupuesto.fecha,
        descripcion: presupuesto.descripcion,
        parametros: paramsFinal,
        createdAt: presupuesto.createdAt,
        updatedAt: presupuesto.updatedAt,
      },
      items: itemsConDesglose,
      totalizacion,
    })
  } catch (e: any) {
    console.error('Presupuesto GET error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

/**
 * DELETE /api/presupuestos/[id]
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    await db.presupuesto.delete({ where: { id: parseInt(id) } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('Presupuesto DELETE error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
