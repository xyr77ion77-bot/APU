/**
 * Tests de la capa de generación de filas desde elementos (fase 1b).
 * Caso de aceptación del contrato (Tabla 9): un muro de 5,40 × 2,60 con dos
 * vanos alimenta cinco partidas (mampostería, friso, cerámica, pintura y
 * carpintería) y al cambiar la altura las cinco cantidades se regeneran.
 */
import { describe, it, expect } from 'vitest'
import {
  generarFilasDesdeElemento,
  vanoDescuenta,
  areaVano,
  validarVanosEnElemento,
  avisoElementoDuplicado,
  resumenBloque,
  type ElementoInput,
  type VanoInstanciaInput,
} from '../computos'

const V01 = (extra: Partial<VanoInstanciaInput> = {}): VanoInstanciaInput => ({
  nombre: 'V-01', tipo: 'puerta', ancho: 0.9, alto: 2.1, antepecho: 0,
  cantidad: 1, generaCarpinteria: true, ...extra,
})
const V02 = (extra: Partial<VanoInstanciaInput> = {}): VanoInstanciaInput => ({
  nombre: 'V-02', tipo: 'ventana', ancho: 1.2, alto: 1.2, antepecho: 0.9,
  cantidad: 1, generaCarpinteria: true, ...extra,
})

const muroBaño = (alto: number, vanos: VanoInstanciaInput[]): ElementoInput => ({
  tipo: 'muro',
  descripcion: 'MURO E-01 BAÑO 1',
  nivel: 'Nivel 1',
  ambiente: 'BAÑO 1',
  largo: 5.4,
  ancho: 0,
  alto,
  espesor: 15,
  caras: 2,
  vanos,
})

const close = (a: number, b: number, tol = 1e-9) =>
  expect(Math.abs(a - b)).toBeLessThanOrEqual(tol)

describe('criterio de aceptación: un muro alimenta 5 partidas', () => {
  const muro = muroBaño(2.6, [V01(), V02()])

  // 1. Mampostería bloque 15 — paño con descuento ≥ 1,00 m²
  const mamposteria = generarFilasDesdeElemento(muro, { modo: 'paño', descuentaVanos: true, umbralVanosM2: 1, sumaRevelados: false })
  // 2. Friso interior 2 caras — paño sin descuento + revelados
  const friso = generarFilasDesdeElemento(muro, { modo: 'paño', descuentaVanos: false, umbralVanosM2: 1, sumaRevelados: true, multiplicaCaras: true })
  // 3. Cerámica — paño con descuento forzado (umbral 0)
  const ceramica = generarFilasDesdeElemento(muro, { modo: 'paño', descuentaVanos: true, umbralVanosM2: 0, sumaRevelados: false })
  // 4. Rodapié — lineal, solo puertas cortan
  const rodapie = generarFilasDesdeElemento(muro, { modo: 'lineal', descuentaVanos: false, umbralVanosM2: 1, sumaRevelados: false })
  // 5. Carpintería — conteo por vano
  const carpinteria = generarFilasDesdeElemento(muro, { modo: 'conteo', descuentaVanos: false, umbralVanosM2: 1, sumaRevelados: false })
  // (6) Pintura vini — paño con descuento forzado
  const pintura = generarFilasDesdeElemento(muro, { modo: 'paño', descuentaVanos: true, umbralVanosM2: 0, sumaRevelados: false })

  const neta = (g: { filas: Array<{ cantidad: number }> }) => g.filas.reduce((s, f) => s + f.cantidad, 0)

  it('mampostería: 5,40×2,60 − V-01 1,89 − V-02 1,44 = 10,71 m²', () => {
    close(neta(mamposteria), 14.04 - 1.89 - 1.44)
    const expr = mamposteria.filas[0].expresion
    expect(expr).toContain('5,4') // expresión auditable
  })

  it('friso 2 caras sin descuento con revelados: 28,08 + 6,00 + 4,80 = 38,88 m²', () => {
    close(neta(friso), 28.08 + 2 * (0.9 + 2.1) + 2 * (1.2 + 1.2))
  })

  it('cerámica (umbral 0): mismos descuentos = 10,71 m²', () => {
    close(neta(ceramica), 10.71)
  })

  it('rodapié lineal: 5,40 − 0,90 (solo la puerta llega al piso) = 4,50 m', () => {
    close(neta(rodapie), 4.5)
  })

  it('carpintería conteo: 1 puerta + 1 ventana = 2 pzas', () => {
    close(neta(carpinteria), 2)
  })

  it('pintura (umbral 0): 10,71 m²', () => {
    close(neta(pintura), 10.71)
  })

  it('cambiar la altura regenera las cinco con vista previa (2,60 → 2,80)', () => {
    const muro2 = muroBaño(2.8, [V01(), V02()])
    const casos = [
      generarFilasDesdeElemento(muro2, { modo: 'paño', descuentaVanos: true, umbralVanosM2: 1, sumaRevelados: false }),
      generarFilasDesdeElemento(muro2, { modo: 'paño', descuentaVanos: false, umbralVanosM2: 1, sumaRevelados: true, multiplicaCaras: true }),
      generarFilasDesdeElemento(muro2, { modo: 'paño', descuentaVanos: true, umbralVanosM2: 0, sumaRevelados: false }),
      generarFilasDesdeElemento(muro2, { modo: 'lineal', descuentaVanos: false, umbralVanosM2: 1, sumaRevelados: false }),
      generarFilasDesdeElemento(muro2, { modo: 'conteo', descuentaVanos: false, umbralVanosM2: 1, sumaRevelados: false }),
    ]
    const netas = casos.map(neta)
    close(netas[0], 5.4 * 2.8 - 1.89 - 1.44)   // mampostería 11,79
    close(netas[1], 2 * 5.4 * 2.8 + 6 + 4.8)   // friso 41,04
    close(netas[2], 11.79)                      // cerámica
    close(netas[3], 4.5)                        // rodapié no depende de la altura
    close(netas[4], 2)                          // carpintería tampoco
  })

  it('las filas quedan vinculadas con expresión auditable y modo fotografiado', () => {
    for (const f of mamposteria.filas) {
        expect(f.expresion.length).toBeGreaterThan(0)
      expect(f.modo).toBe('paño')
    }
    // La fila del vano conserva su origen
    const filaVano = mamposteria.filas.find(f => f.descripcion.startsWith('V-01'))
    expect(filaVano?.origen).toBe('elemento')
  })
})

describe('regla de umbral de vanos (C/F1)', () => {
  const V03: VanoInstanciaInput = { nombre: 'V-03', tipo: 'celosia', ancho: 0.8, alto: 0.6, antepecho: 0, cantidad: 1, generaCarpinteria: false }

  it('área de vano incluye la cantidad', () => {
    close(areaVano({ ...V03, cantidad: 3 }), 0.48 * 3)
  })

  it('V-03 de 0,48 m² NO descuenta con umbral 1,00 y deja aviso del bloque', () => {
    expect(vanoDescuenta(V03, { descuentaVanos: true, umbralVanosM2: 1 })).toBe(false)
    const g = generarFilasDesdeElemento(muroBaño(2.6, [V01(), V03]), { modo: 'paño', descuentaVanos: true, umbralVanosM2: 1, sumaRevelados: false })
    // El aviso es del bloque, NO una fila (la fila mediría el vano dos veces)
    expect(g.avisos.join(' ')).toContain('V-03 no descuenta')
    expect(g.filas.find(f => f.descripcion.includes('V-03'))).toBeUndefined()
    close(g.filas.reduce((s, f) => s + f.cantidad, 0), 14.04 - 1.89)
  })

  it('override por vano fuerza el descuento (validación suave, con justificación)', () => {
    expect(vanoDescuenta({ ...V03, overrideDescuento: true }, { descuentaVanos: true, umbralVanosM2: 1 })).toBe(true)
  })

  it('cerámica fuerza umbral 0: hasta el V-03 de 0,48 m² descuenta', () => {
    const g = generarFilasDesdeElemento(muroBaño(2.6, [V01(), V02(), V03]), { modo: 'paño', descuentaVanos: true, umbralVanosM2: 0, sumaRevelados: false })
    close(g.filas.reduce((s, f) => s + f.cantidad, 0), 14.04 - 1.89 - 1.44 - 0.48)
  })

  it('friso precarga sin descuento y con suma de revelados (práctica del contrato)', () => {
    const g = generarFilasDesdeElemento(muroBaño(2.6, [V01(), V02()]), { modo: 'paño', descuentaVanos: false, umbralVanosM2: 1, sumaRevelados: true, multiplicaCaras: true })
    const revelados = g.filas.filter(f => f.descripcion.startsWith('Revelado'))
    expect(revelados.length).toBe(2)
  })
})

describe('validaciones suaves (avisos, nunca bloqueos)', () => {
  it('vano que no cabe en el muro genera aviso', () => {
    const avisos = validarVanosEnElemento(muroBaño(2.0, [V01()])) // puerta 2,10 > altura 2,00
    expect(avisos[0]).toContain('V-01')
    expect(avisos[0]).toContain('no cabe')
  })

  it('elemento repetido en dos bloques del mismo cómputo genera aviso de medir dos veces', () => {
    const bloques = [{ id: 1, elementoId: 5 }, { id: 2, elementoId: 5 }]
    expect(avisoElementoDuplicado(5, bloques, 1)).toContain('midiendo dos veces')
    expect(avisoElementoDuplicado(5, bloques, 1)).toContain('1 bloque')
    expect(avisoElementoDuplicado(9, bloques, 1)).toBeNull()
  })
})

describe('otros modos de medición', () => {
  it('perímetro × longitud: columna 0,30×0,30 × h 3,00 = 3,60 m²', () => {
    const col: ElementoInput = { tipo: 'columna', descripcion: 'C-1', largo: 3.0, ancho: 0.3, alto: 0.3, espesor: 0, caras: 1, vanos: [] }
    const g = generarFilasDesdeElemento(col, { modo: 'perimetro_longitud', descuentaVanos: false, umbralVanosM2: 1, sumaRevelados: false })
    close(g.filas.reduce((s, f) => s + f.cantidad, 0), 2 * 0.6 * 3)
  })

  it('volumen: losa 4,00×3,00×0,10 = 1,20 m³', () => {
    const losa: ElementoInput = { tipo: 'losa', descripcion: 'LOSA BAÑO', largo: 4, ancho: 3, alto: 0, espesor: 0.1, caras: 1, vanos: [] }
    const g = generarFilasDesdeElemento(losa, { modo: 'volumen', descuentaVanos: false, umbralVanosM2: 1, sumaRevelados: false })
    close(g.filas.reduce((s, f) => s + f.cantidad, 0), 1.2)
  })

  it('conteo sin vanos carpinteros deja aviso (no bloquea)', () => {
    const g = generarFilasDesdeElemento(muroBaño(2.6, []), { modo: 'conteo', descuentaVanos: false, umbralVanosM2: 1, sumaRevelados: false })
    expect(g.avisos[0]).toContain('Sin vanos')
  })
})

describe('integración con resumenBloque (desperdicio sobre PU, F1)', () => {
  it('mampostería 10,71 m² con desperdicio 4% sobre PU viaja neta al presupuesto', () => {
    const g = generarFilasDesdeElemento(muroBaño(2.6, [V01(), V02()]), { modo: 'paño', descuentaVanos: true, umbralVanosM2: 1, sumaRevelados: false })
    const r = resumenBloque(g.filas, { desperdicioModo: 'sobre_pu', desperdicioPct: 4, sumaRevelados: false }, null, null)
    close(r.cantidadNeta, 10.71)
    close(r.cantidadAlPresupuesto, 10.71) // sobre_pu: cantidad neta; el 4% vive en el PU
  })

  it('modo en_cantidad infla la cantidad cuando el formato del cliente lo exige', () => {
    const g = generarFilasDesdeElemento(muroBaño(2.6, [V01(), V02()]), { modo: 'paño', descuentaVanos: true, umbralVanosM2: 1, sumaRevelados: false })
    const r = resumenBloque(g.filas, { desperdicioModo: 'en_cantidad', desperdicioPct: 4, sumaRevelados: false }, null, null)
    close(r.cantidadAlPresupuesto, 10.71 * 1.04)
  })
})
