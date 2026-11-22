import { NextResponse, NextRequest } from 'next/server'
import { instanciarPlantillaMuro15 } from '@/lib/computos-server'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * POST /api/computos/[id]/plantilla
 *   Instancia la plantilla "muro de bloque de 15 cm" (Tabla 5 del contrato):
 *   10 bloques con sus reglas precargadas. Las partidas reales del catálogo
 *   CIV se enlazan al item del presupuesto cuando existe; las que no, quedan
 *   marcadas "pendiente de catálogo" (computables y exportables).
 */
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const resultado = await instanciarPlantillaMuro15(parseInt(id))
    return NextResponse.json(resultado)
  } catch (e: any) {
    console.error('POST plantilla error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
