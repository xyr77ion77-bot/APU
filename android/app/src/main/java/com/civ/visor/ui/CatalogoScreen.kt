package com.civ.visor.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.civ.visor.data.Catalogo
import com.civ.visor.data.GuiaInfo
import com.civ.visor.data.PartidaItem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Composable
fun CatalogoScreen(catalogo: Catalogo, onAbrir: (Int) -> Unit) {
    var texto by rememberSaveable { mutableStateOf("") }
    var guiaId by rememberSaveable { mutableStateOf<Int?>(null) }

    val guias by produceState(initialValue = emptyList<GuiaInfo>()) {
        value = withContext(Dispatchers.IO) { catalogo.guias() }
    }
    val resultados by produceState(initialValue = emptyList<PartidaItem>(), texto, guiaId) {
        value = withContext(Dispatchers.IO) { catalogo.buscar(texto, guiaId) }
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        Text("Catálogo APU", style = MaterialTheme.typography.headlineSmall)

        OutlinedTextField(
            value = texto,
            onValueChange = { texto = it },
            label = { Text("Buscar por descripción o código COVENIN") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )

        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier.padding(vertical = 8.dp),
        ) {
            item {
                FilterChip(
                    selected = guiaId == null,
                    onClick = { guiaId = null },
                    label = { Text("Todas") },
                )
            }
            items(guias, key = { it.id }) { g ->
                FilterChip(
                    selected = guiaId == g.id,
                    onClick = { guiaId = g.id },
                    label = { Text(g.nombre) },
                )
            }
        }

        Text(
            "${resultados.size} resultados (máximo 200)",
            style = MaterialTheme.typography.bodySmall,
        )

        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 6.dp),
        ) {
            items(resultados, key = { it.id }) { p ->
                PartidaCard(partida = p, onClick = { onAbrir(p.id) })
            }
        }
    }
}

@Composable
private fun PartidaCard(partida: PartidaItem, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(partida.covenin, style = MaterialTheme.typography.labelLarge)
            Text(
                partida.descripcion,
                style = MaterialTheme.typography.bodyMedium,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    "Und: ${partida.unidad}",
                    style = MaterialTheme.typography.bodySmall,
                )
                Text(
                    "Bs. ${Formato.bs(partida.precioBs)}",
                    style = MaterialTheme.typography.labelLarge,
                )
            }
        }
    }
}
