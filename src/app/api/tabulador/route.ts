import { NextResponse, NextRequest } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/tabulador
 * Devuelve el tabulador de mano de obra del Contrato Colectivo de la
 * Construcción vigente (19/08/2026) con sus jornales y jornales de
 * homologación, ordenado por nivel y oficio.
 *
 *   ?q=obrero → filtro textual opcional
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim().toLowerCase() || ''

    const rows = await db.insumo.findMany({
      where: {
        tipo: 'MANO_DE_OBRA',
        jornalBs: { not: null },
        nivelTabulador: { not: null },
      },
      orderBy: [{ nivelTabulador: 'asc' }, { oficioTabulador: 'asc' }],
    })

    const items = rows
      .map(r => ({
        codigo: r.codigo || '',
        denominacion: r.denominacionTabulador || r.descripcion,
        descripcion: r.descripcion,
        nivel: r.nivelTabulador as number,
        oficio: r.oficioTabulador || '',
        jornalBs: r.jornalBs as number,
        jornalHomologacionBs: r.jornalHomologacionBs,
        fechaTabulador: r.fechaTabulador || '19/08/2026',
      }))
      .sort((a, b) => (a.nivel - b.nivel) || (parseFloat(a.oficio) || 0) - (parseFloat(b.oficio) || 0))
      .filter(r =>
        !q ||
        r.denominacion.toLowerCase().includes(q) ||
        r.descripcion.toLowerCase().includes(q) ||
        r.codigo.toLowerCase().includes(q) ||
        r.oficio.includes(q) ||
        String(r.nivel) === q
      )

    // Bono alimenticio legal y convencional vigente (el mismo que usa el motor)
    const bonoRow = await db.insumo.findFirst({
      where: { fuente: 'TABULADOR_CC_2026', tipo: 'MANO_DE_OBRA' },
      orderBy: { id: 'asc' },
    })

    return NextResponse.json({
      items,
      total: items.length,
      vigencia: bonoRow?.fechaTabulador || '19/08/2026',
      bonoAlimenticioDiario: 5407.53,
      bonoAlimenticioMensual: 162226,
      contrato: 'Contrato Colectivo Único de la Construcción',
    })
  } catch (e: any) {
    console.error('Tabulador API error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
