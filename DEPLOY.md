# Despliegue del Visor CIV — PC x64 y Android

La app es **Next.js 16 (standalone) + Prisma + SQLite** — un solo proceso Node y un
archivo de base de datos (`db/custom.db`, ~30 MB con las 7.594 partidas). Eso la
hace ideal para montarse como **servidor local ligero** en el PC de la oficina, con
el móvil entrando como app instalada (PWA) al mismo servidor.

> ⚠️ **Sobre "x86"**: Node.js moderno (20+) no existe para Windows de **32 bits**.
> Cualquier PC de los últimos ~15 años es **x64**. Si el equipo de verdad es x86-32,
> no hay runtime actual que soporte Next 16 — se necesitaría otro PC o una mini-PC.

> ⚠️ **Motores y cliente de Prisma**: el cliente se genera con
> `binaryTargets = ["native", "windows"]` (prisma/schema.prisma) para que el paquete
> lleve el engine binario de Linux **y** de Windows (`query_engine-windows.dll.node`).
> Además, el cliente generado con hash (`@prisma/client-<hash>`) llega al standalone
> como **symlink** dentro de `.next/node_modules/` — el empaquetador lo convierte en
> copia real (`cp -rL`) porque un zip de symlinks de Unix llega roto a Windows
> (síntoma: `Cannot find module '@prisma/client-<hash>'` al abrir el catálogo).
> Si el catálogo carga en "0–0 de 0 partidas" o el API falla, correr **DIAGNOSTICO.bat**
> (incluido en el paquete): muestra el error real del API y la ventana del servidor.

## Estado actual (lo que ya está listo)

| Pieza | Estado |
| --- | --- |
| Build de producción standalone (`next.config.ts → output: "standalone"`) | ✅ |
| Script de build que copia static/public al standalone (`npm run build`) | ✅ |
| Base de datos portable (un solo archivo SQLite) + backups automáticos prebuild/predev (`scripts/backup_db.py`) | ✅ |
| Iconos PWA 192/512 + maskable + apple-touch (`scripts/gen_iconos_pwa.py`) | ✅ |
| Webmanifest (`src/app/manifest.ts` → `/manifest.webmanifest`) | ✅ |
| Service worker conservador (cache-first solo estáticos; API y páginas siempre en red) | ✅ |
| Arranque producción desde el repo (`scripts/arranque_prod.sh`) | ✅ |
| Empaquetador portable para PC (`scripts/empaquetar_pc.sh` → `download/visor-civ-pc.zip`) | ✅ |
| HTTPS para instalar la PWA desde Android en LAN | ⬜ depende del entorno (ver abajo) |
| Servicio/autostart en el PC (NSSM/systemd) | ⬜ opcional, ver abajo |
| App de escritorio nativa (Tauri) | ⬜ opcional, ver abajo |

## Opción A — Paquete portable (recomendada para el PC de la oficina)

En la máquina de desarrollo (o cualquier Linux con Node 20+):

```bash
bash scripts/empaquetar_pc.sh
# genera download/visor-civ-pc/ y download/visor-civ-pc-v3-<fecha>.zip (~113 MB)
```

En el **PC destino (Windows x64 o Linux x64)**:

1. Instalar **Node.js 20+** (LTS desde nodejs.org) — único requisito.
2. Descargar el zip **versionado** (`visor-civ-pc-v3-...zip`, ~113 MB). El nombre
   versionado evita confundirlo con descargas anteriores; el paquete correcto
   contiene `.next\node_modules\@prisma\client-2c3a283f134fdcb6\` **con archivos
   dentro** (además de la copia de respaldo en `node_modules\@prisma\`).
3. **Borrar la carpeta de cualquier intento anterior** y descomprimir el zip en
   una carpeta nueva (p. ej. `C:\CIV\`) — no mezclar versiones.
4. Doble clic a **`INICIAR.bat`** (Windows) o `./INICIAR.sh` (Linux).
5. Abrir `http://localhost:3000`. Si algo falla, **`DIAGNOSTICO.bat`** revisa la
   integridad del paquete pieza por pieza ([OK]/[FALTA]) y prueba el API real.

El paquete lleva todo: servidor, dependencias (con el cliente Prisma por DOS vías
de resolución, inmune a extracciones imperfectas del zip), iconos y la base de
datos con el catálogo. No instala nada en el sistema; para desinstalar, borrar
la carpeta.

**Desde el móvil (misma red Wi-Fi/oficina):** entrar a `http://IP-DEL-PC:3000`
(la IP se ve con `ipconfig` / `ip a`; habilitar el puerto 3000 en el firewall la
primera vez). Chrome Android → menú ⋮ → **"Añadir a pantalla de inicio"** → queda
un icono que abre la app a pantalla completa.

## Opción B — Arrancar desde el código fuente

```bash
npm ci && npx prisma generate && npm run build
bash scripts/arranque_prod.sh          # HOSTNAME=0.0.0.0 PORT=3000
# o el npm start existente (usa Bun): NODE_ENV=production bun .next/standalone/server.js
```

## Android fuera de la LAN, y la PWA "instalable"

Chrome solo ofrece **"Añadir a pantalla de inicio"** como app instalada en un
contexto seguro (HTTPS o localhost). Dos caminos sencillos:

1. **Tailscale (recomendado)** — gratis hasta 100 equipos: instalar en el PC y en
   el Android, iniciar sesión con la misma cuenta → el PC queda como
   `http://nombreequipo:3000` con **HTTPS automático vía `https://nombreequipo.tailnet...`**
   (activar HTTPS en la consola de Tailscale). Funciona en oficina y fuera de ella.
2. **Reverse proxy con HTTPS propio** — Caddy en el PC con un certificado interno o
   un dominio real (`caddy reverse-proxy --from civ.tudominio.com --to localhost:3000`).

Sin HTTPS la app funciona igual (entrar por `http://IP:3000` y usarla); solo no
queda "instalada" con icono en Android.

## Autostart / servicio (opcional)

- **Windows**: [NSSM](https://nssm.cc) — `nssm install CIV "C:\CIV\INICIAR.bat"`;
  o una tarea del Programador de tareas que ejecute INICIAR.bat al iniciar sesión.
- **Linux**: unidad systemd (`ExecStart=/opt/civ/INICIAR.sh`, `Restart=always`).

## App de escritorio nativa (opción avanzada, "app ligera" real)

Si se quiere un ejecutable con ventana propia (sin consola, sin navegador):

- **Tauri 2** es la opción ligera (~8-15 MB): la ventana usa el WebView del sistema
  y lanza el `server.js` standalone como **sidecar** (proceso hijo). Lo que falta:
  instalar Rust + WebView2 en la máquina de build, crear `src-tauri/` con
  `tauri.conf.json` (external URL → `http://localhost:3000`, sidecar node o el
  bundle con `pkg`/`node-sea`), iconos (ya generados) y firma del instalador.
- **Electron** también sirve pero pesa ~150-200 MB — no es "ligera".

No es necesario para el caso de uso: la PWA instalada desde Chrome/Edge da el
mismo resultado (icono + ventana propia) sin toolchain de Rust.

## Android 100% offline (no recomendado como primer paso)

Convertir la app en APK offline requiere portar el backend al dispositivo
(SQLite WASM/OPFS + reescribir las ~15 rutas API como funciones cliente) o
embeber Node en Android (NodeJS-mobile + Capacitor — complejo y pesado). El
modelo **PC como servidor + Android como PWA** cubre oficina y obra con una
fracción del esfuerzo; si el celular debe trabajar sin señal, basta con que el
PC/mini-PC de la obra siga encendido en la misma red.

## Respaldos

- `npm run backup` → copia con marca de fecha (ya corre automáticamente en cada build/dev).
- El respaldo mínimo es copiar `db/custom.db` con la app apagada.
- Multiusuario: SQLite funciona bien para el tamaño y concurrencia de una oficina
  (varios usuarios consultando y guardando presupuestos). Para muchas escrituras
  simultáneas, considerar mover `DATABASE_URL` a PostgreSQL más adelante (Prisma
  permite cambiar el provider sin tocar las rutas).
