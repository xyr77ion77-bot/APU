package com.civ.visor

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import com.civ.visor.data.Catalogo
import com.civ.visor.ui.CatalogoScreen
import com.civ.visor.ui.DetalleScreen
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    VisorApp()
                }
            }
        }
    }
}

@Composable
private fun VisorApp() {
    val context = LocalContext.current
    val catalogo by produceState<Catalogo?>(initialValue = null) {
        value = withContext(Dispatchers.IO) { Catalogo.abrir(context.applicationContext) }
    }
    var seleccion by rememberSaveable { mutableStateOf<Int?>(null) }

    val cat = catalogo
    if (cat == null) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        return
    }

    val id = seleccion
    if (id == null) {
        CatalogoScreen(catalogo = cat, onAbrir = { seleccion = it })
    } else {
        key(id) {
            DetalleScreen(catalogo = cat, partidaId = id, onVolver = { seleccion = null })
        }
    }
}
