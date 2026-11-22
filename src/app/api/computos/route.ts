import { NextResponse, NextRequest } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/computos?presupuestoId=N
 *   Lista los cómputos de un presupuesto (o todos si no se filtra).
 * POST /api/computos { presupuestoId, nombre }
 *   Crea un cómputo dentro de un presupuesto existente (A2: no hay cómputos sueltos).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const presupuestoId = searchParams.get('presupuestoId')
    const where = presupuestoId ? { presupuestoId: parseInt(presupuestoId) } : {}

    const computos = await db.computo.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        presupuesto: { select: { id: true, nombre: true, obra: true, fecha: true } },
        bloques: { select: { id: true, cantidadNeta: true, ajusteAdoptado: true } },
        versiones: { orderBy: { numero: 'desc' }, take: 1 },
        _count: { select: { bloques: true } },
      },
    })

    return NextResponse.json({
      items: computos.map(c => ({
        id: c.id,
        nombre: c.nombre,
        valuacion: c.valuacion,
        updatedAt: c.updatedAt,
        presupuesto: c.presupuesto,
        bloquesCount: c._count.bloques,
        // Estado de aplicación: versión 1+ significa que ya se aplicó al presupuesto (D)
        ultimaVersion: c.versiones[0]?.numero ?? 0,
        partidasComputadas: c.bloques.filter(b => Math.abs(b.cantidadNeta) > 1e-9 || b.ajusteAdoptado !== null).length,
      })),
    })
  } catch (e: any) {
    console.error('GET computos error:', e)
    return NextResponse.json({ error: 'Error al listar cómputos', detalle: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const presupuestoId = parseInt(body?.presupuestoId)
    const nombre = (body?.nombre || '').trim()

    if (!Number.isFinite(presupuestoId) || presupuestoId <= 0) {
      return NextResponse.json({ error: 'presupuestoId inválido' }, { status: 400 })
    }
    if (!nombre) {
      return NextResponse.json({ error: 'El cómputo necesita un nombre' }, { status: 400 })
    }
    const presupuesto = await db.presupuesto.findUnique({ where: { id: presupuestoId } })
    if (!presupuesto) {
      return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })
    }

    const computo = await db.computo.create({
      data: {
        presupuestoId,
        nombre,
        valuacion: 0, // fase 1: cómputo inicial (valuación 0)
      },
    })
    return NextResponse.json({ computo }, { status: 201 })
  } catch (e: any) {
    console.error('POST computos error:', e)
    return NextResponse.json({ error: 'Error al crear cómputo', detalle: e.message }, { status: 500 })
  }
}
