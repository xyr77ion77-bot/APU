import { NextResponse, NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { calcularFila } from '@/lib/computos'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * POST /api/computos/[id]/duplicar
 *   Copia el cómputo completo dentro del mismo presupuesto: cabecera, bloques
 *   con reglas, filas (manuales y vinculadas), elementos y sus vanos. Sirve de
 *   base para el cómputo de la valuación siguiente sin re-medir desde cero.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const computoId = parseInt(id)
    const origen = await db.computo.findUnique({
      where: { id: computoId },
      include: {
        elementos: { include: { vanos: true } },
        bloques: { include: { regla: true, filas: true } },
      },
    })
    if (!origen) return NextResponse.json({ error: 'Cómputo no encontrado' }, { status: 404 })

    // Mapas para conservar los vínculos entre filas, elementos y vanos
    const elIdMap = new Map<number, number>()
    const vanoIdMap = new Map<number, number>()

    const copia = await db.computo.create({
      data: {
        presupuestoId: origen.presupuestoId,
        nombre: `Copia de ${origen.nombre}`.slice(0, 120),
        valuacion: origen.valuacion,
        medidoPor: origen.medidoPor,
        contratista: origen.contratista,
        inspector: origen.inspector,
        residente: origen.residente,
        observaciones: origen.observaciones,
      },
    })

    for (const el of origen.elementos) {
      const nuevo = await db.computoElemento.create({
        data: {
          computoId: copia.id,
          tipo: el.tipo,
          descripcion: el.descripcion,
          nivel: el.nivel,
          ambiente: el.ambiente,
          largo: el.largo, ancho: el.ancho, alto: el.alto,
          espesor: el.espesor, caras: el.caras,
        },
      })
      elIdMap.set(el.id, nuevo.id)
      for (const v of el.vanos) {
        const nv = await db.computoVanoInstancia.create({
          data: {
            elementoId: nuevo.id,
            vanoTipoId: v.vanoTipoId,
            nombre: v.nombre, tipo: v.tipo,
            ancho: v.ancho, alto: v.alto, antepecho: v.antepecho,
            cantidad: v.cantidad, generaCarpinteria: v.generaCarpinteria,
          },
        })
        vanoIdMap.set(v.id, nv.id)
      }
    }

    for (const b of [...origen.bloques].sort((a, c) => a.posicion - c.posicion)) {
      const nb = await db.computoBloque.create({
        data: {
          computoId: copia.id,
          presupuestoItemId: b.presupuestoItemId,
          covenin: b.covenin,
          descripcionPendiente: b.descripcionPendiente,
          unidadPendiente: b.unidadPendiente,
          pendiente: b.pendiente,
          posicion: b.posicion,
          cantidadNeta: b.cantidadNeta,
          ajusteAdoptado: b.ajusteAdoptado,
          justificacion: b.justificacion,
          elementoId: b.elementoId ? (elIdMap.get(b.elementoId) ?? null) : null,
        },
      })
      if (b.regla) {
        await db.reglaMedicion.create({
          data: {
            bloqueId: nb.id,
            modo: b.regla.modo,
            descuentaVanos: b.regla.descuentaVanos,
            umbralVanosM2: b.regla.umbralVanosM2,
            sumaRevelados: b.regla.sumaRevelados,
            multiplicaCaras: b.regla.multiplicaCaras,
            perfilAceroId: b.regla.perfilAceroId,
            separacionAceroM: b.regla.separacionAceroM,
            desperdicioModo: b.regla.desperdicioModo,
            desperdicioPct: b.regla.desperdicioPct,
          },
        })
      }
      for (const f of [...b.filas].sort((a, c) => a.posicion - c.posicion)) {
        const entrada = {
          tipo: f.tipo as 'dimensiones' | 'directa',
          numero: f.numero, largo: f.largo, ancho: f.ancho, alto: f.alto,
          valorDirecto: f.valorDirecto ?? undefined, signo: f.signo as '+' | '-',
        }
        const calc = calcularFila(entrada)
        await db.computoFila.create({
          data: {
            bloqueId: nb.id,
            posicion: f.posicion,
            descripcion: f.descripcion,
            tipo: calc.tipo,
            numero: calc.numero, largo: calc.largo, ancho: calc.ancho, alto: calc.alto,
            valorDirecto: calc.valorDirecto, signo: calc.signo,
            expresion: calc.expresion, cantidad: calc.cantidad,
            origen: f.origen, modo: f.modo,
            elementoId: f.elementoId ? (elIdMap.get(f.elementoId) ?? null) : null,
            vanoInstanciaId: f.vanoInstanciaId ? (vanoIdMap.get(f.vanoInstanciaId) ?? null) : null,
            vinculada: f.vinculada,
          },
        })
      }
    }

    return NextResponse.json({
      computo: { id: copia.id, nombre: copia.nombre },
      mensaje: `Cómputo duplicado como #${copia.id}`,
    })
  } catch (e: any) {
    console.error('Duplicar cómputo error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
