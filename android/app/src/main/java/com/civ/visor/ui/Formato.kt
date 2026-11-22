package com.civ.visor.ui

import java.util.Locale

/** Formato venezolano: 1.234,56 */
object Formato {
    private val locale: Locale = Locale.Builder().setLanguage("es").setRegion("VE").build()

    fun bs(valor: Double, decimales: Int = 2): String =
        String.format(locale, "%,.${decimales}f", valor)
}
