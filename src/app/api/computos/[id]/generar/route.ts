import { NextResponse, NextRequest } from 'next/server'
import { previsualizarGeneracion, aplicarGeneracion } from '@/lib/computos-server'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * GET /api/computos/[id]/generar
 *   Vista previa de la generación de filas desde elementos: por cada bloque
 *   con elemento fuente y regla, las filas que se generarían, la neta vigente
 *   vs. la generada y los avisos (vanos bajo umbral, modos sin soporte…).
 *
 * POST /api/computos/[id]/generar
 *   Commit de la generación: reemplaza las filas vinculadas por las nuevas;
 *   conserva siempre las filas manuales y las de vínculo roto. Devuelve los
 *   bloques regenerados y los avisos acumulados.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const preview = await previsualizarGeneracion(parseInt(id))
    return NextResponse.json({ preview })
  } catch (e: any) {
    console.error('GET generar error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const resultado = await aplicarGeneracion(parseInt(id))
    if (resultado.regenerados === 0 && resultado.avisos.length === 1 && resultado.avisos[0] === 'Cómputo no encontrado') {
      return NextResponse.json({ error: 'Cómputo no encontrado' }, { status: 404 })
    }
    return NextResponse.json(resultado)
  } catch (e: any) {
    console.error('POST generar error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
