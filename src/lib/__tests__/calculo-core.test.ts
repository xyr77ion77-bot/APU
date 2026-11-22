/**
 * Tests dorados del motor de cálculo (calculo-core).
 *
 * Los valores esperados provienen de la base de datos del visor, cuyo PU fue
 * verificado contra los APUs originales del CIV durante la ingestión
 * (tolerancia ±0,02 Bs, el mismo criterio de los libros UPTBAL).
 * Herméticos: no tocan la BD ni el sistema de archivos.
 */
import { describe, it, expect } from 'vitest'
import { BD_E114, BD_E462, BD_E316, SC_TUBERIA } from './golden_data'
import {
  calcularDesdeLineas,
  parseDinero,
  formatBs,
  formatBsFull,
  PARAMETROS_DEFAULT,
  type ParametrosCalculo,
} from '../calculo-core'

const P = PARAMETROS_DEFAULT

const expectPU = (obtenido: number, esperado: number) =>
  expect(Math.abs(obtenido - esperado)).toBeLessThanOrEqual(0.02)

describe('cadena APU — partidas de la BD (PU verificado contra el PDF del CIV)', () => {
  // Nota: PartidaAnalisis.precioUnitarioBs de la BD es CON IVA; el PU sin IVA
  // esperado = valor de la BD ÷ 1,16 (recalculado y verificado en el libro UPTBAL).
  it('E.114.101.019 acometida provisional — PU con IVA 1.543,2153', () => {
    const r = calcularDesdeLineas(BD_E114, P)
    expectPU(r.precioUnitarioBs, BD_E114.puConIvaEsperado)
    expectPU(r.precioUnitarioSinIvaBs, BD_E114.puSinIvaEsperado)
    expectPU(r.unitarioMaterialesBs, 385.7975)
    expectPU(r.unitarioEquiposBs, 52.3924)
  })

  it('E.462.000.702 barniz en puertas — PU con IVA 1.365,7385', () => {
    const r = calcularDesdeLineas(BD_E462, P)
    expectPU(r.precioUnitarioBs, BD_E462.puConIvaEsperado)
    expectPU(r.precioUnitarioSinIvaBs, BD_E462.puSinIvaEsperado)
    expectPU(r.unitarioMaterialesBs, 56.5791)
    expectPU(r.unitarioEquiposBs, 68.4931)
  })

  it('E.316.000.000 achicamiento (sin materiales) — PU con IVA 2.744,1485', () => {
    const r = calcularDesdeLineas(BD_E316, P)
    expectPU(r.precioUnitarioBs, BD_E316.puConIvaEsperado)
    expectPU(r.precioUnitarioSinIvaBs, BD_E316.puSinIvaEsperado)
    expect(r.totalMaterialesBs).toBe(0)
    expect(r.unitarioMaterialesBs).toBe(0)
    expectPU(r.unitarioEquiposBs, 1160.4744)
  })
})

describe('cadena APU — partida S/C compuesta (verificada en libro con LibreOffice)', () => {
  const r = calcularDesdeLineas(SC_TUBERIA, P)

  it('unitarios = Σ líneas / rendimiento (sin unitarios de PDF)', () => {
    // Σ mat = 5.439.280,03 → /2
    expectPU(r.totalMaterialesBs, 5439280.03)
    expectPU(r.unitarioMaterialesBs, 2719640.02)
    // equipo: 1 × 0,01 × 1.794.786,45 = 17.947,86 → /2
    expectPU(r.totalEquiposBs, 17947.86)
    expectPU(r.unitarioEquiposBs, 8973.93)
  })

  it('mano de obra: jornal + FCAS 180% + bono 2 jornadas', () => {
    expectPU(r.subTotalManoObraBs, 4158.12)          // 2 × 2.079,06
    expectPU(r.factorCostosBs, 7484.616)             // 180%
    expectPU(r.bonoAlimenticioBs, 10815.06)          // 2 × 5.407,53
    expectPU(r.totalBonoMasBs, 22457.796)
    expectPU(r.unitarioManoObraBs, 11228.898)
    expect(r.totalDiasManoObra).toBe(2)
  })

  it('cadena de recargos paso a paso', () => {
    expectPU(r.costoDirectoUnitarioBs, 2739842.845)  // mat + eq + MO
    expectPU(r.administracionBs, 273984.285)         // 10%
    expectPU(r.subTotalAdminBs, 3013827.13)
    expectPU(r.utilidadBs, 452074.069)               // 15%
    expectPU(r.precioUnitarioSinIvaBs, 3465901.199)
    expectPU(r.ivaBs, 554544.192)                    // 16%
    expectPU(r.precioUnitarioBs, 4020445.391)
  })

  it('invariantes de la cadena con parámetros arbitrarios', () => {
    const params: ParametrosCalculo = { ...P, fcasPct: 150, bonoAlimenticioDiario: 4000, administracionPct: 12.5, utilidadPct: 20, ivaPct: 8 }
    const x = calcularDesdeLineas(SC_TUBERIA, params)
    // PU = sinIVA × (1 + IVA/100) (exacto, sin redondeos)
    expect(Math.abs(x.precioUnitarioBs - x.precioUnitarioSinIvaBs * (1 + params.ivaPct / 100))).toBeLessThan(1e-9)
    // sinIVA = CD × (1 + admin%) × (1 + utilidad%)
    expect(Math.abs(x.precioUnitarioSinIvaBs - x.costoDirectoUnitarioBs * (1 + params.administracionPct / 100) * (1 + params.utilidadPct / 100))).toBeLessThan(1e-9)
    // MO + factor + bono = subMO × (1+FCAS) + bono×días
    expect(Math.abs(x.totalBonoMasBs - (x.subTotalManoObraBs * (1 + params.fcasPct / 100) + params.bonoAlimenticioDiario * x.totalDiasManoObra))).toBeLessThan(1e-9)
  })

  it('parámetros en 0 y 100 no rompen la cadena', () => {
    const cero = calcularDesdeLineas(SC_TUBERIA, { ...P, fcasPct: 0, bonoAlimenticioDiario: 0, administracionPct: 0, utilidadPct: 0, ivaPct: 0 })
    expectPU(cero.precioUnitarioBs, cero.costoDirectoUnitarioBs)
    const cien = calcularDesdeLineas(SC_TUBERIA, { ...P, administracionPct: 100, utilidadPct: 100, ivaPct: 100 })
    expectPU(cien.precioUnitarioBs, cien.costoDirectoUnitarioBs * 8) // ×2 ×2 ×2
  })
})

describe('casos límite', () => {
  it('rendimiento 0 o ausente no divide por cero', () => {
    const r0 = calcularDesdeLineas({ ...SC_TUBERIA, rendimiento: 0 }, P)
    const r1 = calcularDesdeLineas({ ...SC_TUBERIA, rendimiento: 1 }, P)
    expect(r0.costoDirectoUnitarioBs).toBeCloseTo(r1.costoDirectoUnitarioBs, 6)
  })

  it('partida sin líneas da cadena en 0', () => {
    const r = calcularDesdeLineas({ rendimiento: 1, materiales: [], equipos: [], manoObra: [] }, P)
    expect(r.precioUnitarioBs).toBe(0)
    expect(r.costoDirectoUnitarioBs).toBe(0)
  })

  it('equipo sin COP se toma como 1', () => {
    const r = calcularDesdeLineas({
      rendimiento: 1,
      materiales: [],
      equipos: [{ descripcion: 'X', cantidad: 2, costoBs: 100 }],
      manoObra: [],
    }, P)
    expect(r.totalEquiposBs).toBe(200)
  })
})

describe('parseDinero — formato venezolano tolerante', () => {
  it('miles con punto y coma decimal', () => {
    expect(parseDinero('5.394.059,53')).toBe(5394059.53)
    expect(parseDinero('1.234,56')).toBe(1234.56)
    expect(parseDinero('1.500')).toBe(1500)
  })
  it('decimales con coma o punto', () => {
    expect(parseDinero('2,5')).toBe(2.5)
    expect(parseDinero('0.01')).toBe(0.01)
    expect(parseDinero('5.39')).toBe(5.39)
    expect(parseDinero('42')).toBe(42)
  })
  it('sucio: espacios y prefijo Bs.', () => {
    expect(parseDinero(' Bs. 5.394.059,53 ')).toBe(5394059.53)
    expect(parseDinero('1 234,5')).toBe(1234.5)
  })
  it('no numérico → null', () => {
    expect(parseDinero('')).toBeNull()
    expect(parseDinero('abc')).toBeNull()
    expect(parseDinero(null)).toBeNull()
    expect(parseDinero(undefined)).toBeNull()
  })
})

describe('formatBs — presentación es-VE', () => {
  it('miles con punto y coma decimal', () => {
    expect(formatBs(5394059.53)).toBe('5.394.059,53')
    expect(formatBs(0.5)).toBe('0,50')
    expect(formatBsFull(1234.5)).toBe('Bs. 1.234,50')
  })
})
