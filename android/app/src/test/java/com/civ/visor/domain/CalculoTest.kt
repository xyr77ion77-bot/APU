package com.civ.visor.domain

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Casos dorados tomados de la base del visor (catalogo.db). Cada precio de
 * referencia es el PU guardado en la base con sus parámetros (FCAS 180 %,
 * bono 5.407,53, administración 10 %, utilidad 15 %, IVA 16 %).
 *
 * Los unitarios de materiales y equipos vienen del PDF del CIV, por eso se
 * pasan tal cual; la mano de obra se resume en días y jornal promedio.
 */
class CalculoTest {

    private fun lineas(
        rendimiento: Double,
        unitarioMat: Double,
        unitarioEq: Double,
        dias: Double,
        subTotalMO: Double,
    ) = LineasPartida(
        rendimiento = rendimiento,
        materiales = emptyList(),
        equipos = emptyList(),
        manoObra = listOf(LineaManoObra("cuadrilla", dias, subTotalMO / dias)),
        unitarioMaterialesBs = unitarioMat,
        unitarioEquiposBs = unitarioEq,
    )

    @Test
    fun partida1_E316000000() {
        val r = calcularDesdeLineas(lineas(40.0, 0.0, 1160.4744, 2.5, 5309.005))
        assertEquals(2744.1485, r.precioUnitarioBs, 0.02)
    }

    @Test
    fun partida500_E361221000() {
        val r = calcularDesdeLineas(lineas(740.0, 0.3136, 24.7876, 3.2, 7772.512))
        assertEquals(114.3026, r.precioUnitarioBs, 0.02)
    }

    @Test
    fun partida2000_R910122370() {
        val r = calcularDesdeLineas(lineas(382.07, 1.0103, 1.5095, 12.25, 25535.395))
        assertEquals(532.7149, r.precioUnitarioBs, 0.02)
    }

    @Test
    fun partida4000_U802118211() {
        val r = calcularDesdeLineas(lineas(15.0, 4346.5796, 519.0227, 5.0, 10662.94))
        assertEquals(12705.5237, r.precioUnitarioBs, 0.02)
    }

    @Test
    fun partida7000_A413110000() {
        val r = calcularDesdeLineas(lineas(50.0, 0.0, 71.0541, 10.25, 21377.275))
        assertEquals(3487.6064, r.precioUnitarioBs, 0.02)
    }

    @Test
    fun equipos_usan_cantidad_por_cop_por_costo() {
        val l = LineasPartida(
            rendimiento = 1.0,
            materiales = emptyList(),
            equipos = listOf(LineaEquipo("retroexcavadora", cantidad = 2.0, cop = 0.01, costoBs = 100.0)),
            manoObra = emptyList(),
        )
        val r = calcularDesdeLineas(l)
        assertEquals(2.0, r.totalEquiposBs, 1e-9)
    }

    @Test
    fun rendimiento_cero_se_trata_como_uno() {
        val l = LineasPartida(
            rendimiento = 0.0,
            materiales = listOf(LineaMaterial("cemento", "saco", 3.0, 10.0)),
            equipos = emptyList(),
            manoObra = emptyList(),
        )
        val r = calcularDesdeLineas(l)
        assertEquals(1.0, r.rendimiento, 1e-9)
        assertEquals(30.0, r.unitarioMaterialesBs, 1e-9)
    }
}
