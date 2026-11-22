import { NextResponse, NextRequest } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * DELETE /api/vanos-tipo/[id] — quita un vano de la biblioteca de la obra.
 * Las instancias existentes conservan sus datos (vanoTipoId queda sin efecto).
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    await db.vanoTipo.delete({ where: { id: parseInt(id) } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('DELETE vanos-tipo error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
