#!/usr/bin/env python3
"""
Genera el catálogo que se empaqueta dentro de la APK Android.

Toma la base completa del visor (db/custom.db o la ruta que se pase) y crea
android/app/src/main/assets/catalogo.db con:
  - TODO el catálogo: guías, análisis de precios unitarios (APU), líneas de
    materiales/equipos/mano de obra, insumos, perfiles de acero generales,
    manifiesto y estadísticas.
  - NINGÚN dato personal: presupuestos, cómputos, vanos y reglas de medición
    quedan vacíos (sus tablas conservan el esquema).

Uso:
  python3 scripts/generar_catalogo_android.py [ruta/custom.db]

El archivo resultante NO se versiona (.gitignore ignora *.db).
"""
import os
import shutil
import sqlite3
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ORIGEN_DEFAULT = os.path.join(ROOT, "db", "custom.db")
DESTINO = os.path.join(ROOT, "android", "app", "src", "main", "assets", "catalogo.db")

# Tablas que se vacían por completo: datos del usuario o de sus obras.
VACIAR = [
    "ComputoFila", "ComputoVersion", "ComputoVanoInstancia", "ComputoElemento",
    "ComputoBloque", "ReglaMedicion", "Computo", "PresupuestoItem",
    "Presupuesto", "VanoTipo", "AparatoSanitario",
]

# Tablas que la app no usa (la versión legacy de partidas, en texto crudo).
EXCLUIR = ["Partida", "Precio"]


def main() -> int:
    origen = sys.argv[1] if len(sys.argv) > 1 else ORIGEN_DEFAULT
    if not os.path.isfile(origen):
        print(f"No existe la base de origen: {origen}", file=sys.stderr)
        return 1

    os.makedirs(os.path.dirname(DESTINO), exist_ok=True)
    if os.path.exists(DESTINO):
        os.remove(DESTINO)
    shutil.copyfile(origen, DESTINO)

    con = sqlite3.connect(DESTINO)
    con.execute("PRAGMA foreign_keys = OFF")
    tablas = {r[0] for r in con.execute(
        "SELECT name FROM sqlite_master WHERE type='table'")}

    for t in VACIAR + EXCLUIR:
        if t in tablas:
            con.execute(f'DELETE FROM "{t}"')

    # Perfiles de acero: solo el catálogo general (presupuestoId NULL).
    if "PerfilAcero" in tablas:
        con.execute('DELETE FROM "PerfilAcero" WHERE "presupuestoId" IS NOT NULL')

    # Sin datos personales en los contadores de autoincremento.
    if "sqlite_sequence" in tablas:
        nombres = ", ".join(f"'{t}'" for t in VACIAR + EXCLUIR)
        con.execute(f"DELETE FROM sqlite_sequence WHERE name IN ({nombres})")

    con.commit()
    con.execute("VACUUM")
    con.close()

    # Verificación: el catálogo debe quedar íntegro y sin presupuestos.
    con = sqlite3.connect(DESTINO)
    integridad = con.execute("PRAGMA integrity_check").fetchone()[0]
    partidas = con.execute('SELECT COUNT(*) FROM "PartidaAnalisis"').fetchone()[0]
    presupuestos = con.execute('SELECT COUNT(*) FROM "Presupuesto"').fetchone()[0]
    con.close()

    tam = os.path.getsize(DESTINO) / (1024 * 1024)
    print(f"Catálogo generado: {DESTINO} ({tam:.1f} MB)")
    print(f"  integridad: {integridad}")
    print(f"  análisis de precios (PartidaAnalisis): {partidas}")
    print(f"  presupuestos incluidos: {presupuestos}")
    return 0 if integridad == "ok" and presupuestos == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
