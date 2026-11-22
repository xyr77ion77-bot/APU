package com.civ.visor.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.civ.visor.data.Catalogo
import com.civ.visor.data.PartidaDetalle
import com.civ.visor.domain.LineaEquipo
import com.civ.visor.domain.LineaManoObra
import com.civ.visor.domain.LineaMaterial
import com.civ.visor.domain.Parametros
import com.civ.visor.domain.calcularDesdeLineas
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType

@Composable
fun DetalleScreen(catalogo: Catalogo, partidaId: Int, onVolver: () -> Unit) {
    BackHandler(onBack = onVolver)

    val detalle by produceState<PartidaDetalle?>(initialValue = null, partidaId) {
        value = withContext(Dispatchers.IO) { catalogo.detalle(partidaId) }
    }

    val d = detalle
    if (d == null) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        return
    }

    var params by remember(d) { mutableStateOf(d.parametrosGuardados) }
    val resultado = calcularDesdeLineas(d.lineas, params)

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item {
            TextButton(onClick = onVolver) { Text("← Volver al catálogo") }
        }

        item {
            Column {
                Text(d.item.covenin, style = MaterialTheme.typography.labelLarge)
                Text(d.item.descripcion, style = MaterialTheme.typography.bodyMedium)
                Text(
                    "Unidad: ${d.item.unidad} · Rendimiento: ${Formato.bs(resultado.rendimiento, 4)}",
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }

        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text("Parámetros", style = MaterialTheme.typography.titleMedium)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        CampoNumerico("F.C.A.S. %", params.fcasPct) {
                            params = params.copy(fcasPct = it)
                        }
                        CampoNumerico("Bono diario Bs.", params.bonoAlimenticioDiario) {
                            params = params.copy(bonoAlimenticioDiario = it)
                        }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        CampoNumerico("Administración %", params.administracionPct) {
                            params = params.copy(administracionPct = it)
                        }
                        CampoNumerico("Utilidad %", params.utilidadPct) {
                            params = params.copy(utilidadPct = it)
                        }
                        CampoNumerico("IVA %", params.ivaPct) {
                            params = params.copy(ivaPct = it)
                        }
                    }
                }
            }
        }

        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text("Precio unitario", style = MaterialTheme.typography.titleMedium)
                    FilaTexto("Materiales (unitario)", resultado.unitarioMaterialesBs)
                    FilaTexto("Equipos (unitario)", resultado.unitarioEquiposBs)
                    FilaTexto("Mano de obra (unitario)", resultado.unitarioManoObraBs)
                    FilaTexto("Costo directo", resultado.costoDirectoUnitarioBs, negrita = true)
                    FilaTexto("Administración", resultado.administracionBs)
                    FilaTexto("Utilidad", resultado.utilidadBs)
                    FilaTexto("Precio sin IVA", resultado.precioUnitarioSinIvaBs, negrita = true)
                    FilaTexto("IVA", resultado.ivaBs)
                    FilaTexto("PRECIO UNITARIO", resultado.precioUnitarioBs, negrita = true)
                    Text(
                        "Guardado en la base: Bs. ${Formato.bs(d.precioGuardadoBs)}",
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(top = 6.dp),
                    )
                }
            }
        }

        seccion("Materiales", d.lineas.materiales) { m: LineaMaterial ->
            "${m.descripcion} · ${Formato.bs(m.cantidad, 4)} ${m.unidad ?: ""} × Bs. ${Formato.bs(m.costoBs)}" to
                m.cantidad * m.costoBs
        }
        seccion("Equipos", d.lineas.equipos) { e: LineaEquipo ->
            "${e.descripcion} · ${Formato.bs(e.cantidad, 4)} × COP ${Formato.bs(e.cop ?: 1.0, 5)} × Bs. ${Formato.bs(e.costoBs)}" to
                e.cantidad * (e.cop ?: 1.0) * e.costoBs
        }
        seccion("Mano de obra", d.lineas.manoObra) { m: LineaManoObra ->
            "${m.cargo} · ${Formato.bs(m.cantidad, 2)} días × Bs. ${Formato.bs(m.jornalBs)}" to
                m.cantidad * m.jornalBs
        }
    }
}

/** Sección de líneas del APU: título y una fila por línea con su total. */
private fun <T> androidx.compose.foundation.lazy.LazyListScope.seccion(
    titulo: String,
    lineas: List<T>,
    texto: (T) -> Pair<String, Double>,
) {
    item {
        Text(
            "$titulo (${lineas.size})",
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
    items(lineas) { linea ->
        val (descripcion, total) = texto(linea)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                descripcion,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.weight(1f).padding(end = 8.dp),
            )
            Text(
                Formato.bs(total),
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

@Composable
private fun FilaTexto(etiqueta: String, valor: Double, negrita: Boolean = false) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            etiqueta,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = if (negrita) FontWeight.Bold else FontWeight.Normal,
        )
        Text(
            "Bs. ${Formato.bs(valor)}",
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = if (negrita) FontWeight.Bold else FontWeight.Normal,
        )
    }
}

/**
 * Campo numérico que acepta coma o punto decimal. Mantiene el texto que escribe
 * el usuario (p. ej. "1,") y solo informa valores válidos.
 */
@Composable
private fun RowScope.CampoNumerico(
    etiqueta: String,
    valorInicial: Double,
    onValor: (Double) -> Unit,
) {
    var texto by remember { mutableStateOf(valorInicial.toString()) }
    OutlinedTextField(
        value = texto,
        onValueChange = { nuevo ->
            texto = nuevo
            nuevo.replace(',', '.').toDoubleOrNull()?.let(onValor)
        },
        label = { Text(etiqueta) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        modifier = Modifier.weight(1f),
    )
}
