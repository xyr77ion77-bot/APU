#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Backup automático de la base de datos del visor (db/custom.db).

- Usa el API de backup de sqlite3 (seguro aunque haya escrituras en curso).
- Guarda en db/backups/custom_YYYYMMDD_HHMMSS.db con metadatos (tamaño, nº de partidas).
- Rotación: conserva los últimos --keep backups (default 14).

Invocado por: npm run backup · hooks predev/prebuild de package.json · manual.
"""
import argparse
import os
import sqlite3
import sys
from datetime import datetime

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(BASE, 'db', 'custom.db')
DIR = os.path.join(BASE, 'db', 'backups')

ap = argparse.ArgumentParser(description='Backup rotativo de custom.db')
ap.add_argument('--keep', type=int, default=14, help='backups a conservar (default 14)')
ap.add_argument('--sufijo', default='', help='sufijo opcional en el nombre (p.ej. antes_sc)')
args = ap.parse_args()

if not os.path.exists(DB):
    print(f'ERROR: no existe {DB}')
    sys.exit(1)

os.makedirs(DIR, exist_ok=True)
stamp = datetime.now().strftime('%Y%m%d_%H%M%S')
nombre = f"custom_{args.sufijo + '_' if args.sufijo else ''}{stamp}.db"
destino = os.path.join(DIR, nombre)

src = sqlite3.connect(DB)
dst = sqlite3.connect(destino)
with dst:
    src.backup(dst)
dst.close()

# Metadatos rápidos en el nombre del log (no en la BD destino)
cur = src.cursor()
n_partidas = cur.execute('SELECT COUNT(*) FROM PartidaAnalisis').fetchone()[0]
n_presu = cur.execute('SELECT COUNT(*) FROM Presupuesto').fetchone()[0]
src.close()

tamano = os.path.getsize(destino)
print(f'✓ Backup: {destino} ({tamano / 1e6:.1f} MB · {n_partidas} partidas · {n_presu} presupuestos)')

# Rotación
backups = sorted(f for f in os.listdir(DIR) if f.startswith('custom_') and f.endswith('.db'))
for viejo in backups[:-args.keep] if args.keep > 0 else []:
    os.remove(os.path.join(DIR, viejo))
    print(f'  rotado: {viejo}')
print(f'  conservados: {min(len(backups), args.keep)}')
