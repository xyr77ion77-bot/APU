import { NextResponse, NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { obtenerComputoCompleto } from '@/lib/computos-server'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * GET /api/computos/[id]
 *   Devuelve el cómputo completo: bloques con regla, filas, resúmenes y versiones.
 * PATCH /api/computos/[id]
 *   Actualiza cabecera: nombre, valuación y firmas configurables (A6).
 * DELETE /api/computos/[id]
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const computo = await obtenerComputoCompleto(parseInt(id))
    if (!computo) return NextResponse.json({ error: 'Cómputo no encontrado' }, { status: 404 })
    return NextResponse.json({ computo })
  } catch (e: any) {
    console.error('GET computo error:', e)
    return NextResponse.json({ error: 'Error al obtener cómputo', detalle: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = await req.json()
    const data: Record<string, unknown> = {}

    if (typeof body.nombre === 'string' && body.nombre.trim()) data.nombre = body.nombre.trim()
    if (Number.isFinite(parseInt(body.valuacion))) data.valuacion = parseInt(body.valuacion)
    for (const k of ['medidoPor', 'contratista', 'inspector', 'residente'] as const) {
      if (typeof body[k] === 'string') data[k] = body[k]
    }
    if (typeof body.observaciones === 'string') data.observaciones = body.observaciones || null

    const computo = await db.computo.update({ where: { id: parseInt(id) }, data })
    return NextResponse.json({ computo })
  } catch (e: any) {
    console.error('PATCH computo error:', e)
    return NextResponse.json({ error: 'Error al actualizar cómputo', detalle: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    await db.computo.delete({ where: { id: parseInt(id) } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('DELETE computo error:', e)
    return NextResponse.json({ error: 'Error al eliminar cómputo', detalle: e.message }, { status: 500 })
  }
}
