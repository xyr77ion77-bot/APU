import { NextResponse, NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { construirDataGuardado, MARCA_PROPIA } from '@/lib/analisis-persist'
import type { PayloadGuardarApu } from '@/components/civ/types'

export const dynamic = 'force-dynamic'

/**
 * PUT /api/analisis/[id] — sobrescribe el APU original con la composición editada.
 * Body: PayloadGuardarApu (líneas + parámetros + descripción/unidad/rendimiento).
 * Reemplaza las tres tablas de conceptos en transacción y recalcula todos los
 * totales guardados. Los presupuestos ya guardados conservan su precio snapshot;
 * los usos nuevos toman el precio recalculado.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const partidaId = parseInt(id)
    if (!Number.isFinite(partidaId)) {
      return NextResponse.json({ error: 'id inválido' }, { status: 400 })
    }

    const body = await req.json() as PayloadGuardarApu
    const data = construirDataGuardado(body)

    const actual = await db.partidaAnalisis.findUnique({ where: { id: partidaId }, select: { id: true } })
    if (!actual) {
      return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 })
    }

    const resultado = await db.$transaction(async tx => {
      await tx.partidaAnalisis.update({ where: { id: partidaId }, data: data.dataPartida })
      // Replace completo de conceptos (posiciones renumeradas)
      await tx.analisisMaterial.deleteMany({ where: { partidaAnalisisId: partidaId } })
      await tx.analisisEquipo.deleteMany({ where: { partidaAnalisisId: partidaId } })
      await tx.analisisManoObra.deleteMany({ where: { partidaAnalisisId: partidaId } })
      await tx.analisisMaterial.createMany({ data: data.materiales.map(m => ({ ...m, partidaAnalisisId: partidaId })) })
      await tx.analisisEquipo.createMany({ data: data.equipos.map(e => ({ ...e, partidaAnalisisId: partidaId })) })
      await tx.analisisManoObra.createMany({ data: data.manoObra.map(mo => ({ ...mo, partidaAnalisisId: partidaId })) })
      return tx.partidaAnalisis.findUnique({ where: { id: partidaId }, select: { covenin: true, precioUnitarioBs: true } })
    })

    return NextResponse.json({
      ok: true,
      id: partidaId,
      covenin: resultado?.covenin,
      precioUnitarioBs: resultado?.precioUnitarioBs,
      mensaje: `APU sobrescrito: ${resultado?.covenin} · Bs. ${resultado?.precioUnitarioBs?.toLocaleString('es-VE', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`
    })
  } catch (e: any) {
    console.error('Analisis PUT error:', e)
    return NextResponse.json({ error: e.message || 'Error al guardar' }, { status: e.message ? 400 : 500 })
  }
}

/**
 * DELETE /api/analisis/[id] — elimina una partida del catálogo.
 * Solo se permiten partidas creadas en el editor de APU (S/C o código propio,
 * reconocidas por el rawText de procedencia); las partidas del catálogo CIV
 * original no se pueden borrar (403). Si la partida está referenciada por
 * ítems de presupuestos guardados, esos ítems conservan el precio snapshot
 * (FK opcional → SetNull) y la respuesta informa el alcance.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const partidaId = parseInt(id)
    if (!Number.isFinite(partidaId)) {
      return NextResponse.json({ error: 'id inválido' }, { status: 400 })
    }

    const partida = await db.partidaAnalisis.findUnique({
      where: { id: partidaId },
      select: { covenin: true, rawText: true, _count: { select: { presupuestoItems: true } } },
    })
    if (!partida) {
      return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 })
    }

    const esPropia = partida.rawText.startsWith('Partida creada con el editor de APU')
    if (!esPropia) {
      return NextResponse.json({
        error: `La partida ${partida.covenin} pertenece al catálogo CIV original y no se puede eliminar. Solo se eliminan partidas creadas en el editor (S/C o código propio).`,
      }, { status: 403 })
    }

    await db.partidaAnalisis.delete({ where: { id: partidaId } }) // cascade borra conceptos; PresupuestoItem.partidaAnalisisId → null

    const n = partida._count.presupuestoItems
    const mensaje = n > 0
      ? `Partida ${partida.covenin} eliminada del catálogo. Los ${n} ítem${n === 1 ? '' : 's'} de presupuestos guardados conservan el precio que tenían.`
      : `Partida ${partida.covenin} eliminada del catálogo.`

    return NextResponse.json({
      ok: true,
      id: partidaId,
      covenin: partida.covenin,
      presupuestosAfectados: n,
      mensaje,
    })
  } catch (e: any) {
    console.error('Analisis DELETE error:', e)
    return NextResponse.json({ error: e.message || 'Error al eliminar' }, { status: 500 })
  }
}
