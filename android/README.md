# Visor CIV — app Android (Kotlin + Jetpack Compose)

App nativa de consulta y cálculo de Análisis de Precios Unitarios (APU) del CIV.
Lee un catálogo empaquetado en la APK; no necesita servidor ni internet.

**Alcance de esta versión:** catálogo (búsqueda por descripción o COVENIN y
filtro por guía), detalle del APU con materiales, equipos y mano de obra, y
recálculo del precio con parámetros editables (F.C.A.S., bono, administración,
utilidad, IVA). **Pendiente:** presupuestos y cómputos (crear y editar).

## 1. Generar el catálogo (una vez, y cada vez que cambie la base)

Desde la raíz del repo, con tu `db/custom.db` (o el archivo que descargaste):

```bash
python3 scripts/generar_catalogo_android.py db/custom.db
```

Esto crea `android/app/src/main/assets/catalogo.db` (~14,5 MB) con todo el
catálogo y **sin presupuestos ni cómputos**. Ese archivo **no se versiona**
(`.gitignore` lo excluye).

## 2. Abrir y compilar en Android Studio

1. Requisitos: **Android Studio** reciente (Ladybug o superior) y **JDK 17**
   (Android Studio lo incluye).
2. Abre la carpeta `android/` (no la raíz del repo).
3. Espera a que termine el *Gradle Sync*. Si pide crear el Gradle wrapper,
   acepta.
4. Para una APK de depuración: **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.
   El archivo queda en `android/app/build/outputs/apk/debug/app-debug.apk`.
5. Para instalar en el teléfono: activa "Depuración USB" o usa **Run ▶** con el
   teléfono conectado.

## 3. Pruebas

```bash
cd android && ./gradlew testDebugUnitTest
```

`CalculoTest` compara el motor de cálculo con cinco partidas reales de la base
(tolerancia de 0,02 Bs). El mismo cálculo está verificado en Python contra las
7.594 partidas (error máximo 0,0002 Bs).

## Estructura

```
android/app/src/main/java/com/civ/visor/
  MainActivity.kt      navegación (catálogo ↔ detalle)
  data/Catalogo.kt     lectura de catalogo.db (SQLite de Android, solo lectura)
  domain/Calculo.kt    motor APU (port de src/lib/calculo-core.ts)
  ui/CatalogoScreen.kt búsqueda y lista
  ui/DetalleScreen.kt  detalle, parámetros y precio
```

## Notas de diseño

- **SQL directo en lugar de Room:** el esquema viene de Prisma. Room exige que el
  esquema coincida con sus entidades y un hash de identidad; con SQL directo el
  archivo se usa tal cual, sin reconstruirlo.
- **La base se copia a `filesDir`** al instalar o actualizar la app.
- **Fórmulas idénticas a la web:** `calculo-core.ts` es la referencia. Si cambia
  una fórmula allá, hay que cambiarla en `Calculo.kt`.
