#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Seed fase 2 — catálogo general de perfiles de acero y pesos de varilla
(Tabla 5 del contrato de cómputos). presupuestoId NULL = compartido por todas
las obras. Pesos NOMINALES de referencia (ASTM A615 varillas, DIN 1025/1026
IPN/UPN, ASTM A36 ángulos, ASME B36.10 tubo): editables desde la app.
Idempotente: actualiza el peso si el código ya existe.
"""
import sqlite3
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(BASE, 'db', 'custom.db')

# [codigo, familia, tipo, descripcion, pesoKgM, areaM2M, longitudComercial]
CATALOGO = [
    # --- Varillas de refuerzo (COVENIN 2003 / ASTM A615, nominal) ---
    ('CB-8',   'varilla', 'varilla', 'VARILLA 1/4" (8mm) 60.000 PSI', 0.25,  None, 12),
    ('CB-12',  'varilla', 'varilla', 'VARILLA 3/8" (12mm) 60.000 PSI', 0.56,  None, 12),
    ('CB-16',  'varilla', 'varilla', 'VARILLA 1/2" (16mm) 60.000 PSI', 0.994, None, 12),
    ('CB-20',  'varilla', 'varilla', 'VARILLA 5/8" (20mm) 60.000 PSI', 1.552, None, 12),
    ('CB-25',  'varilla', 'varilla', 'VARILLA 3/4" (25mm) 60.000 PSI', 2.235, None, 12),
    ('CB-28',  'varilla', 'varilla', 'VARILLA 7/8" (28mm) 60.000 PSI', 3.049, None, 12),
    ('CB-32',  'varilla', 'varilla', 'VARILLA 1" (32mm) 60.000 PSI', 3.974, None, 12),
    ('CB-36',  'varilla', 'varilla', 'VARILLA 1-1/4" (36mm) 60.000 PSI', 6.229, None, 12),
    # --- Perfiles IPN (DIN 1025, nominal) ---
    ('IPN-80',  'ipn', 'estructural', 'PERFIL IPN-80 (80x42) h=80mm', 5.9,  0.00214, 6),
    ('IPN-100', 'ipn', 'estructural', 'PERFIL IPN-100 (100x55) h=100mm', 8.36, 0.00311, 6),
    ('IPN-120', 'ipn', 'estructural', 'PERFIL IPN-120 (120x58) h=120mm', 10.4, 0.00372, 6),
    ('IPN-140', 'ipn', 'estructural', 'PERFIL IPN-140 (140x73) h=140mm', 12.9, 0.00484, 6),
    ('IPN-160', 'ipn', 'estructural', 'PERFIL IPN-160 (160x75) h=160mm', 15.8, 0.00557, 6),
    ('IPN-180', 'ipn', 'estructural', 'PERFIL IPN-180 (180x79) h=180mm', 18.8, 0.00618, 6),
    ('IPN-200', 'ipn', 'estructural', 'PERFIL IPN-200 (200x90) h=200mm', 22.4, 0.00736, 6),
    ('IPN-240', 'ipn', 'estructural', 'PERFIL IPN-240 (240x106) h=240mm', 30.6, 0.00897, 6),
    ('IPN-300', 'ipn', 'estructural', 'PERFIL IPN-300 (300x125) h=300mm', 41.4, 0.01108, 6),
    # --- Perfiles C / UPN (DIN 1026, nominal) ---
    ('UPN-50',  'c', 'estructural', 'PERFIL C-50 (50x25) h=50mm', 3.86, 0.00162, 6),
    ('UPN-80',  'c', 'estructural', 'PERFIL C-80 (80x42) h=80mm', 5.6,  0.00234, 6),
    ('UPN-100', 'c', 'estructural', 'PERFIL C-100 (100x50) h=100mm', 7.6, 0.00308, 6),
    ('UPN-120', 'c', 'estructural', 'PERFIL C-120 (120x55) h=120mm', 9.83, 0.00373, 6),
    ('UPN-140', 'c', 'estructural', 'PERFIL C-140 (140x60) h=140mm', 12.4, 0.00440, 6),
    ('UPN-160', 'c', 'estructural', 'PERFIL C-160 (160x65) h=160mm', 15.8, 0.00507, 6),
    ('UPN-200', 'c', 'estructural', 'PERFIL C-200 (200x75) h=200mm', 22.4, 0.00636, 6),
    # --- Ángulos (ASTM A36, nominal) ---
    ('ANG 1.5x1.5x1/8',  'ang', 'estructural', 'ANGULO 1-1/2"x1-1/2"x1/8"', 1.83, 0.00116, 6),
    ('ANG 2x2x1/8',      'ang', 'estructural', 'ANGULO 2"x2"x1/8"', 2.46, 0.00156, 6),
    ('ANG 2x2x3/16',     'ang', 'estructural', 'ANGULO 2"x2"x3/16"', 3.57, 0.00226, 6),
    ('ANG 2x2x1/4',      'ang', 'estructural', 'ANGULO 2"x2"x1/4"', 4.62, 0.00291, 6),
    ('ANG 3x3x1/4',      'ang', 'estructural', 'ANGULO 3"x3"x1/4"', 7.08, 0.00446, 6),
    # --- Tubos estructurales (geométrico, nominal) ---
    ('TUBO 1x1x2mm',    'tubo', 'estructural', 'TUBO ESTRUCTURAL 1"x1"x2mm', 1.27, 0.00010, 6),
    ('TUBO 2x2x2mm',    'tubo', 'estructural', 'TUBO ESTRUCTURAL 2"x2"x2mm', 3.14, 0.00026, 6),
    ('TUBO 2x2x4mm',    'tubo', 'estructural', 'TUBO ESTRUCTURAL 2"x2"x4mm', 6.15, 0.00051, 6),
    ('TUBO 2" SCH40',   'tubo', 'estructural', 'TUBO ESTRUCTURAL REDONDO 2" SCH-40', 5.44, 0.00047, 6),
]

con = sqlite3.connect(DB)
cur = con.cursor()
creados, actualizados = 0, 0
for codigo, familia, tipo, desc, peso, area, long_com in CATALOGO:
    existe = cur.execute('SELECT id, pesoKgM FROM PerfilAcero WHERE codigo=? AND presupuestoId IS NULL', (codigo,)).fetchone()
    if existe:
        if abs(existe[1] - peso) > 1e-9:
            cur.execute('UPDATE PerfilAcero SET pesoKgM=?, descripcion=? WHERE id=?', (peso, desc, existe[0]))
            actualizados += 1
    else:
        cur.execute('''INSERT INTO PerfilAcero (codigo, familia, tipo, descripcion, pesoKgM, areaM2M, longitudComercial, createdAt, updatedAt)
                       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))''',
                    (codigo, familia, tipo, desc, peso, area, long_com))
        creados += 1
con.commit()
total = cur.execute('SELECT COUNT(*) FROM PerfilAcero WHERE presupuestoId IS NULL').fetchone()[0]
con.close()
print(f'✓ Catálogo general de perfiles: {creados} creados, {actualizados} actualizados — total {total}')
