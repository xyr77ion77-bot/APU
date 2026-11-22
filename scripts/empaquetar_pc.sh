#!/usr/bin/env bash
# Empaqueta el Visor CIV como carpeta portable para PC x64 (Windows/Linux) en
# download/visor-civ-pc/ + zip. El paquete es autocontenido: server standalone
# (Next + Prisma), base de datos con el catálogo y lanzadores INICIAR.
set -euo pipefail
cd "$(dirname "$0")/.."

DEST="download/visor-civ-pc"

echo "→ 1/4 build de producción"
npm run build > /tmp/empaquetar_build.log 2>&1 || { tail -20 /tmp/empaquetar_build.log; exit 1; }
[ -f .next/standalone/server.js ] || { echo "ERROR: el build no generó .next/standalone/server.js" >&2; exit 1; }

echo "→ 2/4 armando el paquete en $DEST"
rm -rf "$DEST"
mkdir -p "$DEST"
# Copia selectiva del standalone (Next arrastra también archivos sueltos de la raíz
# del repo que no hacen falta en el paquete: logs, download/, configs de dev)
# -L (dereference): el standalone contiene symlinks (p.ej. el cliente generado
# @prisma/client-<hash>) que un zip no preserva y Windows no usa → copias reales.
cp -L .next/standalone/server.js "$DEST/"
cp -rL .next/standalone/node_modules "$DEST/node_modules"
cp -rL .next/standalone/.next "$DEST/.next"
cp .next/standalone/package.json "$DEST/package.json" 2>/dev/null || true
cp -rL public "$DEST/public"                # iconos PWA, sw.js, logo
mkdir -p "$DEST/db"
cp db/custom.db "$DEST/db/custom.db"        # catálogo + presupuestos guardados

# Chequeo: el paquete debe quedar sin NINGÚN symlink (un zip de symlinks de Unix
# llega roto a Windows — causa del "Cannot find module @prisma/client-<hash>")
L=$(find "$DEST" -type l | wc -l)
if [ "$L" -gt 0 ]; then
  echo "ERROR: quedan $L symlinks en el paquete:" >&2
  find "$DEST" -type l >&2
  exit 1
fi

# Blindaje de resolución: el cliente generado con hash (@prisma/client-<hash>)
# vive anidado en .next/node_modules/ — cópielo TAMBIÉN al node_modules raíz para
# que el require lo encuentre por DOS vías (si una extracción de zip en Windows
# omite la ruta anidada, la raíz lo respalda).
for hd in .next/standalone/.next/node_modules/@prisma/client-*; do
  [ -e "$hd" ] || continue
  nombre=$(basename "$hd")
  cp -rL "$hd" "$DEST/node_modules/@prisma/$nombre"
  echo "   blindaje: $nombre también en node_modules/@prisma/ (doble vía)"
done

echo "→ 3/4 lanzadores"
cat > "$DEST/INICIAR.sh" << 'EOF'
#!/usr/bin/env bash
# Visor CIV — arranque en Linux x64 (requiere Node.js 20+ instalado)
cd "$(dirname "$0")"
export NODE_ENV=production
export DATABASE_URL="file:$PWD/db/custom.db"
export HOSTNAME=0.0.0.0
export PORT="${PORT:-3000}"
node server.js
EOF
chmod +x "$DEST/INICIAR.sh"

cat > "$DEST/INICIAR.bat" << 'EOF'
@echo off
rem Visor CIV — arranque en Windows x64 (requiere Node.js 20+ instalado)
cd /d "%~dp0"
set NODE_ENV=production
rem Barras normales en la ruta: el parser de URL de Prisma las maneja mejor que \
set "BASE_DIR=%~dp0"
set "BASE_DIR=%BASE_DIR:\=/%"
set "DATABASE_URL=file:%BASE_DIR%db/custom.db"
set HOSTNAME=0.0.0.0
if "%PORT%"=="" set PORT=3000
echo Visor CIV en http://localhost:%PORT% (desde el movil: http://IP-DEL-PC:%PORT%)
echo Cierra esta ventana para detener la app.
node server.js
if errorlevel 1 (
  echo.
  echo ERROR al arrancar. Revisa: node -v debe ser 20 o mayor.
  echo Si el catalogo carga en "0-0 de 0 partidas", corre DIAGNOSTICO.bat.
  pause
)
EOF

cat > "$DEST/DIAGNOSTICO.bat" << 'EOF'
@echo off
rem Diagnostico del Visor CIV: muestra el error real si el catalogo carga vacio
cd /d "%~dp0"
echo ============================================
echo   DIAGNOSTICO VISOR CIV — integridad y API
echo ============================================
echo.
echo === 1. Node.js ===
node -v
echo.
echo === 2. Integridad del paquete ===
if exist "node_modules\.prisma\client\query_engine-windows.dll.node" (
  echo [OK] Motor de base de datos para Windows presente
) else (
  echo [FALTA] node_modules\.prisma\client\query_engine-windows.dll.node
  echo         - el paquete esta incompleto o la extraccion fallo
)
dir /b "node_modules\@prisma" 2>nul | findstr /b "client-" >nul && (
  echo [OK] Cliente generado en node_modules\@prisma\client-*
) || (
  echo [FALTA] node_modules\@prisma\client-* — paquete incompleto
)
dir /b ".next\node_modules\@prisma" 2>nul | findstr /b "client-" >nul && (
  echo [OK] Cliente generado en .next\node_modules\@prisma\client-*
) || (
  echo [AVISO] .next\node_modules\@prisma\client-* ausente — se usara la copia raiz
)
if exist "db\custom.db" (echo [OK] Base de datos presente) else (echo [FALTA] db\custom.db)
echo.
echo === 3. Prueba del API en http://127.0.0.1:3111 ===
set NODE_ENV=production
set "BASE_DIR=%~dp0"
set "BASE_DIR=%BASE_DIR:\=/%"
set "DATABASE_URL=file:%BASE_DIR%db/custom.db"
set HOSTNAME=127.0.0.1
set PORT=3111
start "CIV server (NO cerrar, ahi salen los errores)" cmd /k node server.js
timeout /t 6 /nobreak > nul
curl -s -m 15 "http://127.0.0.1:3111/api/analisis?limit=1"
echo.
echo.
echo Si el JSON de arriba muestra partidas ("items":[{"id":...}) la base de datos funciona.
echo Si aparece {"error"...} o nada: mira la ventana "CIV server", copia el error
echo y reportalo junto con las lineas [OK]/[FALTA] de arriba.
echo Cierra las dos ventanas para terminar.
pause
EOF

cat > "$DEST/LEEME.txt" << 'EOF'
VISOR CIV INGEFALCA — paquete portable para PC x64 (v3)
=======================================================
Requisito: Node.js 20 o superior (https://nodejs.org, instalador LTS).

¿Tienes el paquete CORRECTO? El zip debe pesar ~100 MB y existir la carpeta
.next\node_modules\@prisma\client-2c3a283f134fdcb6\ CON archivos dentro
(package.json, default.js, runtime). Si no existe o está vacía, tienes un
paquete viejo: descarga de nuevo el zip versionado (visor-civ-pc-v3-...).

Arrancar:
  - Windows: doble clic en INICIAR.bat
  - Linux:   ./INICIAR.sh

La app abre en http://localhost:3000. En la misma red local, otros equipos
y el móvil entran con http://IP-DEL-PC:3000 (la IP se ve con `ipconfig`
en Windows o `ip a` en Linux; abre el puerto 3000 en el firewall la 1a vez).

Instalar como app (icono propio):
  - Android: abre http://IP-DEL-PC:3000 en Chrome → menú ⋮ → "Añadir a pantalla de inicio".
  - Windows/Mac/Linux: Chrome o Edge → icono ⌗ en la barra → "Instalar".

La base de datos es db/custom.db (cátálogo + presupuestos). Copia ese archivo
para respaldar todo. Para cambiar de puerto: set PORT=8080 (Windows) o
PORT=8080 ./INICIAR.sh (Linux).

Si el catálogo carga en "0-0 de 0 partidas" o el API da error:
  1) Cierra la app y corre DIAGNOSTICO.bat — verifica la integridad del
     paquete ([OK]/[FALTA] por pieza) y muestra el error real del API.
  2) Si el diagnóstico marca [FALTA], la extracción fue incompleta:
     re-extrae el zip completo en una carpeta NUEVA (no sobre la vieja).
EOF

echo "→ 4/4 zip (con verificación de contenido crítico)"
# Nombre versionado: evita que una descarga cacheada del zip viejo se confunda con el nuevo
rm -f download/visor-civ-pc.zip
FECHA=$(date +%Y-%m-%d)
ZIP_PATH="download/visor-civ-pc-v3-${FECHA}.zip"
python3 - "$ZIP_PATH" << PYEOF
import os, re, sys, zipfile

base = 'download/visor-civ-pc'
zip_path = sys.argv[1]

# el cliente generado con hash DEBE estar en el zip por las DOS vías
hash_dirs = set()
for raiz, dirs, files in os.walk(base):
    for d in dirs:
        if re.match(r'client-[0-9a-f]{8,}', d):
            hash_dirs.add(d)
if not hash_dirs:
    raise SystemExit('ERROR: no hay client-<hash> en el paquete de carpetas')

seen = set()
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for raiz, dirs, files in os.walk(base, followlinks=True):
        real = os.path.realpath(raiz)
        if real in seen:            # protección anti-ciclos de symlinks
            dirs[:] = []
            continue
        seen.add(real)
        for f in files:
            p = os.path.join(raiz, f)
            z.write(p, os.path.relpath(p, os.path.dirname(base)))

with zipfile.ZipFile(zip_path) as z:
    names = z.namelist()
    for hd in sorted(hash_dirs):
        # vía 1: node_modules raíz (blindaje)
        ok1 = any(n.endswith(f'node_modules/@prisma/{hd}/package.json') for n in names)
        # vía 2: anidado en .next/node_modules (donde el runtime lo busca primero)
        ok2 = any(n.endswith(f'.next/node_modules/@prisma/{hd}/package.json') for n in names)
        if not (ok1 and ok2):
            raise SystemExit(f'ERROR: el zip no contiene {hd} en ambas vías (raíz={ok1}, anidado={ok2})')
    print(f'zip OK: {len(names)} entradas · client-<hash> presente por las 2 vías: {", ".join(sorted(hash_dirs))}')
print(f'{zip_path}: {os.path.getsize(zip_path)/1048576:.1f} MB')
PYEOF

echo "LISTO: $DEST (+ .zip). En el PC destino: descomprimir, instalar Node 20+, INICIAR.bat"
