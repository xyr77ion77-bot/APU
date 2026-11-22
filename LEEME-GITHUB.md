# Visor CIV INGEFALCA — código fuente

Planos del Visor CIV: **Next.js 16 + Prisma + SQLite** (catálogo de partidas,
APU y presupuestos). Este repo NO incluye la base de datos ni las dependencias:
se regeneran por seguridad y tamaño.

## Levantar el proyecto después de clonar

Requisito: Node.js 20+ (nodejs.org, LTS).

```bash
npm install            # descarga node_modules (220 MB) — se regenera solo
npx prisma generate    # genera el cliente de la base de datos
```

La base de datos **no viaja en el repo**. Dos opciones:

1. **Con tus datos reales**: copia `db/custom.db` desde tu paquete portable
   (`visor-civ-pc/db/custom.db`) a la carpeta `db/` de este proyecto.
2. **Base vacía**: `npx prisma db push` crea las tablas (sin partidas).

```bash
# Windows (cmd):
set DATABASE_URL=file:%cd%/db/custom.db
npm run dev            # http://localhost:3000
```

```bash
# Linux/Mac:
DATABASE_URL="file:$PWD/db/custom.db" npm run dev
```

## Generar el paquete portable para PC

```bash
npm run build
bash scripts/empaquetar_pc.sh   # crea download/visor-civ-pc/ + zip versionado
```

## Para Google AI Studio (camino Kotlin)

El archivo clave para traducir la capa de datos es **`prisma/schema.prisma`**:
describe todas las tablas y relaciones. Pégale ese contenido a AI Studio pidiendo
la base Room de Kotlin. La app web en sí (src/) sirve como **referencia visual
de cada pantalla** que le pidas.

## Respaldar tus datos (solo repo PRIVADO)

`db/custom.db` (30 MB) se puede subir a mano si el repo es privado. **Nunca**
subas `db/backups/` ni los `*.bak` (881+ MB de backups automáticos).

## Estructura

```
prisma/schema.prisma   ← las tablas (el "ADN" de los datos)
src/                   ← la app (páginas, componentes, API)
public/                ← iconos PWA y service worker
scripts/               ← empaquetar portable, backup DB, iconos, arranque prod
DEPLOY.md              ← guía completa de despliegue (PC, móvil, PWA)
```
