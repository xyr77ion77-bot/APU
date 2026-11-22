import { NextResponse, NextRequest } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/perfiles?presupuestoId=N
 *   Catálogo de perfiles de acero disponible para la obra: los generales
 *   compartidos (presupuestoId null) más los propios del presupuesto.
 *   Filtros opcionales: ?q= (código o descripción) y ?familia=.
 * POST /api/perfiles { presupuestoId?, codigo, familia, tipo?, descripcion?,
 *                      pesoKgM, areaM2M?, longitudComercial? }
 *   Crea un perfil propio de la obra (la partida lo elige en la regla del bloque).
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const presupuestoId = parseInt(sp.get('presupuestoId') || '')
    const q = (sp.get('q') || '').trim()
    const familia = (sp.get('familia') || '').trim()
    if (!Number.isFinite(presupuestoId) || presupuestoId <= 0) {
      return NextResponse.json({ error: 'presupuestoId requerido' }, { status: 400 })
    }
    const where: Record<string, unknown> = {
      OR: [{ presupuestoId: null }, { presupuestoId }],
    }
    if (familia) where.familia = familia
    if (q) {
      where.AND = [
        { OR: where.OR },
        {
          OR: [
            { codigo: { contains: q } },
            { descripcion: { contains: q } },
          ],
        },
      ]
      delete where.OR
    }
    const items = await db.perfilAcero.findMany({
      where,
      orderBy: [{ familia: 'asc' }, { codigo: 'asc' }],
    })
    return NextResponse.json({ items })
  } catch (e: any) {
    console.error('GET perfiles error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const num = (v: unknown, def = 0) => {
      const n = parseFloat(String(v ?? '').replace(',', '.'))
      return Number.isFinite(n) ? n : def
    }
    if (!String(body?.codigo || '').trim()) {
      return NextResponse.json({ error: 'codigo requerido' }, { status: 400 })
    }
    if (!String(body?.familia || '').trim()) {
      return NextResponse.json({ error: 'familia requerida' }, { status: 400 })
    }
    const peso = num(body?.pesoKgM)
    if (peso <= 0) {
      return NextResponse.json({ error: 'pesoKgM debe ser positivo' }, { status: 400 })
    }
    const presupuestoId = Number.isFinite(parseInt(body?.presupuestoId)) && parseInt(body.presupuestoId) > 0
      ? parseInt(body.presupuestoId)
      : null
    const perfil = await db.perfilAcero.create({
      data: {
        presupuestoId,
        codigo: String(body.codigo).trim().slice(0, 60),
        familia: String(body.familia).trim().slice(0, 30),
        tipo: String(body.tipo || 'estructural').slice(0, 20),
        descripcion: String(body.descripcion || '').slice(0, 200),
        pesoKgM: peso,
        areaM2M: body?.areaM2M ? num(body.areaM2M) : null,
        longitudComercial: num(body?.longitudComercial, 6) || 6,
      },
    })
    return NextResponse.json({ perfil })
  } catch (e: any) {
    console.error('POST perfiles error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
