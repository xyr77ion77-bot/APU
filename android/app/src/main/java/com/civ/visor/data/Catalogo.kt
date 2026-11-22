package com.civ.visor.data

import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import com.civ.visor.domain.LineaEquipo
import com.civ.visor.domain.LineaManoObra
import com.civ.visor.domain.LineaMaterial
import com.civ.visor.domain.LineasPartida
import com.civ.visor.domain.Parametros
import java.io.File

data class GuiaInfo(val id: Int, val nombre: String, val nPartidas: Int)

data class PartidaItem(
    val id: Int,
    val covenin: String,
    val unidad: String,
    val descripcion: String,
    val precioBs: Double,
    val guiaId: Int,
)

data class PartidaDetalle(
    val item: PartidaItem,
    val lineas: LineasPartida,
    /** Parámetros con los que se guardó el análisis en la base. */
    val parametrosGuardados: Parametros,
    /** Precio unitario tal como quedó guardado en la base (referencia). */
    val precioGuardadoBs: Double,
)

/**
 * Acceso de solo lectura al catálogo empaquetado (assets/catalogo.db).
 *
 * La base se copia a filesDir al instalar/actualizar la app y se abre con la API
 * de SQLite de Android. Se usa SQL directo en vez de Room porque el esquema
 * viene de Prisma y no de entidades Room: así no hay que reproducir un hash de
 * esquema para que Room acepte el archivo.
 */
class Catalogo private constructor(private val db: SQLiteDatabase) : AutoCloseable {

    fun guias(): List<GuiaInfo> {
        val sql = """
            SELECT g.id, g.nombre, COUNT(p.id)
            FROM Guia g
            LEFT JOIN PartidaAnalisis p ON p.guiaId = g.id
            GROUP BY g.id, g.nombre
            ORDER BY g.id
        """.trimIndent()
        return db.rawQuery(sql, null).use { c ->
            buildList {
                while (c.moveToNext()) add(GuiaInfo(c.getInt(0), c.getString(1), c.getInt(2)))
            }
        }
    }

    /** Busca por descripción o código COVENIN. Máximo [limite] resultados. */
    fun buscar(texto: String, guiaId: Int?, limite: Int = 200): List<PartidaItem> {
        val condiciones = mutableListOf<String>()
        val args = mutableListOf<String>()

        val termino = texto.trim()
        if (termino.isNotEmpty()) {
            condiciones += "(descripcion LIKE ? OR covenin LIKE ?)"
            args += "%$termino%"
            args += "%$termino%"
        }
        if (guiaId != null) {
            condiciones += "guiaId = ?"
            args += guiaId.toString()
        }

        val sql = buildString {
            append("SELECT id, covenin, unidad, descripcion, precioUnitarioBs, guiaId FROM PartidaAnalisis")
            if (condiciones.isNotEmpty()) append(" WHERE ").append(condiciones.joinToString(" AND "))
            append(" ORDER BY covenin LIMIT ").append(limite)
        }

        return db.rawQuery(sql, args.toTypedArray()).use { c ->
            buildList {
                while (c.moveToNext()) add(c.toPartidaItem())
            }
        }
    }

    fun detalle(id: Int): PartidaDetalle? {
        val cabecera = db.rawQuery(
            """
            SELECT id, covenin, unidad, descripcion, precioUnitarioBs, guiaId,
                   rendimiento, unitarioMaterialesBs, unitarioEquiposBs,
                   fcasPct, bonoAlimenticioDiario, administracionPct, utilidadPct, ivaPct
            FROM PartidaAnalisis WHERE id = ?
            """.trimIndent(),
            arrayOf(id.toString()),
        ).use { c ->
            if (!c.moveToFirst()) return null
            Cabecera(
                item = c.toPartidaItem(),
                rendimiento = c.getDouble(6),
                unitarioMateriales = if (c.isNull(7)) null else c.getDouble(7),
                unitarioEquipos = if (c.isNull(8)) null else c.getDouble(8),
                parametros = Parametros(
                    fcasPct = c.getDouble(9),
                    bonoAlimenticioDiario = c.getDouble(10),
                    administracionPct = c.getDouble(11),
                    utilidadPct = c.getDouble(12),
                    ivaPct = c.getDouble(13),
                ),
            )
        }

        val idArg = arrayOf(id.toString())

        val materiales = db.rawQuery(
            "SELECT descripcion, unidad, cantidad, costoBs FROM AnalisisMaterial WHERE partidaAnalisisId = ? ORDER BY posicion",
            idArg,
        ).use { c ->
            buildList {
                while (c.moveToNext()) add(
                    LineaMaterial(
                        descripcion = c.getString(0) ?: "",
                        unidad = c.getString(1),
                        cantidad = c.getDouble(2),
                        costoBs = c.getDouble(3),
                    )
                )
            }
        }

        val equipos = db.rawQuery(
            "SELECT descripcion, cantidad, cop, costoBs FROM AnalisisEquipo WHERE partidaAnalisisId = ? ORDER BY posicion",
            idArg,
        ).use { c ->
            buildList {
                while (c.moveToNext()) add(
                    LineaEquipo(
                        descripcion = c.getString(0) ?: "",
                        cantidad = c.getDouble(1),
                        cop = if (c.isNull(2)) null else c.getDouble(2),
                        costoBs = c.getDouble(3),
                    )
                )
            }
        }

        val manoObra = db.rawQuery(
            "SELECT cargo, cantidad, jornalBs FROM AnalisisManoObra WHERE partidaAnalisisId = ? ORDER BY posicion",
            idArg,
        ).use { c ->
            buildList {
                while (c.moveToNext()) add(
                    LineaManoObra(
                        cargo = c.getString(0) ?: "",
                        cantidad = c.getDouble(1),
                        jornalBs = c.getDouble(2),
                    )
                )
            }
        }

        return PartidaDetalle(
            item = cabecera.item,
            lineas = LineasPartida(
                rendimiento = cabecera.rendimiento,
                materiales = materiales,
                equipos = equipos,
                manoObra = manoObra,
                unitarioMaterialesBs = cabecera.unitarioMateriales,
                unitarioEquiposBs = cabecera.unitarioEquipos,
            ),
            parametrosGuardados = cabecera.parametros,
            precioGuardadoBs = cabecera.item.precioBs,
        )
    }

    override fun close() {
        db.close()
    }

    private class Cabecera(
        val item: PartidaItem,
        val rendimiento: Double,
        val unitarioMateriales: Double?,
        val unitarioEquipos: Double?,
        val parametros: Parametros,
    )

    private fun Cursor.toPartidaItem() = PartidaItem(
        id = getInt(0),
        covenin = getString(1) ?: "",
        unidad = getString(2) ?: "",
        descripcion = getString(3) ?: "",
        precioBs = getDouble(4),
        guiaId = getInt(5),
    )

    companion object {
        private const val ASSET = "catalogo.db"
        private const val PREFS = "catalogo"
        private const val KEY_STAMP = "stamp"

        /**
         * Abre el catálogo. Copia el asset a filesDir la primera vez y cada vez
         * que la app se reinstala o actualiza (cambia lastUpdateTime).
         * Llamar fuera del hilo principal.
         */
        fun abrir(context: Context): Catalogo {
            val destino = File(context.filesDir, ASSET)
            val stamp = context.packageManager
                .getPackageInfo(context.packageName, 0)
                .lastUpdateTime
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

            if (!destino.exists() || prefs.getLong(KEY_STAMP, -1L) != stamp) {
                context.assets.open(ASSET).use { entrada ->
                    destino.outputStream().use { salida -> entrada.copyTo(salida) }
                }
                prefs.edit().putLong(KEY_STAMP, stamp).apply()
            }

            val db = SQLiteDatabase.openDatabase(
                destino.path,
                null,
                SQLiteDatabase.OPEN_READONLY,
            )
            return Catalogo(db)
        }
    }
}
