/**
 * Núcleo PURO del motor de cálculo de precios unitarios (sin dependencias de BD).
 *
 * Importable tanto del cliente como del servidor — garantiza que el editor de
 * partidas S/C en la UI y el cálculo del servidor usen la misma fórmula.
 *
 * Fórmulas basadas en el Análisis de Precios Unitarios (APU) del
 * Colegio de Ingenieros de Venezuela (CIV), Edición Febrero 2011:
 *   1. SubTotalMO    = Σ(cantidad × jornal)
 *   2. FactorCostos  = SubTotalMO × FCAS%
 *   3. TotalMO+Factor = SubTotalMO + FactorCostos
 *   4. BonoAlimenticio = bonoDiario × Σ(cantidades MO)
 *   5. TotalMO+Factor+Bono
 *   6. Unitario MO   = TotalBonoMasMOFactor / Rendimiento
 *   7. Unitario Mat/Equ (del PDF si existe; para S/C = Σ líneas / Rendimiento)
 *   8. CostoDirecto  = UnitMat + UnitEqu + UnitMO
 *   9. + Administración% → Sub-Total B
 *  10. + Utilidad% → Sub-Total C (precio sin IVA)
 *  11. + IVA% → Precio Unitario
 */

export interface ParametrosCalculo {
  fcasPct: number           // % Factor de Costos Asociados al Salario (default 180)
  ceduPct: number           // % C.I.V. — sobrecarga laboral total (default 434.27)
  bonoAlimenticioDiario: number  // Bs./día (default 5407,53 — CC vigente)
  administracionPct: number // % (default 10)
  utilidadPct: number       // % (default 15)
  ivaPct: number            // % (default 16)
}

export const PARAMETROS_DEFAULT: ParametrosCalculo = {
  fcasPct: 180,
  ceduPct: 434.27,
  bonoAlimenticioDiario: 5407.53, // Bs. 162.226/30 días — Bono Alim. Legal y Convencional CC vigente desde homologación 2026
  administracionPct: 10,
  utilidadPct: 15,
  ivaPct: 16,
}

export interface LineaCalculada {
  descripcion: string
  unidad?: string
  cantidad: number
  costoBs: number
  totalBs: number
}

export interface ResultadoCalculoPartida {
  // Componentes
  materiales: LineaCalculada[]
  equipos: LineaCalculada[]
  manoObra: LineaCalculada[]

  // Subtotales
  totalMaterialesBs: number
  totalEquiposBs: number
  subTotalManoObraBs: number
  totalDiasManoObra: number

  // Cálculo laboral
  factorCostosBs: number
  totalManoObraFactorBs: number
  bonoAlimenticioBs: number
  totalBonoMasBs: number

  // Cálculo unitario
  rendimiento: number
  unitarioMaterialesBs: number
  unitarioEquiposBs: number
  unitarioManoObraBs: number

  // Costo directo
  costoDirectoUnitarioBs: number

  // Recargos
  administracionBs: number
  subTotalAdminBs: number
  utilidadBs: number
  precioUnitarioSinIvaBs: number

  // IVA y precio final
  ivaBs: number
  precioUnitarioBs: number

  // Parámetros usados
  parametros: ParametrosCalculo
}

/**
 * Líneas genéricas de una partida (de la BD o compuestas por el usuario).
 * unitarioMaterialesBs / unitarioEquiposBs: unitarios extraídos del PDF original
 * del CIV (solo partidas de la BD); si vienen, se usan tal cual.
 */
export interface LineasPartida {
  rendimiento: number
  materiales: { descripcion: string; unidad?: string | null; cantidad: number; costoBs: number }[]
  equipos: { descripcion: string; cantidad: number; cop?: number | null; costoBs: number }[]
  manoObra: { cargo: string; cantidad: number; jornalBs: number }[]
  unitarioMaterialesBs?: number | null
  unitarioEquiposBs?: number | null
}

/**
 * Calcula el precio unitario desde líneas genéricas con parámetros dados.
 * Es la única implementación de la cadena APU: la usan la UI, el servidor
 * y el exportador Excel (que la replica con fórmulas en el libro).
 */
export function calcularDesdeLineas(
  lineas: LineasPartida,
  parametros: ParametrosCalculo = PARAMETROS_DEFAULT,
): ResultadoCalculoPartida {
  // 1. Materiales — TotalBs = cantidad × costo
  const materiales: LineaCalculada[] = lineas.materiales.map(m => ({
    descripcion: m.descripcion,
    unidad: m.unidad ?? undefined,
    cantidad: m.cantidad,
    costoBs: m.costoBs,
    totalBs: m.cantidad * m.costoBs,
  }))
  const totalMaterialesBs = materiales.reduce((s, m) => s + m.totalBs, 0)

  // 2. Equipos — TotalBs = cantidad × COP × costo
  const equipos: LineaCalculada[] = lineas.equipos.map(e => ({
    descripcion: e.descripcion,
    cantidad: e.cantidad,
    costoBs: e.costoBs,
    totalBs: e.cantidad * (e.cop ?? 1) * e.costoBs,
  }))
  const totalEquiposBs = equipos.reduce((s, e) => s + e.totalBs, 0)

  // 3. Mano de Obra
  const manoObra: LineaCalculada[] = lineas.manoObra.map(mo => ({
    descripcion: mo.cargo,
    cantidad: mo.cantidad,
    costoBs: mo.jornalBs,
    totalBs: mo.cantidad * mo.jornalBs,
  }))
  const subTotalManoObraBs = manoObra.reduce((s, mo) => s + mo.totalBs, 0)
  const totalDiasManoObra = manoObra.reduce((s, mo) => s + mo.cantidad, 0)

  // 4. Factor de Costos Asociados al Salario (F.C.A.S.)
  const factorCostosBs = subTotalManoObraBs * (parametros.fcasPct / 100)

  // 5. Total Mano de Obra + Factor
  const totalManoObraFactorBs = subTotalManoObraBs + factorCostosBs

  // 6. Bono Alimenticio (Bs. diario × total días de MO)
  const bonoAlimenticioBs = parametros.bonoAlimenticioDiario * totalDiasManoObra

  // 7. Total Bono + MO + Factor
  const totalBonoMasBs = totalManoObraFactorBs + bonoAlimenticioBs

  const rendimiento = lineas.rendimiento || 1

  // 8. Unitarios — los del PDF reflejan el cálculo original del CIV para
  //    materiales y equipos (no dependen de FCAS/Bono). Para partidas S/C
  //    (sin unitarios de PDF) se recalculan: Σ líneas / rendimiento.
  const unitarioMaterialesBs = lineas.unitarioMaterialesBs || (totalMaterialesBs / rendimiento)
  const unitarioEquiposBs = lineas.unitarioEquiposBs || (totalEquiposBs / rendimiento)

  // Unitario MO sí se recalcula (depende de F.C.A.S., Bono, parámetros)
  const unitarioManoObraBs = totalBonoMasBs / rendimiento

  // 9. Costo Directo por Unidad
  const costoDirectoUnitarioBs = unitarioMaterialesBs + unitarioEquiposBs + unitarioManoObraBs

  // 10. Administración
  const administracionBs = costoDirectoUnitarioBs * (parametros.administracionPct / 100)
  const subTotalAdminBs = costoDirectoUnitarioBs + administracionBs

  // 11. Utilidad
  const utilidadBs = subTotalAdminBs * (parametros.utilidadPct / 100)
  const precioUnitarioSinIvaBs = subTotalAdminBs + utilidadBs

  // 12. IVA
  const ivaBs = precioUnitarioSinIvaBs * (parametros.ivaPct / 100)
  const precioUnitarioBs = precioUnitarioSinIvaBs + ivaBs

  return {
    materiales,
    equipos,
    manoObra,
    totalMaterialesBs,
    totalEquiposBs,
    subTotalManoObraBs,
    totalDiasManoObra,
    factorCostosBs,
    totalManoObraFactorBs,
    bonoAlimenticioBs,
    totalBonoMasBs,
    rendimiento,
    unitarioMaterialesBs,
    unitarioEquiposBs,
    unitarioManoObraBs,
    costoDirectoUnitarioBs,
    administracionBs,
    subTotalAdminBs,
    utilidadBs,
    precioUnitarioSinIvaBs,
    ivaBs,
    precioUnitarioBs,
    parametros,
  }
}

/**
 * Parse tolerante a números con formato venezolano de dinero:
 * "5.394.059,53" → 5394059.53 · "1.234,56" → 1234.56 · "0,01" → 0.01 ·
 * "0.01" → 0.01 · "1.500" → 1500 (miles) · "5.39" → 5.39 (decimal).
 * Devuelve null si no es numérico.
 */
export function parseDinero(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  let s = String(v).trim().replace(/\s|Bs\.?/gi, '')
  if (!s) return null
  const tieneComa = s.includes(',')
  const tienePunto = s.includes('.')
  if (tieneComa && tienePunto) {
    // punto = miles, coma = decimal (convención es-VE)
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (tieneComa) {
    s = s.replace(/,/g, '.')
  } else if (tienePunto) {
    // solo punto: miles si hay varios grupos o el último tiene exactamente 3 dígitos
    const grupos = (s.match(/\./g) || []).length
    if (grupos > 1 || /\.\d{3}(?!\d)/.test(s)) s = s.replace(/\./g, '')
  }
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

/**
 * Formatea un número en formato venezolano: 1.234,56
 */
export function formatBs(value: number, decimals = 2): string {
  return value.toLocaleString('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * Formatea como Bs. X.XXX,XX
 */
export function formatBsFull(value: number, decimals = 2): string {
  return `Bs. ${formatBs(value, decimals)}`
}
