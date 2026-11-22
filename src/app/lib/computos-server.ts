// Capa de servidor del módulo de cómputos métricos (Fase 1a + 1b).
// Consulta completa del cómputo + reglas de aplicación al presupuesto,
// generación de filas desde elementos y plantilla de tipología,
// compartida entre las rutas API y la generación del export.
import { db } from '@/lib/db'
import {
  resumenBloque,
  generarFilasDesdeElemento,
  avisoElementoDuplicado,
  type FilaComputoInput,
  type ElementoInput,
  type ReglaGeneracion,
} from '@/lib/computos'

export interface ComputoCompleto {
  id: number
  presupuestoId: number
  nombre: string
  valuacion: number
  medidoPor: string
  contratista: string
  inspector: string
  residente: string
  observaciones: string | null
  createdAt: Date
  updatedAt: Date
  presupuesto: {
    id: number
    nombre: string
    obra: string | null
    fecha: string | null
    cliente: string | null
  }
  elementos: Array<{
    id: number
    tipo: string
    descripcion: string
    nivel: string
    ambiente: string
    largo: number
    ancho: number
    alto: number
    espesor: number
    caras: number
    vanos: Array<{
      id: number
      vanoTipoId: number | null
      nombre: string
      tipo: string
      ancho: number
      alto: number
      antepecho: number
      cantidad: number
      generaCarpinteria: boolean
    }>
    bloques: Array<{ id: number }>
  }>
  bloques: Array<{
    id: number
    presupuestoItemId: number | null
    elementoId: number | null
    covenin: string | null
    descripcionPendiente: string | null
    unidadPendiente: string | null
    pendiente: boolean
    posicion: number
    cantidadNeta: number
    ajusteAdoptado: number | null
    justificacion: string | null
    item: {
      id: number
      covenin: string
      descripcion: string
      unidad: string
      cantidad: number
      precioUnitarioBs: number
    } | null
    regla: {
      modo: string
      descuentaVanos: boolean
      umbralVanosM2: number
      sumaRevelados: boolean
      multiplicaCaras: boolean
      desperdicioModo: string
      desperdicioPct: number
    }
    filas: Array<FilaComputoInput & {
      id: number
      posicion: number
      descripcion: string
      expresion: string
      cantidad: number
      origen: string
      modo: string | null
      vinculada: boolean
    }>
    resumen: {
      cantidadNeta: number
      cantidadAdoptada: number
      cantidadAlPresupuesto: number
      hayAjuste: boolean
      deltaAjuste: number
      advertencias: string[]
    }
    avisoElemento: string | null
  }>
  versiones: Array<{ id: number; numero: number; fecha: Date }>
}

/** Carga un cómputo completo: elementos, reglas, filas y resúmenes calculados */
export async function obtenerComputoCompleto(computoId: number): Promise<ComputoCompleto | null> {
  const computo = await db.computo.findUnique({
    where: { id: computoId },
    include: {
      presupuesto: {
        select: { id: true, nombre: true, obra: true, fecha: true, cliente: true },
      },
      elementos: {
        orderBy: { id: 'asc' },
        include: {
          vanos: { orderBy: { id: 'asc' } },
          bloques: { select: { id: true } },
        },
      },
      bloques: {
        orderBy: { posicion: 'asc' },
        include: {
          presupuestoItem: {
            select: { id: true, covenin: true, descripcion: true, unidad: true, cantidad: true, precioUnitarioBs: true },
          },
          regla: true,
          filas: { orderBy: { posicion: 'asc' } },
        },
      },
      versiones: { orderBy: { numero: 'desc' } },
    },
  })
  if (!computo) return null

  const bloquesConElemento = computo.bloques.map(b => ({ id: b.id, elementoId: b.elementoId }))

  return {
    ...computo,
    elementos: computo.elementos.map(e => ({
      id: e.id,
      tipo: e.tipo,
      descripcion: e.descripcion,
      nivel: e.nivel,
      ambiente: e.ambiente,
      largo: e.largo,
      ancho: e.ancho,
      alto: e.alto,
      espesor: e.espesor,
      caras: e.caras,
      vanos: e.vanos.map(v => ({
        id: v.id,
        vanoTipoId: v.vanoTipoId,
        nombre: v.nombre,
        tipo: v.tipo,
        ancho: v.ancho,
        alto: v.alto,
        antepecho: v.antepecho,
        cantidad: v.cantidad,
        generaCarpinteria: v.generaCarpinteria,
      })),
      bloques: e.bloques.map(b => ({ id: b.id })),
    })),
    bloques: computo.bloques.map(b => {
      const filas = b.filas.map(f => ({
        id: f.id,
        posicion: f.posicion,
        descripcion: f.descripcion,
        tipo: f.tipo as 'dimensiones' | 'directa',
        numero: f.numero,
        largo: f.largo,
        ancho: f.ancho,
        alto: f.alto,
        valorDirecto: f.valorDirecto,
        signo: f.signo as '+' | '-',
        expresion: f.expresion,
        cantidad: f.cantidad,
        origen: f.origen,
        modo: f.modo,
        vinculada: f.vinculada,
      }))
      const regla = b.regla ?? {
        modo: 'paño', descuentaVanos: true, umbralVanosM2: 1,
        sumaRevelados: false, multiplicaCaras: false,
        desperdicioModo: 'sobre_pu', desperdicioPct: 0,
      }
      return {
        id: b.id,
        presupuestoItemId: b.presupuestoItemId,
        elementoId: b.elementoId,
        covenin: b.covenin,
        descripcionPendiente: b.descripcionPendiente,
        unidadPendiente: b.unidadPendiente,
        pendiente: b.pendiente,
        posicion: b.posicion,
        cantidadNeta: b.cantidadNeta,
        ajusteAdoptado: b.ajusteAdoptado,
        justificacion: b.justificacion,
        item: b.presupuestoItem,
        regla,
        filas,
        resumen: resumenBloque(filas, regla, b.ajusteAdoptado, b.justificacion),
        avisoElemento: b.elementoId ? avisoElementoDuplicado(b.elementoId, bloquesConElemento, b.id) : null,
      }
    }),
    versiones: computo.versiones.map(v => ({ id: v.id, numero: v.numero, fecha: v.fecha })),
  }
}

// ------------------------------------------------------------------
// Fase 1b — generación y regeneración de filas desde elementos
// ------------------------------------------------------------------

export interface PreviewGeneracion {
  bloqueId: number
  partida: string
  modo: string
  elementoId: number
  elementoDescripcion: string
  filasVigentes: number
  filasGeneradas: Array<{ descripcion: string; expresion: string; signo: string; cantidad: number; aviso?: string }>
  netaVigente: number
  netaGenerada: number
  diferencia: number
  avisos: string[]
  filasVinculadasARomper: number
}

/**
 * Fase 2 — adjunta el perfil del catálogo (código + kg/m) a la regla cuando
 * la partida en modo peso lo referencia. Sin perfil, el motor avisa y genera longitud.
 */
async function perfilesDeReglas(reglas: Array<{ perfilAceroId: number | null }>) {
  const ids = [...new Set(reglas.map(r => r.perfilAceroId).filter((x): x is number => x !== null))]
  if (!ids.length) return new Map<number, { codigo: string; pesoKgM: number }>()
  const perfiles = await db.perfilAcero.findMany({ where: { id: { in: ids } } })
  return new Map(perfiles.map(p => [p.id, { codigo: p.codigo, pesoKgM: p.pesoKgM }]))
}

function reglaConPerfil<T extends { perfilAceroId?: number | null }>(
  regla: T,
  perfiles: Map<number, { codigo: string; pesoKgM: number }>,
) {
  const perfil = regla.perfilAceroId ? perfiles.get(regla.perfilAceroId) : undefined
  return {
    ...regla,
    perfilCodigo: perfil?.codigo ?? null,
    perfilPesoKgM: perfil?.pesoKgM ?? null,
  }
}

/** Elemento de BD → input puro del motor */
function elementoAInput(el: {
  id: number; tipo: string; descripcion: string; largo: number; ancho: number
  alto: number; espesor: number; caras: number
  vanos: Array<{ id: number; nombre: string; tipo: string; ancho: number; alto: number
    antepecho: number; cantidad: number; generaCarpinteria: boolean }>
}): ElementoInput {
  return {
    id: el.id, tipo: el.tipo, descripcion: el.descripcion,
    largo: el.largo, ancho: el.ancho, alto: el.alto,
    espesor: el.espesor, caras: el.caras,
    vanos: el.vanos.map(v => ({
      id: v.id, nombre: v.nombre, tipo: v.tipo, ancho: v.ancho, alto: v.alto,
      antepecho: v.antepecho, cantidad: v.cantidad, generaCarpinteria: v.generaCarpinteria,
    })),
  }
}

/**
 * Vista previa de "Generar filas desde elemento" para todos los bloques del
 * cómputo que tengan elemento fuente y regla (sin escribir la BD).
 */
export async function previsualizarGeneracion(computoId: number): Promise<PreviewGeneracion[]> {
  const computo = await db.computo.findUnique({
    where: { id: computoId },
    include: {
      elementos: { include: { vanos: true } },
      bloques: {
        include: {
          presupuestoItem: { select: { covenin: true, descripcion: true } },
          regla: true,
          filas: { where: { vinculada: true, origen: { not: 'manual' } } },
        },
      },
    },
  })
  if (!computo) return []

  const perfiles = await perfilesDeReglas(computo.bloques.map(b => b.regla).filter((r): r is NonNullable<typeof r> => !!r))
  const out: PreviewGeneracion[] = []
  for (const b of computo.bloques) {
    if (!b.elementoId) continue
    const el = computo.elementos.find(e => e.id === b.elementoId)
    if (!el) continue
    const regla = b.regla
    if (!regla) continue
    const gen = generarFilasDesdeElemento(
      elementoAInput(el),
      reglaConPerfil(regla, perfiles) as ReglaGeneracion,
    )
    const netaGenerada = gen.filas.reduce((s, f) => s + f.cantidad, 0)
    const etiqueta = b.pendiente
      ? `${b.covenin || 'S/C'} — ${b.descripcionPendiente || 'pendiente de catálogo'}`
      : `${b.presupuestoItem?.covenin || ''} — ${b.presupuestoItem?.descripcion || ''}`
    out.push({
      bloqueId: b.id,
      partida: etiqueta,
      modo: regla.modo,
      elementoId: el.id,
      elementoDescripcion: el.descripcion,
      filasVigentes: b.filas.length,
      filasGeneradas: gen.filas.map(f => ({
        descripcion: f.descripcion,
        expresion: f.expresion,
        signo: f.signo,
        cantidad: f.cantidad,
        aviso: f.aviso,
      })),
      netaVigente: b.cantidadNeta,
      netaGenerada,
      diferencia: netaGenerada - b.cantidadNeta,
      avisos: gen.avisos,
      filasVinculadasARomper: b.filas.length,
    })
  }
  return out
}

/**
 * Commit de la generación: reemplaza las filas vinculadas (origen elemento/vano)
 * por las recién generadas; las filas manuales (y las de vínculo roto) se conservan.
 * Devuelve cuántos bloques fueron regenerados.
 */
export async function aplicarGeneracion(computoId: number): Promise<{ regenerados: number; avisos: string[] }> {
  const computo = await db.computo.findUnique({
    where: { id: computoId },
    include: {
      elementos: { include: { vanos: true } },
      bloques: { include: { regla: true, filas: true } },
    },
  })
  if (!computo) return { regenerados: 0, avisos: ['Cómputo no encontrado'] }

  const avisos: string[] = []
  let regenerados = 0
  const perfiles = await perfilesDeReglas(computo.bloques.map(b => b.regla).filter((r): r is NonNullable<typeof r> => !!r))
  for (const b of computo.bloques) {
    if (!b.elementoId || !b.regla) continue
    const el = computo.elementos.find(e => e.id === b.elementoId)
    if (!el) continue
    const gen = generarFilasDesdeElemento(
      elementoAInput(el),
      reglaConPerfil(b.regla, perfiles) as ReglaGeneracion,
    )
    avisos.push(...gen.avisos)

    // Filas vinculadas viejas: se borran (las manuales y las de vínculo roto quedan)
    for (const f of b.filas) {
      if (f.origen !== 'manual' && f.vinculada) {
        await db.computoFila.delete({ where: { id: f.id } })
      }
    }
    // Filas nuevas vinculadas al elemento (y a su vano cuando aplica)
    const nManuales = b.filas.filter(f => f.origen === 'manual' || !f.vinculada).length
    let pos = nManuales
    for (const f of gen.filas) {
      let vanoId: number | null = null
      const nombreVano = f.descripcion.match(/V-(\d+)/)?.[0]
      if (nombreVano) {
        const v = el.vanos.find(vv => vv.nombre === nombreVano)
        vanoId = v?.id ?? null
      }
      await db.computoFila.create({
        data: {
          bloqueId: b.id,
          posicion: pos++,
          descripcion: f.descripcion,
          tipo: f.tipo,
          numero: f.numero,
          largo: f.largo,
          ancho: f.ancho,
          alto: f.alto,
          valorDirecto: f.valorDirecto ?? null,
          signo: f.signo,
          expresion: f.expresion,
          cantidad: f.cantidad,
          origen: f.origen,
          modo: f.modo,
          elementoId: el.id,
          vanoInstanciaId: vanoId,
          vinculada: true,
        },
      })
    }
    const neta = gen.filas.reduce((s, f) => s + f.cantidad, 0)
    await db.computoBloque.update({ where: { id: b.id }, data: { cantidadNeta: neta } })
    regenerados++
  }
  return { regenerados, avisos }
}

// ------------------------------------------------------------------
// Fase 1b — plantilla de tipología: muro de bloque de 15 cm (Tabla 5)
// Partidas reales del catálogo CIV donde existen; pendientes marcadas
// donde no (la plantilla no inventa códigos).
// ------------------------------------------------------------------

const PLANTILLA_MURO_15 = [
  { covenin: null, desc: 'MAMPOSTERÍA DE BLOQUES DE CONCRETO e=15 cm', und: 'm2', modo: 'paño', descuenta: true, umbral: 1, revelados: false, desp: 4 },
  { covenin: null, desc: 'FRISO INTERIOR EN MUROS, 2 CARAS', und: 'm2', modo: 'paño', descuenta: false, umbral: 1, revelados: true, desp: 3, caras: true },
  { covenin: null, desc: 'FRISO EN COLUMNAS Y VIGAS', und: 'm2', modo: 'perimetro_longitud', descuenta: false, umbral: 1, revelados: false, desp: 3 },
  { covenin: 'E.412.110.007', desc: 'REVESTIMIENTO DE PAREDES CON CERÁMICA', und: 'm2', modo: 'paño', descuenta: true, umbral: 0, revelados: false, desp: 8, caras: true },
  { covenin: 'E.412.120.009', desc: 'RODAPIÉ DE GRANITO', und: 'M', modo: 'lineal', descuenta: false, umbral: 1, revelados: false, desp: 3 },
  { covenin: null, desc: 'PINTURA VINI EN MUROS', und: 'm2', modo: 'paño', descuenta: true, umbral: 0, revelados: false, desp: 0, caras: true },
  { covenin: 'E.419.111.003', desc: 'CIELO RASO DE LÁMINA AGRICOLA e=8mm.', und: 'm2', modo: 'paño', descuenta: false, umbral: 1, revelados: false, desp: 3 },
  { covenin: null, desc: 'CARPINTERÍA: PUERTAS Y VENTANAS (SUMINISTRO)', und: 'pza', modo: 'conteo', descuenta: false, umbral: 1, revelados: false, desp: 0 },
  { covenin: 'E-542.112.220', desc: 'TOMACORRIENTES SENCILLOS CON TAPA METÁLICA', und: 'pza', modo: 'conteo', descuenta: false, umbral: 1, revelados: false, desp: 0 },
  { covenin: 'E-625.001.013', desc: 'PUNTOS DE INSTALACIÓN DE AGUAS CLARAS', und: 'pto', modo: 'conteo', descuenta: false, umbral: 1, revelados: false, desp: 0 },
]

export interface ResultadoPlantilla {
  bloquesCreados: number
  conPartida: string[]
  pendientes: string[]
  avisos: string[]
}

/**
 * Instancia la plantilla "muro de bloque de 15 cm" sobre un cómputo:
 * crea un bloque por fila de la Tabla 5 del contrato, enlazado a la partida
 * del presupuesto cuando existe (por covenin) y pendiente cuando no.
 * Las reglas precargadas son editables por partida (F3).
 */
export async function instanciarPlantillaMuro15(computoId: number): Promise<ResultadoPlantilla> {
  const computo = await db.computo.findUnique({
    where: { id: computoId },
    include: {
      presupuesto: { include: { items: true } },
      bloques: { include: { presupuestoItem: { select: { covenin: true } } } },
    },
  })
  if (!computo) throw new Error('Cómputo no encontrado')

  const out: ResultadoPlantilla = { bloquesCreados: 0, conPartida: [], pendientes: [], avisos: [] }
  let pos = computo.bloques.length

  for (const fila of PLANTILLA_MURO_15) {
    // No duplicar filas de plantilla ya presentes en el cómputo
    const yaExiste = computo.bloques.some(b =>
      (fila.covenin && (b.covenin === fila.covenin || b.presupuestoItem?.covenin === fila.covenin)) ||
      (b.pendiente && b.descripcionPendiente === fila.desc),
    )
    if (yaExiste) {
      out.avisos.push(`"${fila.desc}" ya está en el cómputo — no duplicada`)
      continue
    }
    // Buscar la partida en el presupuesto por covenin
    const item = fila.covenin
      ? computo.presupuesto.items.find(i => i.covenin === fila.covenin)
      : undefined

    const bloque = await db.computoBloque.create({
      data: {
        computoId,
        presupuestoItemId: item?.id ?? null,
        covenin: fila.covenin,
        descripcionPendiente: fila.desc,
        unidadPendiente: fila.und,
        pendiente: !item,
        posicion: pos++,
      },
    })
    await db.reglaMedicion.create({
      data: {
        bloqueId: bloque.id,
        modo: fila.modo,
        descuentaVanos: fila.descuenta,
        umbralVanosM2: fila.umbral,
        sumaRevelados: fila.revelados,
        multiplicaCaras: (fila as { caras?: boolean }).caras ?? false,
        desperdicioModo: 'sobre_pu',
        desperdicioPct: fila.desp,
      },
    })
    out.bloquesCreados++
    if (item) out.conPartida.push(`${fila.covenin} → item #${item.id}`)
    else out.pendientes.push(`${fila.covenin || 'S/C'} — ${fila.desc}`)
  }

  if (out.pendientes.length) {
    out.avisos.push(`${out.pendientes.length} bloque(s) quedaron "pendiente de catálogo": son computables y exportables, y aplican al presupuesto cuando la partida exista`)
  }
  return out
}

export interface PreviewAplicacion {
  partida: string
  covenin: string
  descripcion: string
  unidad: string
  bloqueId: number
  aplica: boolean
  pendiente: boolean
  cantidadNeta: number
  desperdicioModo: string
  desperdicioPct: number
  cantidadAplicada: number
  cantidadVigente: number
  diferencia: number
  justificacion: string | null
  advertencias: string[]
}

/**
 * Vista previa partida por partida de lo que haría "Aplicar al presupuesto".
 * Un bloque SIN filas y SIN ajuste no está medido: se excluye de la aplicación
 * para no poner en cero cantidades vigentes del presupuesto.
 * Los bloques pendientes de catálogo (sin item) no aplican.
 */
export function previsualizarAplicacion(computo: ComputoCompleto): PreviewAplicacion[] {
  return computo.bloques.map(b => {
    const aplica = !b.pendiente && (b.filas.length > 0 || b.resumen.hayAjuste)
    const covenin = b.pendiente ? (b.covenin || 'S/C') : (b.item?.covenin || '')
    const descripcion = b.pendiente ? (b.descripcionPendiente || 'Pendiente de catálogo') : (b.item?.descripcion || '')
    const unidad = b.pendiente ? (b.unidadPendiente || '') : (b.item?.unidad || '')
    const vigente = b.pendiente ? 0 : (b.item?.cantidad ?? 0)
    return {
      partida: `#${b.presupuestoItemId ?? b.id}`,
      covenin,
      descripcion: descripcion + (b.pendiente ? ' (pendiente de catálogo)' : ''),
      unidad,
      bloqueId: b.id,
      aplica,
      pendiente: b.pendiente,
      cantidadNeta: b.resumen.cantidadNeta,
      desperdicioModo: b.regla.desperdicioModo,
      desperdicioPct: b.regla.desperdicioPct,
      cantidadAplicada: aplica ? b.resumen.cantidadAlPresupuesto : vigente,
      cantidadVigente: vigente,
      diferencia: aplica ? b.resumen.cantidadAlPresupuesto - vigente : 0,
      justificacion: b.resumen.hayAjuste ? (b.justificacion || null) : null,
      advertencias: b.resumen.advertencias,
    }
  })
}
