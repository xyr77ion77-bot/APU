package com.civ.visor.domain

/**
 * Motor de precios unitarios (APU) — port fiel de src/lib/calculo-core.ts.
 *
 * Fórmulas del APU del CIV (Edición Feb-2011):
 *  1. SubTotalMO      = Σ(cantidad × jornal)
 *  2. FactorCostos    = SubTotalMO × FCAS%
 *  3. TotalMO+Factor  = SubTotalMO + FactorCostos
 *  4. Bono alimenticio = bonoDiario × Σ(días de MO)
 *  5. Unitario MO     = (TotalMO+Factor + Bono) / Rendimiento
 *  6. Costo directo   = Unitario materiales + equipos + MO
 *  7. + Administración% → + Utilidad% → + IVA% = Precio unitario
 */

data class Parametros(
    val fcasPct: Double = 180.0,
    val bonoAlimenticioDiario: Double = 5407.53,
    val administracionPct: Double = 10.0,
    val utilidadPct: Double = 15.0,
    val ivaPct: Double = 16.0,
)

data class LineaMaterial(
    val descripcion: String,
    val unidad: String?,
    val cantidad: Double,
    val costoBs: Double,
)

data class LineaEquipo(
    val descripcion: String,
    val cantidad: Double,
    val cop: Double?,
    val costoBs: Double,
)

data class LineaManoObra(
    val cargo: String,
    val cantidad: Double,
    val jornalBs: Double,
)

data class LineasPartida(
    val rendimiento: Double,
    val materiales: List<LineaMaterial>,
    val equipos: List<LineaEquipo>,
    val manoObra: List<LineaManoObra>,
    /** Unitarios tomados del PDF original del CIV; si son 0 o null se recalculan. */
    val unitarioMaterialesBs: Double? = null,
    val unitarioEquiposBs: Double? = null,
)

data class ResultadoCalculo(
    val totalMaterialesBs: Double,
    val totalEquiposBs: Double,
    val subTotalManoObraBs: Double,
    val totalDiasManoObra: Double,
    val factorCostosBs: Double,
    val totalManoObraFactorBs: Double,
    val bonoAlimenticioBs: Double,
    val totalBonoMasBs: Double,
    val rendimiento: Double,
    val unitarioMaterialesBs: Double,
    val unitarioEquiposBs: Double,
    val unitarioManoObraBs: Double,
    val costoDirectoUnitarioBs: Double,
    val administracionBs: Double,
    val utilidadBs: Double,
    val precioUnitarioSinIvaBs: Double,
    val ivaBs: Double,
    val precioUnitarioBs: Double,
)

fun calcularDesdeLineas(
    lineas: LineasPartida,
    p: Parametros = Parametros(),
): ResultadoCalculo {
    // Materiales y equipos
    val totalMateriales = lineas.materiales.sumOf { it.cantidad * it.costoBs }
    // Equipos: cantidad × COP × costo (COP por defecto 1)
    val totalEquipos = lineas.equipos.sumOf { it.cantidad * (it.cop ?: 1.0) * it.costoBs }

    // Mano de obra
    val subTotalMO = lineas.manoObra.sumOf { it.cantidad * it.jornalBs }
    val diasMO = lineas.manoObra.sumOf { it.cantidad }

    // F.C.A.S., total MO + factor, bono alimenticio
    val factorCostos = subTotalMO * (p.fcasPct / 100.0)
    val totalMOFactor = subTotalMO + factorCostos
    val bono = p.bonoAlimenticioDiario * diasMO
    val totalBonoMas = totalMOFactor + bono

    // Rendimiento: 0 o NaN → 1 (igual que `rendimiento || 1` en la web)
    val rend = if (lineas.rendimiento.isNaN() || lineas.rendimiento == 0.0) 1.0 else lineas.rendimiento

    // Unitarios de materiales y equipos: los del PDF si existen, si no Σ / rendimiento
    val uMat = lineas.unitarioMaterialesBs?.takeIf { it != 0.0 } ?: (totalMateriales / rend)
    val uEq = lineas.unitarioEquiposBs?.takeIf { it != 0.0 } ?: (totalEquipos / rend)
    val uMO = totalBonoMas / rend

    val costoDirecto = uMat + uEq + uMO

    val administracion = costoDirecto * (p.administracionPct / 100.0)
    val subTotalAdmin = costoDirecto + administracion
    val utilidad = subTotalAdmin * (p.utilidadPct / 100.0)
    val precioSinIva = subTotalAdmin + utilidad
    val iva = precioSinIva * (p.ivaPct / 100.0)

    return ResultadoCalculo(
        totalMaterialesBs = totalMateriales,
        totalEquiposBs = totalEquipos,
        subTotalManoObraBs = subTotalMO,
        totalDiasManoObra = diasMO,
        factorCostosBs = factorCostos,
        totalManoObraFactorBs = totalMOFactor,
        bonoAlimenticioBs = bono,
        totalBonoMasBs = totalBonoMas,
        rendimiento = rend,
        unitarioMaterialesBs = uMat,
        unitarioEquiposBs = uEq,
        unitarioManoObraBs = uMO,
        costoDirectoUnitarioBs = costoDirecto,
        administracionBs = administracion,
        utilidadBs = utilidad,
        precioUnitarioSinIvaBs = precioSinIva,
        ivaBs = iva,
        precioUnitarioBs = precioSinIva + iva,
    )
}
