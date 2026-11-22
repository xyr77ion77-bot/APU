import { NextResponse, NextRequest } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const TIPOS_VANO = new Set(['puerta', 'ventana', 'celosia', 'ducha', 'aparato'])

/**
 * GET /api/vanos-tipo?presupuestoId=N
 *   Biblioteca de vanos tipo de la obra: se define una vez y se instancia en N muros.
 * POST /api/vanos-tipo { presupuestoId, nombre, tipo, ancho, alto, antepecho?, generaCarpinteria? }
 */
export async function GET(req: NextRequest) {
  try {
    const presupuestoId = parseInt(req.nextUrl.searchParams.get('presupuestoId') || '')
    if (!Number.isFinite(presupuestoId) || presupuestoId <= 0) {
      return NextResponse.json({ error: 'presupuestoId requerido' }, { status: 400 })
    }
    const vanos = await db.vanoTipo.findMany({
      where: { presupuestoId },
      orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
    })
    return NextResponse.json({ items: vanos })
  } catch (e: any) {
    console.error('GET vanos-tipo error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const presupuestoId = parseInt(body?.presupuestoId)
    if (!Number.isFinite(presupuestoId) || presupuestoId <= 0) {
      return NextResponse.json({ error: 'presupuestoId requerido' }, { status: 400 })
    }
    if (!String(body?.nombre || '').trim()) {
      return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })
    }
    const tipo = TIPOS_VANO.has(body?.tipo) ? body.tipo : null
    if (!tipo) return NextResponse.json({ error: 'tipo inválido (puerta|ventana|celosia|ducha|aparato)' }, { status: 400 })
    const num = (v: unknown, def = 0) => {
      const n = parseFloat(String(v ?? '').replace(',', '.'))
      return Number.isFinite(n) ? n : def
    }
    if (num(body.ancho) <= 0 || num(body.alto) <= 0) {
      return NextResponse.json({ error: 'ancho y alto deben ser positivos' }, { status: 400 })
    }
    const vano = await db.vanoTipo.create({
      data: {
        presupuestoId,
        nombre: String(body.nombre).trim().slice(0, 120),
        tipo,
        ancho: num(body.ancho),
        alto: num(body.alto),
        antepecho: num(body.antepecho),
        generaCarpinteria: !!body.generaCarpinteria,
      },
    })
    return NextResponse.json({ vano })
  } catch (e: any) {
    console.error('POST vanos-tipo error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
