import { NextResponse, NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { calcularPartida, PARAMETROS_DEFAULT, type ParametrosCalculo } from '@/lib/calculo'
import { construirDataGuardado, sugerirCoveninSC, MARCA_PROPIA } from '@/lib/analisis-persist'
import type { PayloadGuardarApu } from '@/components/civ/types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/analisis
 *   ?q=acarreo           → búsqueda textual en descripción/covenin
 *   ?guiaId=2            → filtrar por guía
 *   ?unidad=m3.m         → filtrar por unidad
 *   ?soloMisPartidas=1   → solo las creadas en el editor (S/C o código propio), por recencia
 *   ?limit=50&offset=0   → paginación
 *   ?id=123              → obtener una partida con desglose completo (materiales, equipos, MO)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim() || ''
    const guiaId = searchParams.get('guiaId')
    const unidad = searchParams.get('unidad')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const offset = parseInt(searchParams.get('offset') || '0')
    const id = searchParams.get('id')

    // ¿Existe ya un código COVENIN? (validación en vivo del editor de APU)
    const existeCovenin = searchParams.get('existeCovenin')?.trim()
    if (existeCovenin) {
      const excluirId = searchParams.get('excluirId')
      const existente = await db.partidaAnalisis.findFirst({
        where: { covenin: existeCovenin, ...(excluirId ? { id: { not: parseInt(excluirId) } } : {}) },
        select: { id: true, descripcion: true },
      })
      return NextResponse.json({ existe: !!existente, id: existente?.id ?? null, descripcion: existente?.descripcion ?? null })
    }

    // Sugerencia de código S/C disponible (precarga del editor)
    if (searchParams.get('sugerirSc')) {
      const covenin = await sugerirCoveninSC()
      return NextResponse.json({ covenin })
    }

    // Detalle de una partida con desglose
    if (id) {
      const partida = await db.partidaAnalisis.findUnique({
        where: { id: parseInt(id) },
        include: {
          materiales: { orderBy: { posicion: 'asc' } },
          equipos: { orderBy: { posicion: 'asc' } },
          manoObra: { orderBy: { posicion: 'asc' } },
          guia: true,
          _count: { select: { presupuestoItems: true } },
        },
      })
      if (!partida) {
        return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 })
      }
      const calculo = calcularPartida(partida, PARAMETROS_DEFAULT)
      return NextResponse.json({
        partida: {
          id: partida.id,
          covenin: partida.covenin,
          guiaId: partida.guiaId,
          guiaNombre: partida.guia?.nombre,
          unidad: partida.unidad,
          cantidad: partida.cantidad,
          rendimiento: partida.rendimiento,
          descripcion: partida.descripcion,
          paginaPdf: partida.paginaPdf,
          // ¿partida creada en el editor (S/C o código propio)? — habilita el borrado
          esPropia: partida.rawText.startsWith(MARCA_PROPIA),
          // nº de ítems de presupuestos guardados que la referencian (FK → SetNull al borrar)
          enPresupuestos: partida._count.presupuestoItems,
          parametros: {
            fcasPct: partida.fcasPct,
            ceduPct: partida.ceduPct,
            bonoAlimenticioDiario: partida.bonoAlimenticioDiario,
            administracionPct: partida.administracionPct,
            utilidadPct: partida.utilidadPct,
            ivaPct: partida.ivaPct,
          },
          materiales: partida.materiales,
          equipos: partida.equipos,
          manoObra: partida.manoObra,
          calculo,
        }
      })
    }
    
    // Búsqueda con filtros
    const where: any = {}
    if (q) {
      where.OR = [
        { descripcion: { contains: q } },
        { covenin: { contains: q } },
        // Búsqueda por insumo (materiales, equipos y cargos de mano de obra)
        { materiales: { some: { descripcion: { contains: q } } } },
        { equipos: { some: { descripcion: { contains: q } } } },
        { manoObra: { some: { cargo: { contains: q } } } },
      ]
    }
    if (guiaId) where.guiaId = parseInt(guiaId)
    if (unidad) where.unidad = unidad
    // Filtro "Solo mis partidas": únicamente las creadas en el editor (S/C o código propio)
    const soloMisPartidas = searchParams.get('soloMisPartidas') === '1'
    if (soloMisPartidas) where.rawText = { startsWith: MARCA_PROPIA }

    const [items, total] = await Promise.all([
      db.partidaAnalisis.findMany({
        where,
        // las propias se gestionan mejor por recencia (S/C-10 ordena antes que S/C-2 alfabéticamente)
        orderBy: soloMisPartidas ? { createdAt: 'desc' } : { covenin: 'asc' },
        take: limit,
        skip: offset,
        include: { guia: true },
      }),
      db.partidaAnalisis.count({ where }),
    ])
    
    return NextResponse.json({
      items: items.map(p => ({
        id: p.id,
        covenin: p.covenin,
        guiaId: p.guiaId,
        guiaNombre: p.guia?.nombre || '',
        unidad: p.unidad,
        rendimiento: p.rendimiento,
        descripcion: p.descripcion,
        precioUnitarioBs: p.precioUnitarioBs,
        costoDirectoUnitarioBs: p.costoDirectoUnitarioBs,
        paginaPdf: p.paginaPdf,
      })),
      total,
      limit,
      offset,
    })
  } catch (e: any) {
    console.error('Analisis API error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

/**
 * POST /api/analisis
 * Body: { partidaAnalisisId: number, parametros: ParametrosCalculo }
 *   → recalcula el precio unitario con parámetros personalizados (legacy).
 * Body: { accion: 'crear', covenin, guiaId, ...PayloadGuardarApu }
 *   → crea una partida nueva (S/C o clon con código propio). Valida que el
 *     código no exista y que sea distinto del código origen.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as any

    // --- Crear partida nueva (S/C / clon con código propio) ---
    if (body?.accion === 'crear') {
      const covenin = String(body.covenin ?? '').trim()
      if (!covenin) {
        return NextResponse.json({ error: 'El código de la nueva partida es obligatorio' }, { status: 400 })
      }
      const guiaId = Number(body.guiaId)
      if (!Number.isFinite(guiaId)) {
        return NextResponse.json({ error: 'guiaId requerido' }, { status: 400 })
      }
      const colision = await db.partidaAnalisis.findUnique({ where: { covenin }, select: { id: true } })
      if (colision) {
        return NextResponse.json({ error: `El código ${covenin} ya existe en el catálogo` }, { status: 409 })
      }

      const data = construirDataGuardado(body as PayloadGuardarApu)
      const nueva = await db.$transaction(async tx => {
        const creada = await tx.partidaAnalisis.create({
          data: {
            ...data.dataPartida,
            covenin,
            guiaId,
            cantidad: '1,00 ' + data.dataPartida.unidad,
            rawText: `${MARCA_PROPIA} (${covenin}) · composición recalculada · ${new Date().toISOString().slice(0, 10)}`,
          } as Prisma.PartidaAnalisisUncheckedCreateInput,
          select: { id: true, covenin: true, precioUnitarioBs: true },
        })
        await tx.analisisMaterial.createMany({ data: data.materiales.map(m => ({ ...m, partidaAnalisisId: creada.id })) })
        await tx.analisisEquipo.createMany({ data: data.equipos.map(e => ({ ...e, partidaAnalisisId: creada.id })) })
        await tx.analisisManoObra.createMany({ data: data.manoObra.map(mo => ({ ...mo, partidaAnalisisId: creada.id })) })
        return creada
      })
      return NextResponse.json({
        ok: true,
        id: nueva.id,
        covenin: nueva.covenin,
        precioUnitarioBs: nueva.precioUnitarioBs,
        mensaje: `Nueva partida ${nueva.covenin} guardada en el catálogo`,
      })
    }

    // --- Recalcular (legacy) ---
    const { partidaAnalisisId, parametros } = body as {
      partidaAnalisisId: number
      parametros?: Partial<ParametrosCalculo>
    }
    
    if (!partidaAnalisisId) {
      return NextResponse.json({ error: 'partidaAnalisisId requerido' }, { status: 400 })
    }
    
    const partida = await db.partidaAnalisis.findUnique({
      where: { id: Number(partidaAnalisisId) },
      include: { materiales: true, equipos: true, manoObra: true },
    })
    if (!partida) {
      return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 })
    }

    const paramsFinal: ParametrosCalculo = { ...PARAMETROS_DEFAULT, ...(parametros || {}) }
    const calculo = calcularPartida(partida, paramsFinal)
    
    return NextResponse.json({
      covenin: partida.covenin,
      descripcion: partida.descripcion,
      parametros: paramsFinal,
      calculo,
    })
  } catch (e: any) {
    console.error('Analisis POST error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
