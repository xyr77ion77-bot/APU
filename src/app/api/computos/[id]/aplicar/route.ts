import { NextResponse, NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { obtenerComputoCompleto, previsualizarAplicacion } from '@/lib/computos-server'
import { calcularPresupuesto, totalizarPresupuesto, PARAMETROS_DEFAULT, type ParametrosCalculo } from '@/lib/calculo'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * POST /api/computos/[id]/aplicar { confirmar?: boolean }
 *
 * A1: actualiza la cantidad de partidas EXISTENTES del presupuesto (nunca crea
 * partidas). Sin `confirmar` devuelve solo la vista previa comparativa partida
 * por partida; con `confirmar: true` aplica y guarda una versión (snapshot
 * inmutable, D) para que la cantidad aplicada sea reproducible.
 *
 * La cantidad que viaja al presupuesto respeta el modo de desperdicio (C/F1):
 *   - sobre_pu  → la neta (el % vive en el precio unitario)
 *   - en_cantidad / ambos → la neta inflada con el %
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const computoId = parseInt(id)
    let confirmar = false
    try {
      const body = await req.json()
      confirmar = body?.confirmar === true
    } catch { /* sin cuerpo: solo preview */ }

    const computo = await obtenerComputoCompleto(computoId)
    if (!computo) return NextResponse.json({ error: 'Cómputo no encontrado' }, { status: 404 })

    const preview = previsualizarAplicacion(computo)
    if (!confirmar) {
      return NextResponse.json({ preview, confirmado: false })
    }

    if (computo.bloques.length === 0) {
      return NextResponse.json({ error: 'El cómputo no tiene bloques que aplicar' }, { status: 400 })
    }

    // Bloques con advertencia bloqueante: ajuste sin justificación no puede aplicar
    const sinJustificacion = computo.bloques.filter(
      b => b.resumen.hayAjuste && !(b.justificacion || '').trim(),
    )
    if (sinJustificacion.length > 0) {
      return NextResponse.json({
        error: 'Hay ajustes adoptados sin justificación; complétalos antes de aplicar',
        bloques: sinJustificacion.map(b => b.id),
      }, { status: 400 })
    }

    // Bloques sin medir (sin filas y sin ajuste) y bloques "pendiente de
    // catálogo" (sin partida) NO se aplican: evita poner en cero la cantidad
    // vigente de una partida que aún no fue medida o que no existe aún.
    const porAplicar = preview.filter(p => p.aplica && !p.pendiente)
    if (porAplicar.length === 0) {
      return NextResponse.json({
        error: 'Ningún bloque está medido: agrega filas o un ajuste adoptado antes de aplicar',
      }, { status: 400 })
    }

    // 1) Actualizar cantidades de las partidas medidas (snapshot de precio intacto)
    for (const p of porAplicar) {
      const bloque = computo.bloques.find(b => b.id === p.bloqueId)
      if (!bloque?.item) continue // bloque pendiente de catálogo: sin item que actualizar
      await db.presupuestoItem.update({
        where: { id: bloque.item.id },
        data: {
          cantidad: p.cantidadAplicada,
          totalBs: p.cantidadAplicada * bloque.item.precioUnitarioBs,
        },
      })
    }

    // 2) Versión reproducible (snapshot inmutable de lo aplicado, D)
    const ultima = await db.computoVersion.findFirst({
      where: { computoId }, orderBy: { numero: 'desc' },
    })
    const numeroVersion = (ultima?.numero ?? 0) + 1
    const payload = {
      fecha: new Date().toISOString(),
      valuacion: computo.valuacion,
      firmas: {
        medidoPor: computo.medidoPor,
        contratista: computo.contratista,
        inspector: computo.inspector,
        residente: computo.residente,
      },
      bloques: computo.bloques.map(b => ({
        presupuestoItemId: b.item?.id ?? null,
        pendiente: b.pendiente,
        covenin: b.item?.covenin ?? b.covenin ?? 'S/C',
        descripcion: b.item?.descripcion ?? b.descripcionPendiente ?? 'Pendiente de catálogo',
        unidad: b.item?.unidad ?? b.unidadPendiente ?? '',
        modo: b.regla.modo,
        aplicado: !b.pendiente && (b.filas.length > 0 || b.resumen.hayAjuste),
        desperdicio: { modo: b.regla.desperdicioModo, pct: b.regla.desperdicioPct },
        cantidadNeta: b.resumen.cantidadNeta,
        ajusteAdoptado: b.ajusteAdoptado,
        justificacion: b.justificacion,
        cantidadAplicada: b.resumen.cantidadAlPresupuesto,
        cantidadVigenteAnterior: b.item?.cantidad ?? null,
        filas: b.filas.map(f => ({
          descripcion: f.descripcion, tipo: f.tipo, numero: f.numero,
          largo: f.largo, ancho: f.ancho, alto: f.alto, valorDirecto: f.valorDirecto,
          signo: f.signo, expresion: f.expresion, cantidad: f.cantidad,
        })),
      })),
    }
    await db.computoVersion.create({
      data: { computoId, numero: numeroVersion, payload: JSON.stringify(payload) },
    })

    // 3) Totales del presupuesto con el mismo pipeline del guardado
    const presupuesto = await db.presupuesto.findUnique({
      where: { id: computo.presupuestoId },
      include: { items: true },
    })
    let totales: Record<string, number> | null = null
    if (presupuesto) {
      const paramsFinal: ParametrosCalculo = {
        fcasPct: presupuesto.fcasPct,
        ceduPct: presupuesto.ceduPct,
        bonoAlimenticioDiario: presupuesto.bonoAlimenticioDiario,
        administracionPct: presupuesto.administracionPct,
        utilidadPct: presupuesto.utilidadPct,
        ivaPct: presupuesto.ivaPct,
      }
      const conPartida = presupuesto.items.filter(i => i.partidaAnalisisId !== null)
      if (conPartida.length > 0) {
        const itemsCalculados = await calcularPresupuesto(
          conPartida.map(i => ({ partidaAnalisisId: i.partidaAnalisisId as number, cantidad: i.cantidad })),
          paramsFinal,
        )
        const totalizacion = totalizarPresupuesto(itemsCalculados, paramsFinal, {})
        totales = {
          totalCostoDirectoBs: totalizacion.subtotalCostoDirectoBs,
          totalAdministracionBs: totalizacion.subtotalAdministracionBs,
          totalUtilidadBs: totalizacion.subtotalUtilidadBs,
          totalSinIvaBs: totalizacion.subtotalSinIvaBs,
          totalIvaBs: totalizacion.totalIvaBs,
          totalConIvaBs: totalizacion.totalConIvaBs,
        }
        await db.presupuesto.update({
          where: { id: presupuesto.id },
          data: {
            totalCostoDirectoBs: totalizacion.subtotalCostoDirectoBs,
            totalAdministracionBs: totalizacion.subtotalAdministracionBs,
            totalUtilidadBs: totalizacion.subtotalUtilidadBs,
            totalSinIvaBs: totalizacion.subtotalSinIvaBs,
            totalIvaBs: totalizacion.totalIvaBs,
            totalConIvaBs: totalizacion.totalConIvaBs,
          },
        })
      }
    }

    return NextResponse.json({
      confirmado: true,
      version: numeroVersion,
      preview,
      totales,
    })
  } catch (e: any) {
    console.error('POST aplicar error:', e)
    return NextResponse.json({ error: 'Error al aplicar al presupuesto', detalle: e.message }, { status: 500 })
  }
}
