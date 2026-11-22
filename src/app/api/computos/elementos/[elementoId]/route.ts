import { NextResponse, NextRequest } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ elementoId: string }>
}

/**
 * PATCH /api/computos/elementos/[elementoId]
 *   Actualiza geometría/nivel/ambiente y (opcionalmente) reemplaza la lista
 *   completa de vanos instanciados. Las filas generadas quedan vinculadas:
 *   al cambiar la geometría, "Regenerar filas" las trae al día con vista previa.
 *   Las filas con vínculo roto o manuales nunca se tocan.
 * DELETE — borra el elemento; sus filas quedan desvinculadas (huérfanas, aviso visible).
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { elementoId } = await params
    const id = parseInt(elementoId)
    const elemento = await db.computoElemento.findUnique({ where: { id } })
    if (!elemento) return NextResponse.json({ error: 'Elemento no encontrado' }, { status: 404 })

    const body = await req.json()
    const num = (v: unknown, def = 0) => {
      const n = parseFloat(String(v ?? '').replace(',', '.'))
      return Number.isFinite(n) ? n : def
    }
    const data: Record<string, unknown> = {}
    if (typeof body.descripcion === 'string' && body.descripcion.trim()) data.descripcion = body.descripcion.trim().slice(0, 200)
    if (typeof body.nivel === 'string') data.nivel = body.nivel.slice(0, 120)
    if (typeof body.ambiente === 'string') data.ambiente = body.ambiente.slice(0, 120)
    if ('largo' in body) data.largo = num(body.largo)
    if ('ancho' in body) data.ancho = num(body.ancho)
    if ('alto' in body) data.alto = num(body.alto)
    if ('espesor' in body) data.espesor = num(body.espesor)
    if ('caras' in body && [1, 2].includes(num(body.caras, 1))) data.caras = num(body.caras, 1)

    const actualizado = await db.computoElemento.update({ where: { id }, data })

    // Reemplazo completo de vanos (opcional)
    if (Array.isArray(body.vanos)) {
      await db.computoVanoInstancia.deleteMany({ where: { elementoId: id } })
      for (const v of body.vanos.slice(0, 50)) {
        await db.computoVanoInstancia.create({
          data: {
            elementoId: id,
            vanoTipoId: Number.isFinite(parseInt(v?.vanoTipoId)) ? parseInt(v.vanoTipoId) : null,
            nombre: String(v?.nombre || '').slice(0, 20) || 'V-XX',
            tipo: String(v?.tipo || 'puerta'),
            ancho: num(v?.ancho),
            alto: num(v?.alto),
            antepecho: num(v?.antepecho),
            cantidad: Math.max(1, Math.round(num(v?.cantidad, 1))),
            generaCarpinteria: !!v?.generaCarpinteria,
          },
        })
      }
    }

    const final = await db.computoElemento.findUnique({ where: { id }, include: { vanos: true } })
    return NextResponse.json({ elemento: final, filasQuedaronVinculadas: true })
  } catch (e: any) {
    console.error('PATCH elemento error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { elementoId } = await params
    const id = parseInt(elementoId)
    // Filas generadas que quedarían huérfanas (aviso del contrato):
    const filas = await db.computoFila.count({ where: { elementoId: id } })
    await db.computoElemento.delete({ where: { id } })
    return NextResponse.json({
      ok: true,
      filasDesvinculadas: filas,
      aviso: filas > 0 ? `${filas} fila(s) generadas quedaron desvinculadas (huérfanas) — ya no se regeneran` : null,
    })
  } catch (e: any) {
    console.error('DELETE elemento error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
