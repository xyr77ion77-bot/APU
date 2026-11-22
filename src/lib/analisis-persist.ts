/**
 * Persistencia del APU editado — compartida entre PUT /api/analisis/[id]
 * (sobrescribir) y POST /api/analisis (crear S/C o clon con código propio).
 *
 * Al guardar siempre se recalculan los unitarios desde las líneas editadas:
 * los unitarios del PDF original dejan de aplicarse cuando la composición
 * cambió de manos (es la única forma de que el precio refleje la edición).
 */
import { calcularDesdeLineas, type ParametrosCalculo } from '@/lib/calculo-core'
import type { PayloadGuardarApu } from '@/components/civ/types'

/**
 * Prefijo que identifica las partidas creadas en el editor de APU (S/C o con
 * código propio): se graba al inicio del rawText al crear y se usa para el
 * borrado del catálogo y el filtro "Solo mis partidas".
 */
export const MARCA_PROPIA = 'Partida creada con el editor de APU'

export interface DataGuardado {
  dataPartida: {
    descripcion: string
    unidad: string
    rendimiento: number
    totalMaterialesBs: number
    totalEquiposBs: number
    subTotalManoObraBs: number
    factorCostosBs: number
    totalManoObraFactorBs: number
    bonoAlimenticioBs: number
    totalBonoMasBs: number
    unitarioMaterialesBs: number
    unitarioEquiposBs: number
    unitarioManoObraBs: number
    costoDirectoUnitarioBs: number
    administracionPct: number
    utilidadPct: number
    ivaPct: number
    fcasPct: number
    ceduPct: number
    bonoAlimenticioDiario: number
    precioUnitarioSinIvaBs: number
    ivaBs: number
    precioUnitarioBs: number
  }
  materiales: { descripcion: string; unidad: string | null; cantidad: number; costoBs: number; totalBs: number; posicion: number }[]
  equipos: { descripcion: string; cantidad: number; cop: number | null; costoBs: number; totalBs: number; posicion: number }[]
  manoObra: { cargo: string; cantidad: number; jornalBs: number; totalBs: number; posicion: number }[]
  calculo: ReturnType<typeof calcularDesdeLineas>
}

/**
 * Normaliza y recalcula el payload de guardado del cliente.
 * Lanza Error con mensaje legible si faltan datos o son inválidos.
 */
export function construirDataGuardado(
  payload: PayloadGuardarApu,
): DataGuardado {
  const descripcion = (payload.descripcion || '').trim()
  const unidad = (payload.unidad || '').trim() || 'global'
  const rendimiento = Number(payload.rendimiento)
  if (!descripcion) throw new Error('La descripción de la partida es obligatoria')
  if (!Number.isFinite(rendimiento) || rendimiento <= 0) {
    throw new Error('El rendimiento debe ser un número mayor que 0')
  }

  const p = payload.parametros || ({} as PayloadGuardarApu['parametros'])
  const parametros: ParametrosCalculo = {
    fcasPct: Number(p.fcasPct) || 0,
    ceduPct: Number(p.ceduPct) || 0,
    bonoAlimenticioDiario: Number(p.bonoAlimenticioDiario) || 0,
    administracionPct: Number(p.administracionPct) || 0,
    utilidadPct: Number(p.utilidadPct) || 0,
    ivaPct: Number(p.ivaPct) || 0,
  }

  const materiales = (payload.materiales || [])
    .filter(m => (m.descripcion || '').trim() && Number(m.costoBs) >= 0)
    .map(m => ({
      descripcion: m.descripcion.trim(),
      unidad: (m.unidad || '').trim() || null,
      cantidad: Number(m.cantidad) || 0,
      costoBs: Number(m.costoBs) || 0,
    }))
  if (materiales.some(m => !Number.isFinite(m.cantidad) || !Number.isFinite(m.costoBs))) {
    throw new Error('Hay materiales con cantidad o costo inválidos')
  }

  const equipos = (payload.equipos || [])
    .filter(e => (e.descripcion || '').trim() && Number(e.costoBs) >= 0)
    .map(e => ({
      descripcion: e.descripcion.trim(),
      cantidad: Number(e.cantidad) || 0,
      cop: e.cop != null && Number(e.cop) > 0 ? Number(e.cop) : null,
      costoBs: Number(e.costoBs) || 0,
    }))
  if (equipos.some(e => !Number.isFinite(e.cantidad) || !Number.isFinite(e.costoBs))) {
    throw new Error('Hay equipos con cantidad o costo inválidos')
  }

  const manoObra = (payload.manoObra || [])
    .filter(mo => (mo.cargo || '').trim() && Number(mo.jornalBs) >= 0)
    .map(mo => ({
      cargo: mo.cargo.trim(),
      cantidad: Number(mo.cantidad) || 0,
      jornalBs: Number(mo.jornalBs) || 0,
    }))
  if (manoObra.some(mo => !Number.isFinite(mo.cantidad) || !Number.isFinite(mo.jornalBs))) {
    throw new Error('Hay cargos con cantidad o jornal inválidos')
  }

  if (!materiales.length && !equipos.length && !manoObra.length) {
    throw new Error('La partida debe conservar al menos un concepto (material, equipo o mano de obra)')
  }

  // Recalculo completo desde las líneas — sin unitarios del PDF original
  const calculo = calcularDesdeLineas(
    {
      rendimiento,
      materiales: materiales.map(m => ({ descripcion: m.descripcion, unidad: m.unidad, cantidad: m.cantidad, costoBs: m.costoBs })),
      equipos: equipos.map(e => ({ descripcion: e.descripcion, cantidad: e.cantidad, cop: e.cop, costoBs: e.costoBs })),
      manoObra: manoObra.map(mo => ({ cargo: mo.cargo, cantidad: mo.cantidad, jornalBs: mo.jornalBs })),
    },
    parametros,
  )

  return {
    dataPartida: {
      descripcion,
      unidad,
      rendimiento,
      totalMaterialesBs: calculo.totalMaterialesBs,
      totalEquiposBs: calculo.totalEquiposBs,
      subTotalManoObraBs: calculo.subTotalManoObraBs,
      factorCostosBs: calculo.factorCostosBs,
      totalManoObraFactorBs: calculo.totalManoObraFactorBs,
      bonoAlimenticioBs: calculo.bonoAlimenticioBs,
      totalBonoMasBs: calculo.totalBonoMasBs,
      unitarioMaterialesBs: calculo.unitarioMaterialesBs,
      unitarioEquiposBs: calculo.unitarioEquiposBs,
      unitarioManoObraBs: calculo.unitarioManoObraBs,
      costoDirectoUnitarioBs: calculo.costoDirectoUnitarioBs,
      administracionPct: parametros.administracionPct,
      utilidadPct: parametros.utilidadPct,
      ivaPct: parametros.ivaPct,
      fcasPct: parametros.fcasPct,
      ceduPct: parametros.ceduPct,
      bonoAlimenticioDiario: parametros.bonoAlimenticioDiario,
      precioUnitarioSinIvaBs: calculo.precioUnitarioSinIvaBs,
      ivaBs: calculo.ivaBs,
      precioUnitarioBs: calculo.precioUnitarioBs,
    },
    materiales: materiales.map((m, i) => ({ ...m, totalBs: m.cantidad * m.costoBs, posicion: i })),
    equipos: equipos.map((e, i) => ({
      ...e,
      totalBs: e.cantidad * (e.cop ?? 1) * e.costoBs,
      posicion: i,
    })),
    manoObra: manoObra.map((mo, i) => ({ ...mo, totalBs: mo.cantidad * mo.jornalBs, posicion: i })),
    calculo,
  }
}

/**
 * Sugerencia de código S/C: el primer "S/C-n" libre (n = 1, 2, …).
 */
export async function sugerirCoveninSC(): Promise<string> {
  const { db } = await import('@/lib/db')
  const existentes = await db.partidaAnalisis.findMany({
    where: { covenin: { startsWith: 'S/C-' } },
    select: { covenin: true },
  })
  const usados = new Set(existentes.map(x => x.covenin))
  let n = 1
  while (usados.has(`S/C-${n}`)) n++
  return `S/C-${n}`
}
