import { NextResponse, NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { modoSugeridoPorUnidad, desperdicioSugeridoPorDescripcion } from '@/lib/computos'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * POST /api/computos/[id]/bloques { presupuestoItemId }
 *   Agrega un bloque para una partida EXISTENTE del presupuesto (A1: no crea partidas).
 *   La regla de medición se precarga con defaults inteligentes (C): modo según la
 *   unidad de la partida y % de desperdicio según el material (F1: sobre_pu).
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const computoId = parseInt(id)
    const body = await req.json()
    const presupuestoItemId = parseInt(body?.presupuestoItemId)
    if (!Number.isFinite(presupuestoItemId) || presupuestoItemId <= 0) {
      return NextResponse.json({ error: 'presupuestoItemId inválido' }, { status: 400 })
    }

    const computo = await db.computo.findUnique({ where: { id: computoId } })
    if (!computo) return NextResponse.json({ error: 'Cómputo no encontrado' }, { status: 404 })

    const item = await db.presupuestoItem.findUnique({ where: { id: presupuestoItemId } })
    if (!item) return NextResponse.json({ error: 'Partida no encontrada en el presupuesto' }, { status: 404 })
    if (item.presupuestoId !== computo.presupuestoId) {
      return NextResponse.json({ error: 'La partida no pertenece al presupuesto del cómputo' }, { status: 400 })
    }

    const existente = await db.computoBloque.findFirst({
      where: { computoId, presupuestoItemId },
    })
    if (existente) {
      return NextResponse.json({ error: 'Esta partida ya tiene un bloque en el cómputo' }, { status: 409 })
    }

    const posicion = (await db.computoBloque.count({ where: { computoId } })) + 1
    const bloque = await db.computoBloque.create({
      data: {
        computoId,
        presupuestoItemId,
        posicion,
        regla: {
          create: {
            modo: modoSugeridoPorUnidad(item.unidad),
            descuentaVanos: true,
            umbralVanosM2: 1.0,
            sumaRevelados: false,
            desperdicioModo: 'sobre_pu', // F1: sobre el PU para todas las partidas
            desperdicioPct: desperdicioSugeridoPorDescripcion(item.descripcion),
          },
        },
      },
      include: { regla: true },
    })

    // Aviso "no medir dos veces": la partida ya alimenta otro cómputo del mismo presupuesto.
    // Es aviso, no bloqueo (criterio C del contrato).
    const otroBloque = await db.computoBloque.findFirst({
      where: { presupuestoItemId, computo: { presupuestoId: computo.presupuestoId, id: { not: computoId } } },
      include: { computo: { select: { nombre: true } } },
    })
    const aviso = otroBloque
      ? `Esta partida ya está computada en el cómputo "${otroBloque.computo.nombre}": verificar para no medir dos veces`
      : null

    return NextResponse.json({ bloque, aviso }, { status: 201 })
  } catch (e: any) {
    console.error('POST bloque error:', e)
    return NextResponse.json({ error: 'Error al agregar bloque', detalle: e.message }, { status: 500 })
  }
}
