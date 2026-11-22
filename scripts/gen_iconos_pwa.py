#!/usr/bin/env python3
"""Iconos PWA del Visor CIV: 512 y 192 px (con zona segura para maskable)."""
from PIL import Image, ImageDraw, ImageFont

NAVY = (15, 42, 74)        # navy del sidebar
BLUE = (23, 105, 224)      # --blue de la app

def crear(tamano, ruta, con_borde_maskable=False):
    img = Image.new('RGB', (tamano, tamano), NAVY)
    d = ImageDraw.Draw(img)
    # banda inferior con el azul de acento
    banda = int(tamano * 0.16)
    d.rectangle([0, tamano - banda, tamano, tamano], fill=BLUE)
    # texto CIV centrado en la zona superior
    f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', int(tamano * 0.42))
    texto = 'CIV'
    bb = d.textbbox((0, 0), texto, font=f)
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    d.text(((tamano - w) / 2 - bb[0], (tamano - banda - h) / 2 - bb[1]), texto, font=f, fill=(255, 255, 255))
    img.save(ruta)
    print(f'{ruta}: {img.size}')

crear(512, 'public/icon-512.png')
crear(192, 'public/icon-192.png')
crear(512, 'public/icon-512-maskable.png', True)
crear(180, 'public/apple-touch-icon.png')
