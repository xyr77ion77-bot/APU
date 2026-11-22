// ============================================================
// Núcleo de cómputos métricos — Fase 1a
// Contrato de diseño v1.0 (A1–A8, C, D, F1–F3)
// Reglas fuente de verdad compartidas por API y UI.
// ============================================================

// Catálogo de unidades del cómputo (A3)
export const UNIDADES_COMPUTO = [
  'ML', 'M2', 'M3', 'KGS', 'PIEZA', 'kgf·m', 'PUNTO', 'm3·Km', 'tnf·Km',
] as const
export type UnidadComputo = (typeof UNIDADES_COMPUTO)[number]

// Unidades que tienen columna propia en la planilla exportada
export const COLUMNAS_PLANILLA = ['ML', 'M2', 'M3', 'KGS', 'PIEZA'] as const

// Modos de medición por partida (F3: atributo de partida, no de fila)
export const MODOS_MEDICION = [
  { id: 'paño', label: 'Paño', ayuda: 'Ancho × Alto del elemento, con deducciones' },
  { id: 'perimetro_longitud', label: 'Perímetro × longitud', ayuda: '(2 × (base + altura)) × longitud — columnas y vigas' },
  { id: 'lineal', label: 'Lineal', ayuda: 'Longitud del elemento — zócalos, drenajes' },
  { id: 'volumen', label: 'Volumen', ayuda: 'Largo × Ancho × Alto — concretos, rellenos' },
  { id: 'peso', label: 'Peso', ayuda: 'Longitud o piezas × peso unitario — perfiles, acero' },
  { id: 'conteo', label: 'Conteo', ayuda: 'Suma de unidades — puntos, aparatos' },
] as const
export type ModoMedicion = (typeof MODOS_MEDICION)[number]['id']

// Desperdicio (C): el cómputo mide neto; sobre_pu por defecto (F1)
export const MODOS_DESPERDICIO = [
  { id: 'sobre_pu', label: 'Sobre el PU', ayuda: 'La cantidad que viaja al presupuesto es la neta; el % se refleja en el precio unitario' },
  { id: 'en_cantidad', label: 'En la cantidad', ayuda: 'La cantidad del bloque ya incluye el % (formato del cliente)' },
  { id: 'ambos', label: 'Ambos', ayuda: 'Caso mixto: cantidad inflada y nota en el PU' },
] as const
export type ModoDesperdicio = (typeof MODOS_DESPERDICIO)[number]['id']

// Porcentajes de desperdicio precargados por material (Tabla 3 del contrato)
const DESPERDICIO_POR_MATERIAL: Array<{ patron: RegExp; pct: number }> = [
  { patron: /ceramica|cerámica|porcelanato|granito/i, pct: 8 },
  { patron: /mamposteria|mampostería|bloque/i, pct: 4 },
  { patron: /acero|cabilla|varilla|refuerzo/i, pct: 5 },
  { patron: /friso|revoque/i, pct: 3 },
  { patron: /carpinteria|carpintería|puerta|ventana/i, pct: 0 },
  { patron: /pintura|impermeabiliz/i, pct: 0 },
]

// Modo de medición sugerido según la unidad de la partida
export function modoSugeridoPorUnidad(unidad: string): ModoMedicion {
  const u = (unidad || '').toUpperCase()
  if (u === 'M2') return 'paño'
  if (u === 'M' || u === 'ML') return 'lineal'
  if (u === 'M3') return 'volumen'
  if (u === 'KG' || u === 'KGS' || u === 'KG.M' || u === 'KGF.M') return 'peso'
  return 'conteo' // pza, und, pto, global...
}

export function desperdicioSugeridoPorDescripcion(descripcion: string): number {
  for (const { patron, pct } of DESPERDICIO_POR_MATERIAL) {
    if (patron.test(descripcion || '')) return pct
  }
  return 0
}

// ---------- Cálculo de filas ----------

/** Parse tolerante a formato venezolano: "5,40" → 5.4; devuelve null si no es numérico */
export function parseNumEs(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = parseFloat(String(v).trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export interface FilaComputoInput {
  tipo: 'dimensiones' | 'directa'
  numero: number      // Nº
  largo: number
  ancho: number
  alto: number
  valorDirecto?: number | null
  signo: '+' | '-'
}

export interface FilaComputoCalculada extends FilaComputoInput {
  cantidad: number    // con signo aplicado
  expresion: string   // expresión visible para auditoría
}

function fmt(n: number, decimales?: number): string {
  if (!Number.isFinite(n)) return '0'
  const r = Math.round(n * 10000) / 10000
  // Sin decimales explícitos se conserva el comportamiento histórico (hasta 4)
  return decimales !== undefined
    ? r.toLocaleString('es-VE', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })
    : r.toLocaleString('es-VE', { maximumFractionDigits: 4 })
}

/** Cantidad bruta de una fila (sin signo).
 *  Convención de la planilla: una celda de dimensión vacía o 0 multiplica como 1
 *  (solo cuentan las columnas llenas: Nº×L, Nº×L×A, Nº×L×A×H...). */
export function cantidadBrutaFila(f: FilaComputoInput): number {
  if (f.tipo === 'directa') return Number(f.valorDirecto || 0)
  const dim = (v: number | null | undefined) =>
    v && Number.isFinite(v) && v !== 0 ? v : 1
  return (f.numero || 0) * dim(f.largo) * dim(f.ancho) * dim(f.alto)
}

/** Expresión visible de la fila (auditoría sin abrir el catálogo) */
export function expresionFila(f: FilaComputoInput): string {
  if (f.tipo === 'directa') {
    return `cant. directa ${fmt(f.valorDirecto || 0)}`
  }
  const partes: string[] = []
  const dims: Array<[string, number]> = [
    ['Nº', f.numero], ['L', f.largo], ['A', f.ancho], ['H', f.alto],
  ]
  for (const [etq, v] of dims) {
    if (v && v !== 0) partes.push(fmt(v))
  }
  const bruta = cantidadBrutaFila(f)
  if (partes.length <= 1) return `${fmt(bruta)}`
  return `${partes.join(' × ')} = ${fmt(bruta)}`
}

/** Fila calculada: cantidad con signo + expresión */
export function calcularFila(f: FilaComputoInput): FilaComputoCalculada {
  const bruta = cantidadBrutaFila(f)
  const cantidad = f.signo === '-' ? -Math.abs(bruta) : Math.abs(bruta)
  return { ...f, cantidad, expresion: expresionFila(f) }
}

// ---------- Cálculo de bloque ----------

export interface ResumenBloque {
  cantidadNeta: number
  cantidadAdoptada: number
  cantidadAlPresupuesto: number   // después del desperdicio según su modo (C/F1)
  hayAjuste: boolean
  deltaAjuste: number             // adoptada - neta
  advertencias: string[]
}

/**
 * Resumen de un bloque a partir de sus filas y su regla.
 * - sobre_pu: la cantidad que viaja es la neta (el % vive en el PU)
 * - en_cantidad / ambos: la cantidad que viaja incluye el %
 */
export function resumenBloque(
  filas: FilaComputoInput[],
  regla: { desperdicioModo: string; desperdicioPct: number; sumaRevelados: boolean },
  ajusteAdoptado: number | null,
  justificacion: string | null | undefined,
): ResumenBloque {
  const cantidades = filas.map(calcularFila)
  const neta = cantidades.reduce((s, f) => s + f.cantidad, 0)
  const hayAjuste = ajusteAdoptado !== null && ajusteAdoptado !== undefined && Number.isFinite(ajusteAdoptado)
  const adoptada = hayAjuste ? (ajusteAdoptado as number) : neta
  const pct = Math.max(0, regla.desperdicioPct || 0)
  const infla = regla.desperdicioModo === 'sobre_pu' ? 1 : 1 + pct / 100
  const alPresupuesto = adoptada * infla

  const advertencias: string[] = []
  // Validación suave: filas deductivas que exceden el bruto acumulado
  const brutas = cantidades.filter(f => f.cantidad > 0).reduce((s, f) => s + f.cantidad, 0)
  const deductivas = cantidades.filter(f => f.cantidad < 0).reduce((s, f) => s + f.cantidad, 0)
  if (deductivas < 0 && Math.abs(deductivas) > brutas + 1e-9) {
    advertencias.push('Los descuentos exceden el bruto acumulado del bloque')
  }
  if (hayAjuste && adoptada !== neta) {
    advertencias.push('Cantidad ajustada manualmente sobre la suma de filas')
  }
  if (hayAjuste && !(justificacion || '').trim()) {
    advertencias.push('El ajuste adoptado exige justificación obligatoria')
  }

  return {
    cantidadNeta: neta,
    cantidadAdoptada: adoptada,
    cantidadAlPresupuesto: alPresupuesto,
    hayAjuste,
    deltaAjuste: adoptada - neta,
    advertencias,
  }
}

// ---------- Formato ----------

export function fmtCantidad(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return (Math.round(n * 10000) / 10000).toLocaleString('es-VE', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

export function fmtM2(n: number): string {
  return (Math.round(n * 100) / 100).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ============================================================
// Fase 1b — generación de filas desde elementos constructivos
// El elemento y sus vanos solo ASISTEN: generan filas vinculadas
// con expresión visible; el usuario puede romper el vínculo.
// ============================================================

export interface VanoInstanciaInput {
  id?: number
  nombre: string           // "V-01"
  tipo: string             // puerta | ventana | celosia | ducha | aparato
  ancho: number
  alto: number
  antepecho: number
  cantidad: number
  generaCarpinteria: boolean
  /** Override por vano: fuerza el descuento aunque el área quede bajo el umbral */
  overrideDescuento?: boolean
  justificacionOverride?: string | null
}

export interface ElementoInput {
  id?: number
  tipo: 'muro' | 'losa' | 'columna' | 'paño' | string
  descripcion: string
  nivel?: string
  ambiente?: string
  largo: number
  ancho: number
  alto: number
  espesor: number
  caras: number
  vanos: VanoInstanciaInput[]
}

export interface ReglaGeneracion {
  modo: ModoMedicion | string
  descuentaVanos: boolean
  umbralVanosM2: number
  sumaRevelados: boolean
  /** El paño multiplica por las caras del elemento (friso/cerámica/pintura);
   *  la mampostería mide el muro una vez, tenga 1 o 2 caras de acabado. */
  multiplicaCaras?: boolean
  // Fase 2 — modo peso: perfil del catálogo (código y kg/m, cargados por el
  // servidor) y separación de barras para acero de refuerzo
  perfilCodigo?: string | null
  perfilPesoKgM?: number | null
  separacionAceroM?: number | null
}

export interface FilaGenerada {
  descripcion: string
  tipo: 'dimensiones' | 'directa'
  numero: number
  largo: number
  ancho: number
  alto: number
  valorDirecto?: number | null
  signo: '+' | '-'
  expresion: string
  cantidad: number
  origen: 'elemento' | 'vano'
  modo: string
  /** Aviso de regla: el vano se creó pero no genera deducción (umbral) */
  aviso?: string
}

/** Área de proyección de un vano (incluye su cantidad) */
export function areaVano(v: VanoInstanciaInput): number {
  return Math.abs(v.ancho) * Math.abs(v.alto) * Math.max(1, v.cantidad)
}

/**
 * ¿El vano descuenta en esta regla? Criterio del contrato:
 *  - la regla de la partida puede anular el descuento o forzarlo con umbral 0
 *  - por vano: descuenta si área ≥ umbral; override justificado fuerza el descuento
 */
export function vanoDescuenta(
  v: VanoInstanciaInput,
  regla: Pick<ReglaGeneracion, 'descuentaVanos' | 'umbralVanosM2'>,
): boolean {
  if (!regla.descuentaVanos) return false
  if (v.overrideDescuento) return true
  const umbral = regla.umbralVanosM2 ?? 1
  return areaVano(v) >= umbral - 1e-9
}

/** Validación suave: el vano debe caber en el muro (aviso, no bloqueo) */
export function validarVanosEnElemento(el: ElementoInput): string[] {
  const avisos: string[] = []
  for (const v of el.vanos) {
    if (el.tipo === 'muro' || el.tipo === 'paño') {
      const cabeAncho = v.ancho * Math.max(1, v.cantidad) <= el.largo + 1e-9 || v.ancho <= el.largo + 1e-9
      const cabeAlto = v.alto + v.antepecho <= el.alto + 1e-9
      if (!cabeAncho || !cabeAlto) {
        avisos.push(`${v.nombre} (${v.ancho}×${v.alto}) no cabe en ${el.descripcion} (${el.largo}×${el.alto}) — validar override`)
      }
    }
  }
  return avisos
}

/**
 * Genera las filas del bloque desde el elemento según el modo de la regla (F3).
 * Un mismo muro alimenta partidas distintas porque cada una trae su modo:
 *   paño (mampostería/friso/cerámica/pintura), lineal (rodapié),
 *   conteo (carpintería por vano), perimetro_longitud (columnas/vigas),
 *   volumen (concretos/losas).
 * El modo efectivo queda fotografiado en cada fila para auditoría.
 */
export function generarFilasDesdeElemento(
  el: ElementoInput,
  regla: ReglaGeneracion,
): { filas: FilaGenerada[]; avisos: string[] } {
  const avisos = validarVanosEnElemento(el)
  const filas: FilaGenerada[] = []
  const modo = regla.modo

  const pushDim = (
    descripcion: string,
    d: { numero?: number; largo?: number; ancho?: number; alto?: number },
    signo: '+' | '-',
    aviso?: string,
  ) => {
    const input: FilaComputoInput = {
      tipo: 'dimensiones',
      numero: d.numero ?? 1,
      largo: d.largo ?? 0,
      ancho: d.ancho ?? 0,
      alto: d.alto ?? 0,
      signo,
    }
    const calc = calcularFila(input)
    filas.push({
      descripcion, tipo: 'dimensiones',
      numero: input.numero, largo: input.largo, ancho: input.ancho, alto: input.alto,
      valorDirecto: null, signo,
      expresion: calc.expresion, cantidad: calc.cantidad,
      origen: 'elemento', modo, aviso,
    })
  }

  const pushDirecta = (
    descripcion: string,
    valor: number,
    signo: '+' | '-' = '+',
    aviso?: string,
    expresionCustom?: string,
  ) => {
    const input: FilaComputoInput = { tipo: 'directa', numero: 1, largo: 0, ancho: 0, alto: 0, valorDirecto: valor, signo }
    const calc = calcularFila(input)
    filas.push({
      descripcion, tipo: 'directa', numero: 1, largo: 0, ancho: 0, alto: 0,
      valorDirecto: valor, signo,
      expresion: expresionCustom || calc.expresion, cantidad: calc.cantidad,
      origen: 'elemento', modo, aviso,
    })
  }

  if (modo === 'paño') {
    // Paño del elemento: muro → largo × altura; losa/paño → largo × ancho
    const esMuro = el.tipo === 'muro'
    const L = esMuro ? el.largo : el.largo
    const H = esMuro ? el.alto : el.ancho
    const caras = regla.multiplicaCaras ? Math.max(1, esMuro ? el.caras : 1) : 1
    pushDim(`Paño de ${el.descripcion}`, { numero: caras, largo: L, ancho: H }, '+')
    for (const v of el.vanos) {
      const descuenta = vanoDescuenta(v, regla)
      if (descuenta) {
        pushDim(`${v.nombre} ${v.tipo} ${v.ancho}×${v.alto} m`, { numero: Math.max(1, v.cantidad), largo: v.ancho, ancho: v.alto }, '-')
      } else {
        // Aviso del BLOQUE, no una fila: la fila es la unidad de verdad y una
        // fila con las dimensiones del vano mediría dos veces (contrato, C)
        avisos.push(`${v.nombre} no descuenta: ${fmt(areaVano(v))} m² ${regla.umbralVanosM2 ? `menor que el umbral ${regla.umbralVanosM2} m²` : 'según la regla de la partida'} — el vano se creó y queda registrado para revisión`)
      }
      if (regla.sumaRevelados && !descuenta) {
        // Revelado lateral del vano: 2 × (ancho + alto) × cantidad
        const perim = 2 * (v.ancho + v.alto) * Math.max(1, v.cantidad)
        pushDirecta(`Revelado ${v.nombre}`, perim, '+')
      }
    }
  } else if (modo === 'perimetro_longitud') {
    // Columnas y vigas: perímetro de la sección × longitud
    const perim = 2 * (el.ancho + el.alto)
    pushDim(`Perímetro 2×(${el.ancho}+${el.alto}) × L ${el.largo}`, { numero: 1, largo: perim, ancho: el.largo }, '+')
  } else if (modo === 'lineal') {
    // Zócalos y cenefas: longitud − vanos de piso a techo (antepecho 0)
    pushDim(`Longitud de ${el.descripcion}`, { numero: 1, largo: el.largo }, '+')
    for (const v of el.vanos) {
      if (v.antepecho === 0 && (v.tipo === 'puerta' || v.tipo === 'ducha')) {
        pushDim(`${v.nombre} ${v.tipo} corta el zócalo (ancho ${v.ancho} m)`, { numero: Math.max(1, v.cantidad), largo: v.ancho }, '-')
      }
    }
  } else if (modo === 'volumen') {
    // Concretos y rellenos: largo × ancho × (espesor si existe, si no alto)
    const H = el.espesor > 0 ? el.espesor : el.alto
    pushDim(`Volumen de ${el.descripcion}`, { numero: 1, largo: el.largo, ancho: el.ancho, alto: H }, '+')
  } else if (modo === 'conteo') {
    // Carpintería y aparatos: una pieza por vano que genera suministro
    for (const v of el.vanos) {
      if (v.generaCarpinteria || v.tipo === 'aparato') {
        pushDirecta(`${v.nombre} ${v.tipo} ${v.ancho}×${v.alto} m`, Math.max(1, v.cantidad), '+')
      }
    }
    if (!filas.length) {
      avisos.push('Sin vanos que generen conteo: agrega vanos con carpintería o usa filas manuales')
    }
  } else if (modo === 'peso') {
    // Fase 2 — peso con el catálogo: perfiles lineales (kg = L × kg/m) o
    // acero de refuerzo por separación (muro/losa: 2 direcciones)
    const peso = regla.perfilPesoKgM ?? 0
    const codigo = regla.perfilCodigo || 'perfil'
    if (peso > 0 && regla.separacionAceroM && regla.separacionAceroM > 0) {
      // Acero de refuerzo: una malla, dos direcciones (muro/losa) o una (columna/paño)
      const sep = regla.separacionAceroM
      if (el.tipo === 'muro') {
        const h = calcularAceroDir(el.largo, el.largo, sep, peso)
        pushDirecta(`Acero horizontal ${codigo} @${sep} m — ${h.nBarras} barras de ${fmt(el.largo)} m`, h.kg, '+', undefined,
          `${h.nBarras} × ${fmt(el.largo)} m = ${fmt(h.longitudM)} m × ${fmt(peso, 3)} kg/m (${codigo}) = ${fmt(h.kg)} kg`)
        const v = calcularAceroDir(el.alto, el.alto, sep, peso)
        pushDirecta(`Acero vertical ${codigo} @${sep} m — ${v.nBarras} barras de ${fmt(el.alto)} m`, v.kg, '+', undefined,
          `${v.nBarras} × ${fmt(el.alto)} m = ${fmt(v.longitudM)} m × ${fmt(peso, 3)} kg/m (${codigo}) = ${fmt(v.kg)} kg`)
      } else if (el.tipo === 'losa') {
        const dx = calcularAceroDir(el.ancho, el.largo, sep, peso)
        pushDirecta(`Acero dir. X ${codigo} @${sep} m — ${dx.nBarras} barras de ${fmt(el.largo)} m`, dx.kg, '+', undefined,
          `${dx.nBarras} × ${fmt(el.largo)} m = ${fmt(dx.longitudM)} m × ${fmt(peso, 3)} kg/m (${codigo}) = ${fmt(dx.kg)} kg`)
        const dy = calcularAceroDir(el.largo, el.ancho, sep, peso)
        pushDirecta(`Acero dir. Y ${codigo} @${sep} m — ${dy.nBarras} barras de ${fmt(el.ancho)} m`, dy.kg, '+', undefined,
          `${dy.nBarras} × ${fmt(el.ancho)} m = ${fmt(dy.longitudM)} m × ${fmt(peso, 3)} kg/m (${codigo}) = ${fmt(dy.kg)} kg`)
      } else {
        const u = calcularAceroDir(el.largo, el.largo, sep, peso)
        pushDirecta(`Acero ${codigo} @${sep} m — ${u.nBarras} barras de ${fmt(el.largo)} m`, u.kg, '+', undefined,
          `${u.nBarras} × ${fmt(el.largo)} m = ${fmt(u.longitudM)} m × ${fmt(peso, 3)} kg/m (${codigo}) = ${fmt(u.kg)} kg`)
      }
    } else if (peso > 0) {
      // Perfil lineal: longitud del elemento × kg/m
      pushDirecta(`Perfil ${codigo} en ${el.descripcion} — ${fmt(el.largo)} m`, el.largo * peso, '+', undefined,
        `${fmt(el.largo)} m × ${fmt(peso, 3)} kg/m (${codigo}) = ${fmt(el.largo * peso)} kg`)
    } else {
      pushDirecta(`Longitud de ${el.descripcion} (kg por catálogo de perfiles)`, el.largo, '+')
      avisos.push('Modo peso sin perfil: asigna un perfil con kg/m a la regla para que las filas salgan en KGS')
    }
  } else {
    avisos.push(`Modo de medición desconocido: ${modo} — usa filas manuales`)
  }

  return { filas, avisos }
}

/**
 * Fase 2 — una dirección del acero de refuerzo: nº de barras a la separación
 * dada, longitud total y peso nominal (kg = longitud × kg/m del catálogo).
 */
export function calcularAceroDir(
  largoRecorrido: number,
  largoBarra: number,
  separacion: number,
  pesoKgM: number,
): { nBarras: number; longitudM: number; kg: number } {
  const sep = separacion > 0 ? separacion : 1
  const nBarras = Math.floor(largoRecorrido / sep + 1e-9) + 1
  const longitudM = nBarras * largoBarra
  return { nBarras, longitudM, kg: longitudM * pesoKgM }
}

/**
 * Aviso de integridad (contrato): un elemento no debe alimentar dos bloques
 * del mismo cómputo sin aviso — es el error más caro del cómputo manual.
 */
export function avisoElementoDuplicado(
  elementoId: number,
  bloquesConElemento: Array<{ id: number; elementoId: number | null }>,
  bloqueActualId?: number,
): string | null {
  const otros = bloquesConElemento.filter(b => b.elementoId === elementoId && b.id !== bloqueActualId)
  return otros.length > 0 ? `El elemento ya alimenta ${otros.length} bloque(s) más del cómputo — verificar que no se esté midiendo dos veces` : null
}
