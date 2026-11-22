/**
 * Fixtures dorados compartidos: composiciones con PU verificado
 * contra los APUs originales del CIV (BD) y el libro Excel recalculado.
 * SC_TUBERIA = partida S/C del presupuesto de prueba id=3
 * (verificada en el libro Excel con recálculo LibreOffice: PU sin IVA 3.465.901,21).
 */
export const SC_TUBERIA = {
  rendimiento: 2,
  materiales: [
    { descripcion: 'TUBO DE CONCRETO REFORZADO Ø 90" L=2,44 M (PRECIO MERCADO)', unidad: 'pza', cantidad: 1, costoBs: 5394059.53 },
    { descripcion: 'JUNTA DE GOMA PARA TUBERÍA Ø 90"', unidad: 'pza', cantidad: 1, costoBs: 45220.5 },
  ],
  equipos: [
    { descripcion: 'GRUA P&H CAPACIDAD 25 TON TELESCOPICA', cantidad: 1, cop: 0.01, costoBs: 1794786.45 },
  ],
  manoObra: [
    { cargo: 'OBRERO DE 1era.', cantidad: 2, jornalBs: 2079.06 },
  ],
}

// --- Partidas de la BD con PU verificado contra el APU original del CIV ---
// (unitarioMaterialesBs / unitarioEquiposBs extraídos del PDF; el motor los usa tal cual)
export const BD_E114 = {
  rendimiento: 70,
  materiales: [
    { descripcion: 'CABLE TW # 12 AWG/MCM (THHN 90° C 600 V)', unidad: 'm', cantidad: 2, costoBs: 1088.38 },
    { descripcion: 'CABLE TW # 6 AWG/MCM (THHN 90° C 600 V)', unidad: 'm', cantidad: 3, costoBs: 4974.46 },
    { descripcion: 'TUBERIA EMT D=1" L= 3.00 m', unidad: 'm', cantidad: 1.1, costoBs: 3390.72 },
    { descripcion: 'CONECTOR E.M.T. D=1"', unidad: 'pieza', cantidad: 1, costoBs: 981.4 },
    { descripcion: 'ANILLO E.M.T. D=1"', unidad: 'pieza', cantidad: 0.33, costoBs: 981.4 },
    { descripcion: 'CURVA E.M.T. D=1"', unidad: 'pieza', cantidad: 0.33, costoBs: 1897.69 },
    { descripcion: 'CAJETIN RECTAN. 4x2" HUECOS 1/2"o 3/4"', unidad: 'pieza', cantidad: 0.4, costoBs: 3632.59 },
    { descripcion: 'CAJETIN CUADRADO DE 5"x5"(HUECO 1")', unidad: 'pieza', cantidad: 0.1, costoBs: 3362.82 },
    { descripcion: 'TRANSPORTE DE MATERIALES (10%)', unidad: '%', cantidad: 0.1, costoBs: 24550.7497 },
  ],
  equipos: [
    { descripcion: 'CORTADORA DE TUBOS MANUAL DE 1/8"-1"', cantidad: 1, cop: 0.01, costoBs: 79047.14 },
    { descripcion: 'LLAVE DE TUBO # 14 RIDGID', cantidad: 2, cop: 0.01, costoBs: 74581.99 },
    { descripcion: 'CINTA METRICA DE ACERO DE 5 m, MARCA STANLEY', cantidad: 2, cop: 0.01, costoBs: 13197.78 },
    { descripcion: 'SEGUETA AJUSTABLE', cantidad: 1, cop: 0.01, costoBs: 18930.38 },
    { descripcion: 'DOBLADORA DE TUBO EMT DE HASTA 3/4" /B-1678 (RIDGID)', cantidad: 1, cop: 0.006, costoBs: 155350.08 },
  ],
  manoObra: [
    { cargo: 'OBRERO DE 1ra.', cantidad: 1, jornalBs: 2079.06 },
    { cargo: 'AYUDANTE', cantidad: 1, jornalBs: 2256.84 },
    { cargo: 'ELECTRICISTA DE 1ra.', cantidad: 1, jornalBs: 2771.26 },
    { cargo: 'MAESTRO ELECTRICISTA', cantidad: 0.5, jornalBs: 2940.68 },
  ],
  unitarioMaterialesBs: 385.7975,
  unitarioEquiposBs: 52.3924,
  // PU sin IVA de la BD (PartidaAnalisis.precioUnitarioBs, verificado vs PDF)
  puConIvaEsperado: 1543.2153, puSinIvaEsperado: 1330.3580,
}

export const BD_E462 = {
  rendimiento: 50,
  materiales: [
    { descripcion: 'BARNIZ MATE TRANSPARENTE MONTANA', unidad: 'gal', cantidad: 0.04, costoBs: 38539.84 },
    { descripcion: 'SOLVENTE UNIVERSAL', unidad: 'gal', cantidad: 0.015, costoBs: 44123.61 },
    { descripcion: 'ESTOPA NACIONAL PESO= 12Kgf/rollo', unidad: 'Kgf', cantidad: 0.005, costoBs: 6588.42 },
    { descripcion: 'TIRRO CELOVEN A= 1" L=45 m', unidad: 'rollo', cantidad: 0.005, costoBs: 4558.18 },
    { descripcion: 'LIJA 3-M GRANO 80 PLIEGO 9 x 11', unidad: 'pieza', cantidad: 0.05, costoBs: 1511.64 },
    { descripcion: 'SELLADOR NITRO P/MADERA MARCA VITRO', unidad: 'gal', cantidad: 0.025, costoBs: 19767.6 },
  ],
  equipos: [
    { descripcion: 'BROCHA PROFESIONAL RUBI MARCA CERDEX 2"', cantidad: 2, cop: 0.01, costoBs: 8800.07 },
    { descripcion: 'BROCHA PROFESIONAL RUBI MARCA CERDEX 4"', cantidad: 2, cop: 0.01, costoBs: 12151.26 },
    { descripcion: 'ESCALERA TIPO TIJERA DE ALUMINIO DE 7 TRAMOS (PELDAÑOS)', cantidad: 1, cop: 0.005, costoBs: 82982.06 },
    { descripcion: 'ESPATULA DE 4"', cantidad: 2, cop: 0.01, costoBs: 6279.12 },
    { descripcion: 'ESCALERA EXTENSIBLE ALUMINIO 20 TRAMOS', cantidad: 1, cop: 0.01, costoBs: 246513.6 },
  ],
  manoObra: [
    { cargo: 'AYUDANTE', cantidad: 1, jornalBs: 2256.84 },
    { cargo: 'PINTOR DE 2da.', cantidad: 1, jornalBs: 2346.7 },
    { cargo: 'PINTOR DE 1ra.', cantidad: 1, jornalBs: 2771.26 },
    { cargo: 'MAESTRO PINTOR', cantidad: 0.25, jornalBs: 2940.68 },
  ],
  unitarioMaterialesBs: 56.5791,
  unitarioEquiposBs: 68.4931,
  puConIvaEsperado: 1365.7385, puSinIvaEsperado: 1177.3608,
}

export const BD_E316 = {
  rendimiento: 40,
  materiales: [],
  equipos: [
    { descripcion: 'BOMBA D/ACHIQUE D/3-5HP, DIAMET SUCCION=2"xDESCARGA=2"', cantidad: 1, cop: 1, costoBs: 37209.6 },
    { descripcion: 'MANGUERA D/CAUCHO DIAM=2", L=15,24 m, P/CAMION CISTERNA', cantidad: 2, cop: 0.01, costoBs: 460468.8 },
  ],
  manoObra: [
    { cargo: 'OBRERO DE 1ra.', cantidad: 2, jornalBs: 2079.06 },
    { cargo: 'AYUDANTE DE MECANICO DIESEL', cantidad: 0.25, jornalBs: 2256.84 },
    { cargo: 'INSTALADOR ELECTRICOMECANICO DE 2da.', cantidad: 0.25, jornalBs: 2346.7 },
  ],
  unitarioMaterialesBs: 0.0,
  unitarioEquiposBs: 1160.4744,
  puConIvaEsperado: 2744.1485, puSinIvaEsperado: 2365.6453,
}

