/**
 * Motor de cálculo de precios unitarios y presupuestos — capa servidor (BD).
 *
 * El núcleo puro de la cadena APU vive en '@/lib/calculo-core' (importable del
 * cliente); aquí solo se adaptan los modelos de Prisma a esas líneas genéricas.
 */

import { db } from '@/lib/db'
import {
  calcularDesdeLineas,
  PARAMETROS_DEFAULT,
  type ParametrosCalculo,
  type ResultadoCalculoPartida,
} from '@/lib/calculo-core'
import type {
  PartidaAnalisis,
  AnalisisMaterial,
  AnalisisEquipo,
  AnalisisManoObra,
} from '@prisma/client'

// Re-export para compatibilidad con las rutas y componentes existentes
export {
  PARAMETROS_DEFAULT,
  calcularDesdeLineas,
  formatBs,
  formatBsFull,
} from '@/lib/calculo-core'
export type { ParametrosCalculo, ResultadoCalculoPartida, LineaCalculada } from '@/lib/calculo-core'

/**
 * Calcula el precio unitario de una partida de la BD con parámetros personalizados.
 * Requiere cargar la partida con sus líneas de materiales/equipos/mano de obra.
 */
export function calcularPartida(
  partida: PartidaAnalisis & {
    materiales: AnalisisMaterial[]
    equipos: AnalisisEquipo[]
    manoObra: AnalisisManoObra[]
  },
  parametros: ParametrosCalculo = PARAMETROS_DEFAULT,
): ResultadoCalculoPartida {
  return calcularDesdeLineas(
    {
      rendimiento: partida.rendimiento,
      materiales: partida.materiales.map(m => ({
        descripcion: m.descripcion,
        unidad: m.unidad,
        cantidad: m.cantidad,
        costoBs: m.costoBs,
      })),
      equipos: partida.equipos.map(e => ({
        descripcion: e.descripcion,
        cantidad: e.cantidad,
        cop: e.cop,
        costoBs: e.costoBs,
      })),
      manoObra: partida.manoObra.map(mo => ({
        cargo: mo.cargo,
        cantidad: mo.cantidad,
        jornalBs: mo.jornalBs,
      })),
      unitarioMaterialesBs: partida.unitarioMaterialesBs,
      unitarioEquiposBs: partida.unitarioEquiposBs,
    },
    parametros,
  )
}

// ============================================================
// MOTOR DE PRESUPUESTOS
// ============================================================

export interface PresupuestoItemCalculado {
  partidaAnalisisId: number | null
  covenin: string
  descripcion: string
  unidad: string
  cantidad: number
  rendimiento: number | null
  precioUnitarioBs: number
  totalBs: number
  // detalle opcional
  desglose?: ResultadoCalculoPartida
}

export interface ResultadoCalculoPresupuesto {
  items: PresupuestoItemCalculado[]
  // Subtotales
  subtotalCostoDirectoBs: number
  subtotalAdministracionBs: number
  subtotalUtilidadBs: number
  subtotalSinIvaBs: number
  totalIvaBs: number
  totalConIvaBs: number
  // Parámetros aplicados
  parametros: ParametrosCalculo
  // Metadatos
  nombre: string
  cliente?: string | null
  obra?: string | null
  fecha?: string | null
  descripcion?: string | null
  itemCount: number
}

/**
 * Calcula el total de un presupuesto a partir de los items.
 * Cada item tiene una partida y una cantidad. El precio se recalcula con los parámetros.
 */
export async function calcularPresupuesto(
  items: { partidaAnalisisId: number; cantidad: number; covenin?: string }[],
  parametros: ParametrosCalculo = PARAMETROS_DEFAULT,
): Promise<PresupuestoItemCalculado[]> {
  const itemsCalculados: PresupuestoItemCalculado[] = []

  for (const item of items) {
    const partida = await db.partidaAnalisis.findUnique({
      where: { id: item.partidaAnalisisId },
      include: { materiales: true, equipos: true, manoObra: true },
    })
    if (!partida) continue

    const resultado = calcularPartida(partida, parametros)
    itemsCalculados.push({
      partidaAnalisisId: partida.id,
      covenin: partida.covenin,
      descripcion: partida.descripcion,
      unidad: partida.unidad,
      cantidad: item.cantidad,
      rendimiento: partida.rendimiento,
      precioUnitarioBs: resultado.precioUnitarioBs,
      totalBs: item.cantidad * resultado.precioUnitarioBs,
      desglose: resultado,
    })
  }

  return itemsCalculados
}

/**
 * Calcula los totales de un presupuesto con items ya calculados.
 */
export function totalizarPresupuesto(
  items: PresupuestoItemCalculado[],
  parametros: ParametrosCalculo = PARAMETROS_DEFAULT,
  meta?: { nombre?: string; cliente?: string | null; obra?: string | null; fecha?: string | null; descripcion?: string | null },
): ResultadoCalculoPresupuesto {
  // Para presupuesto con partidas, los items ya tienen el precio unitario con todos los recargos incluidos
  // (costo directo + admin + utilidad + IVA). El total = Σ(cantidad × precioUnitario)
  // Pero a veces se quieren los subtotales separados (sin IVA, solo IVA, etc.)

  // Para mantener separación: el "subtotalCostoDirecto" incluye los costos directos + admin + utilidad
  // sin el IVA. Como cada item ya tiene precioUnitario (con IVA incluido), hacemos:
  const precioSinIvaPct = 1 / (1 + parametros.ivaPct / 100)

  let subtotalSinIvaBs = 0
  let totalIvaBs = 0
  let subtotalCostoDirectoBs = 0
  let subtotalAdministracionBs = 0
  let subtotalUtilidadBs = 0

  for (const item of items) {
    const totalBs = item.totalBs
    const totalSinIva = totalBs * precioSinIvaPct
    const totalIva = totalBs - totalSinIva

    subtotalSinIvaBs += totalSinIva
    totalIvaBs += totalIva

    // Si hay desglose, separar costos
    if (item.desglose) {
      const d = item.desglose
      // Costo directo por unidad × cantidad
      const cd = d.costoDirectoUnitarioBs * item.cantidad
      const admin = d.administracionBs * item.cantidad
      const util = d.utilidadBs * item.cantidad
      subtotalCostoDirectoBs += cd
      subtotalAdministracionBs += admin
      subtotalUtilidadBs += util
    } else {
      // Estimación: costo directo = subtotalSinIva / (1 + admin% + util%)
      const cd = subtotalSinIvaBs / (1 + parametros.administracionPct/100 + parametros.utilidadPct/100)
      subtotalCostoDirectoBs = cd
      subtotalAdministracionBs = subtotalSinIvaBs - cd
    }
  }

  return {
    items,
    subtotalCostoDirectoBs,
    subtotalAdministracionBs,
    subtotalUtilidadBs,
    subtotalSinIvaBs,
    totalIvaBs,
    totalConIvaBs: subtotalSinIvaBs + totalIvaBs,
    parametros,
    nombre: meta?.nombre ?? 'Presupuesto',
    cliente: meta?.cliente,
    obra: meta?.obra,
    fecha: meta?.fecha,
    descripcion: meta?.descripcion,
    itemCount: items.length,
  }
}
