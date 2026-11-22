/**
 * Tests fase 2 del módulo de cómputos — modo peso con el catálogo:
 * perfiles lineales (kg = L × kg/m) y acero de refuerzo por separación
 * (muro/losa: dos direcciones; barra a la separación + 1).
 */
import { describe, it, expect } from 'vitest'
import {
  generarFilasDesdeElemento,
  calcularAceroDir,
  resumenBloque,
  type ElementoInput,
} from '../computos'

const close = (a: number, b: number, tol = 1e-9) =>
  expect(Math.abs(a - b)).toBeLessThanOrEqual(tol)

const neta = (g: { filas: Array<{ cantidad: number }> }) => g.filas.reduce((s, f) => s + f.cantidad, 0)

describe('modo peso — perfil lineal (kg = L × kg/m)', () => {
  it('IPN-200 en pasamanos de 6,00 m → 134,40 kg', () => {
    const el: ElementoInput = { tipo: 'paño', descripcion: 'PASAMANOS E-02', largo: 6, ancho: 0, alto: 0, espesor: 0, caras: 1, vanos: [] }
    const g = generarFilasDesdeElemento(el, { modo: 'peso', descuentaVanos: false, umbralVanosM2: 1, sumaRevelados: false, perfilCodigo: 'IPN-200', perfilPesoKgM: 22.4 })
    close(neta(g), 134.4)
    expect(g.filas[0].expresion).toContain('22,4')
    expect(g.filas[0].expresion).toContain('IPN-200')
    expect(g.avisos.length).toBe(0)
  })

  it('sin perfil asignado: longitud directa + aviso visible', () => {
    const el: ElementoInput = { tipo: 'paño', descripcion: 'PERFIL S/DATO', largo: 3, ancho: 0, alto: 0, espesor: 0, caras: 1, vanos: [] }
    const g = generarFilasDesdeElemento(el, { modo: 'peso', descuentaVanos: false, umbralVanosM2: 1, sumaRevelados: false })
    expect(g.filas[0].cantidad).toBe(3)
    expect(g.avisos[0]).toContain('sin perfil')
  })
})

describe('modo peso — acero de refuerzo por separación', () => {
  // Muro 5,40 × 2,60 — CB-12 (0,56 kg/m) @ 0,20 m
  const muro: ElementoInput = { tipo: 'muro', descripcion: 'MURO E-01', largo: 5.4, ancho: 0, alto: 2.6, espesor: 15, caras: 1, vanos: [] }
  const reglaAcero = { modo: 'peso', descuentaVanos: false, umbralVanosM2: 1, sumaRevelados: false, perfilCodigo: 'CB-12', perfilPesoKgM: 0.56, separacionAceroM: 0.2 }

  it('calcularAceroDir: barras a la separación + 1', () => {
    const h = calcularAceroDir(5.4, 5.4, 0.2, 0.56)
    // barras = floor(5,40 / 0,20) + 1 = 28
    expect(h.nBarras).toBe(28)
    close(h.longitudM, 28 * 5.4)
    close(h.kg, 28 * 5.4 * 0.56)
  })

  it('muro: horizontal 28×5,40 y vertical 14×2,60 → 102,032 kg', () => {
    const g = generarFilasDesdeElemento(muro, reglaAcero)
    expect(g.filas.length).toBe(2)
    const [h, v] = g.filas
    close(h.cantidad, 28 * 5.4 * 0.56)         // 84,672 kg
    close(v.cantidad, 14 * 2.6 * 0.56)         // 20,384 kg
    close(neta(g), 28 * 5.4 * 0.56 + 14 * 2.6 * 0.56)
    expect(h.descripcion).toContain('horizontal')
    expect(v.descripcion).toContain('vertical')
    expect(h.expresion).toContain('0,56')
    expect(h.expresion).toContain('CB-12')
  })

  it('losa 4,00×3,00 @0,25 con CB-16: dos direcciones cruzadas', () => {
    const losa: ElementoInput = { tipo: 'losa', descripcion: 'LOSA LOS-01', largo: 4, ancho: 3, alto: 0, espesor: 0.12, caras: 1, vanos: [] }
    const g = generarFilasDesdeElemento(losa, { ...reglaAcero, perfilCodigo: 'CB-16', perfilPesoKgM: 0.994, separacionAceroM: 0.25 })
    const dx = calcularAceroDir(3, 4, 0.25, 0.994)   // 13 barras de 4,00 m
    const dy = calcularAceroDir(4, 3, 0.25, 0.994)   // 17 barras de 3,00 m
    close(g.filas[0].cantidad, dx.kg)
    close(g.filas[1].cantidad, dy.kg)
    close(neta(g), dx.kg + dy.kg)
  })

  it('desperdicio de acero 5% en cantidad cuando el formato lo exige', () => {
    const g = generarFilasDesdeElemento(muro, reglaAcero)
    const r = resumenBloque(g.filas, { desperdicioModo: 'en_cantidad', desperdicioPct: 5, sumaRevelados: false }, null, null)
    close(r.cantidadAlPresupuesto, (28 * 5.4 * 0.56 + 14 * 2.6 * 0.56) * 1.05)
  })

  it('separación 0 o mayor que el elemento no divide por cero', () => {
    const g = generarFilasDesdeElemento(muro, { ...reglaAcero, separacionAceroM: 0 })
    // calcularAceroDir nunca divide por cero (fallback separación 1 m)
    const h = calcularAceroDir(5.4, 5.4, 0, 0.56)
    expect(h.nBarras).toBe(6)
    // con separación 0 la regla cae al modo perfil lineal (una fila en kg)
    expect(g.filas.length).toBe(1)
    close(g.filas[0].cantidad, 5.4 * 0.56)
  })
})
