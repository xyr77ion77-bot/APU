import { NextResponse, NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { calcularFila, resumenBloque, parseNumEs, MODOS_MEDICION, MODOS_DESPERDICIO } from '@/lib/computos'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ bloqueId: string }>
}

const MODOS_VALIDOS = new Set<string>(MODOS_MEDICION.map(m => m.id))
const DESPERDICIOS_VALIDOS = new Set<string>(MODOS_DESPERDICIO.map(m => m.id))

/**
 * PATCH /api/computos/bloques/[bloqueId]
 *   Guarda la regla de medición, el ajuste adoptado (con justificación obligatoria, A4)
 *   y la lista completa de filas. Las filas se recalculan en el servidor:
 *   cantidad con signo y expresión visible (fuente única de verdad).
 * DELETE /api/computos/bloques/[bloqueId]
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { bloqueId } = await params
    const id = parseInt(bloqueId)
    const bloque = await db.computoBloque.findUnique({ where: { id }, include: { regla: true } })
    if (!bloque) return NextResponse.json({ error: 'Bloque no encontrado' }, { status: 404 })

    const body = await req.json()
    const data: Record<string, unknown> = {}

    // --- Regla de medición (F3) ---
    if (body.regla && typeof body.regla === 'object') {
      const r = body.regla
      if (!bloque.regla) {
        await db.reglaMedicion.create({ data: { bloqueId: id } })
      }
      const reglaData: Record<string, unknown> = {}
      if (typeof r.modo === 'string' && MODOS_VALIDOS.has(r.modo)) reglaData.modo = r.modo
      if (typeof r.descuentaVanos === 'boolean') reglaData.descuentaVanos = r.descuentaVanos
      const umbral = parseNumEs(r.umbralVanosM2)
      if (umbral !== null) reglaData.umbralVanosM2 = Math.max(0, umbral)
      if (typeof r.sumaRevelados === 'boolean') reglaData.sumaRevelados = r.sumaRevelados
      if (typeof r.multiplicaCaras === 'boolean') reglaData.multiplicaCaras = r.multiplicaCaras
      // Fase 2 — modo peso: perfil del catálogo y separación de acero
      if ('perfilAceroId' in r) {
        const pid = parseInt(r.perfilAceroId)
        if (Number.isFinite(pid) && pid > 0) {
          const existe = await db.perfilAcero.findUnique({ where: { id: pid } })
          if (!existe) return NextResponse.json({ error: 'Perfil no encontrado en el catálogo' }, { status: 400 })
          reglaData.perfilAceroId = pid
        } else if (r.perfilAceroId === null || r.perfilAceroId === '') {
          reglaData.perfilAceroId = null
        }
      }
      const sep = parseNumEs(r.separacionAceroM)
      if (sep !== null) reglaData.separacionAceroM = sep > 0 ? sep : null
      if (typeof r.desperdicioModo === 'string' && DESPERDICIOS_VALIDOS.has(r.desperdicioModo)) reglaData.desperdicioModo = r.desperdicioModo
      const pct = parseNumEs(r.desperdicioPct)
      if (pct !== null) reglaData.desperdicioPct = Math.max(0, pct)
      if (Object.keys(reglaData).length > 0) {
        await db.reglaMedicion.update({ where: { bloqueId: id }, data: reglaData })
      }
    }

    // --- Elemento fuente del bloque (fase 1b) ---
    if ('elementoId' in body) {
      const v = body.elementoId
      if (v === null || v === '' || v === undefined) {
        data.elementoId = null
      } else {
        const n = parseInt(v)
        if (!Number.isFinite(n) || n <= 0) {
          return NextResponse.json({ error: 'elementoId inválido' }, { status: 400 })
        }
        const el = await db.computoElemento.findUnique({ where: { id: n } })
        if (!el || el.computoId !== bloque.computoId) {
          return NextResponse.json({ error: 'El elemento no pertenece a este cómputo' }, { status: 400 })
        }
        data.elementoId = n
      }
    }

    // --- Ajuste adoptado con justificación obligatoria (A4) ---
    let ajuste = bloque.ajusteAdoptado
    let justificacion = bloque.justificacion
    if ('ajusteAdoptado' in body) {
      const v = body.ajusteAdoptado
      if (v === null || v === '' || v === undefined) {
        ajuste = null
        justificacion = null
      } else {
        const n = parseNumEs(v)
        if (n === null) return NextResponse.json({ error: 'ajusteAdoptado debe ser numérico' }, { status: 400 })
        ajuste = n
      }
    }
    if ('justificacion' in body) {
      justificacion = typeof body.justificacion === 'string' ? body.justificacion : null
    }
    if (ajuste !== null && !(justificacion || '').trim()) {
      return NextResponse.json(
        { error: 'El ajuste adoptado exige justificación obligatoria (A4)' },
        { status: 400 },
      )
    }
    data.ajusteAdoptado = ajuste
    data.justificacion = ajuste !== null ? (justificacion as string).trim() : null

    // --- Filas: reemplazo completo con recálculo en el servidor ---
    let neta = bloque.cantidadNeta
    if (Array.isArray(body.filas)) {
      const filasEntrada = body.filas
      if (filasEntrada.length > 500) {
        return NextResponse.json({ error: 'Demasiadas filas' }, { status: 400 })
      }
      await db.computoFila.deleteMany({ where: { bloqueId: id } })
      const filas = filasEntrada.map((f: any, idx: number) => {
        const entrada = {
          tipo: f.tipo === 'directa' ? 'directa' as const : 'dimensiones' as const,
          numero: parseNumEs(f.numero) ?? 1,
          largo: parseNumEs(f.largo) ?? 0,
          ancho: parseNumEs(f.ancho) ?? 0,
          alto: parseNumEs(f.alto) ?? 0,
          valorDirecto: parseNumEs(f.valorDirecto),
          signo: f.signo === '-' ? '-' as const : '+' as const,
        }
        const calc = calcularFila(entrada)
        // Fase 1b: conservar origen y vínculo si el cliente los envía (la fila
        // generada sigue regenerándose; la manual nunca)
        const origen = f.origen === 'elemento' || f.origen === 'vano' ? f.origen : 'manual'
        return {
          bloqueId: id,
          posicion: idx + 1,
          descripcion: typeof f.descripcion === 'string' ? f.descripcion.slice(0, 300) : '',
          tipo: calc.tipo,
          numero: calc.numero,
          largo: calc.largo,
          ancho: calc.ancho,
          alto: calc.alto,
          valorDirecto: calc.valorDirecto,
          signo: calc.signo,
          expresion: calc.expresion,
          cantidad: calc.cantidad,
          origen,
          modo: typeof f.modo === 'string' ? f.modo : null,
          elementoId: Number.isFinite(parseInt(f.elementoId)) ? parseInt(f.elementoId) : null,
          vanoInstanciaId: Number.isFinite(parseInt(f.vanoInstanciaId)) ? parseInt(f.vanoInstanciaId) : null,
          vinculada: origen !== 'manual' ? f.vinculada !== false : true,
        }
      })
      if (filas.length > 0) await db.computoFila.createMany({ data: filas })
      neta = filas.reduce((s, f) => s + f.cantidad, 0)
    }

    data.cantidadNeta = neta
    const actualizado = await db.computoBloque.update({ where: { id }, data })

    // Resumen para la respuesta (con la regla ya actualizada)
    const reglaFinal = await db.reglaMedicion.findUnique({ where: { bloqueId: id } })
    const filasFinal = await db.computoFila.findMany({ where: { bloqueId: id }, orderBy: { posicion: 'asc' } })
    const resumen = resumenBloque(
      filasFinal.map(f => ({
        tipo: f.tipo as 'dimensiones' | 'directa',
        numero: f.numero, largo: f.largo, ancho: f.ancho, alto: f.alto,
        valorDirecto: f.valorDirecto, signo: f.signo as '+' | '-',
      })),
      reglaFinal ?? { desperdicioModo: 'sobre_pu', desperdicioPct: 0, sumaRevelados: false },
      actualizado.ajusteAdoptado,
      actualizado.justificacion,
    )

    return NextResponse.json({
      bloque: actualizado,
      resumen,
      filas: filasFinal,
    })
  } catch (e: any) {
    console.error('PATCH bloque error:', e)
    return NextResponse.json({ error: 'Error al guardar bloque', detalle: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { bloqueId } = await params
    await db.computoBloque.delete({ where: { id: parseInt(bloqueId) } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('DELETE bloque error:', e)
    return NextResponse.json({ error: 'Error al eliminar bloque', detalle: e.message }, { status: 500 })
  }
}
