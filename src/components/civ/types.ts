// Tipos compartidos de la interfaz CIV

export type ViewId =
  | 'catalogo'
  | 'presupuesto'
  | 'computos'
  | 'guardados'
  | 'recientes'
  | 'tabuladores'
  | 'configuracion'

export interface PartidaListItem {
  id: number
  covenin: string
  guiaId: number
  guiaNombre: string
  unidad: string
  rendimiento: number
  descripcion: string
  precioUnitarioBs: number
  costoDirectoUnitarioBs: number
  paginaPdf: number | null
}

export interface GuiaInfo {
  id: number
  nombre: string
  partidas: number
}

// Línea de análisis tal cual la devuelve /api/analisis?id=
export interface LineaMaterial {
  id: number
  descripcion: string
  unidad: string | null
  cantidad: number
  costoBs: number
  totalBs: number
}

export interface LineaEquipo {
  id: number
  descripcion: string
  cantidad: number
  cop: number | null
  costoBs: number
  totalBs: number
}

export interface LineaManoObra {
  id: number
  cargo: string
  cantidad: number
  jornalBs: number
  totalBs: number
}

export interface PartidaDetalle {
  partida: {
    id: number
    covenin: string
    guiaId: number
    guiaNombre?: string
    unidad: string
    cantidad: string
    rendimiento: number
    descripcion: string
    paginaPdf: number | null
    // ¿partida creada en el editor (S/C o código propio)? — habilita el botón Eliminar
    esPropia?: boolean
    // nº de ítems de presupuestos guardados que la referencian
    enPresupuestos?: number
    parametros: {
      fcasPct: number
      ceduPct: number
      bonoAlimenticioDiario: number
      administracionPct: number
      utilidadPct: number
      ivaPct: number
    }
    materiales: LineaMaterial[]
    equipos: LineaEquipo[]
    manoObra: LineaManoObra[]
    calculo: {
      totalMaterialesBs: number
      totalEquiposBs: number
      subTotalManoObraBs: number
      totalDiasManoObra: number
      factorCostosBs: number
      totalManoObraFactorBs: number
      bonoAlimenticioBs: number
      totalBonoMasBs: number
      rendimiento: number
      unitarioMaterialesBs: number
      unitarioEquiposBs: number
      unitarioManoObraBs: number
      costoDirectoUnitarioBs: number
      administracionBs: number
      subTotalAdminBs: number
      utilidadBs: number
      precioUnitarioSinIvaBs: number
      ivaBs: number
      precioUnitarioBs: number
    }
  }
}

// Líneas editables del APU (modo edición del drawer)
export interface LineaEditMaterial { descripcion: string; unidad: string; cantidad: string; costoBs: string }
export interface LineaEditEquipo { descripcion: string; cantidad: string; cop: string; costoBs: string }
export interface LineaEditManoObra { cargo: string; cantidad: string; jornalBs: string }

// Estado de edición del APU (los números quedan como texto, se parsean al calcular/guardar)
export interface ApuEditState {
  descripcion: string
  unidad: string
  rendimiento: string
  materiales: LineaEditMaterial[]
  equipos: LineaEditEquipo[]
  manoObra: LineaEditManoObra[]
  parametros: { fcasPct: string; ceduPct: string; bonoAlimenticioDiario: string; administracionPct: string; utilidadPct: string; ivaPct: string }
}

// Líneas numéricas que viajan al servidor (ya parseadas)
export interface LineaGuardadaMaterial { descripcion: string; unidad?: string | null; cantidad: number; costoBs: number }
export interface LineaGuardadaEquipo { descripcion: string; cantidad: number; cop?: number | null; costoBs: number }
export interface LineaGuardadaManoObra { cargo: string; cantidad: number; jornalBs: number }

export interface PayloadGuardarApu {
  descripcion: string
  unidad: string
  rendimiento: number
  parametros: { fcasPct: number; ceduPct: number; bonoAlimenticioDiario: number; administracionPct: number; utilidadPct: number; ivaPct: number }
  materiales: LineaGuardadaMaterial[]
  equipos: LineaGuardadaEquipo[]
  manoObra: LineaGuardadaManoObra[]
}

// Líneas de composición de una partida personalizada (S/C)
export interface LineaSCMaterial { descripcion: string; unidad?: string | null; cantidad: number; costoBs: number }
export interface LineaSCEquipo { descripcion: string; cantidad: number; cop?: number | null; costoBs: number }
export interface LineaSCManoObra { cargo: string; cantidad: number; jornalBs: number }
export interface ComposicionSC {
  materiales: LineaSCMaterial[]
  equipos: LineaSCEquipo[]
  manoObra: LineaSCManoObra[]
}

// Ítem del presupuesto en construcción (cliente)
export interface ItemPartida {
  partidaAnalisisId: number | null
  covenin: string
  descripcion: string
  unidad: string
  rendimiento?: number
  precioUnitarioBs: number
  cantidad: number
  seccion?: string | null
  esPersonalizada?: boolean
  // Solo S/C sin composición: precio unitario estipulado SIN IVA
  precioDirectoBs?: number | null
  // Solo S/C con composición
  lineas?: ComposicionSC
}

// Entrada de "Recientes" (persistida en localStorage)
export interface RecienteItem {
  id: number
  covenin: string
  descripcion: string
  unidad: string
  rendimiento: number
  precioUnitarioBs: number
  costoDirectoUnitarioBs: number
  guiaNombre: string
  ts: number
}

// Presupuesto guardado (lista)
export interface PresupuestoListItem {
  id: number
  nombre: string
  cliente: string | null
  obra: string | null
  fecha: string | null
  itemCount: number
  totalConIvaBs: number
  updatedAt: string
}

export interface PresupuestoDetalle {
  presupuesto: {
    id: number
    nombre: string
    cliente: string | null
    obra: string | null
    fecha: string | null
    descripcion: string | null
    parametros: {
      fcasPct: number
      ceduPct: number
      bonoAlimenticioDiario: number
      administracionPct: number
      utilidadPct: number
      ivaPct: number
    }
    createdAt: string
    updatedAt: string
  }
  items: Array<{
    id: number
    posicion: number
    partidaAnalisisId: number | null
    covenin: string
    descripcion: string
    unidad: string
    cantidad: number
    rendimiento: number | null
    precioUnitarioBs: number
    totalBs: number
    notas: string | null
    seccion: string | null
    esPersonalizada: boolean
    precioDirectoBs: number | null
    composicion: ComposicionSC | null
  }>
  totalizacion: {
    subtotalCostoDirectoBs: number
    subtotalAdministracionBs: number
    subtotalUtilidadBs: number
    subtotalSinIvaBs: number
    totalIvaBs: number
    totalConIvaBs: number
  }
}

export interface TabuladorRow {
  codigo: string
  denominacion: string
  descripcion: string
  nivel: number
  oficio: string
  jornalBs: number
  jornalHomologacionBs: number | null
  fechaTabulador: string
}

export interface TabuladorData {
  items: TabuladorRow[]
  total: number
  vigencia: string
  bonoAlimenticioDiario: number
  bonoAlimenticioMensual: number
  contrato: string
}
