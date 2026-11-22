import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const guiaId = searchParams.get('guiaId') || '';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where = {};
    if (guiaId) where.guiaId = parseInt(guiaId);

    const [items, total] = await Promise.all([
      db.partida.findMany({
        where,
        orderBy: { id: 'asc' },
        take: Math.min(limit, 200),
        skip: offset,
        include: { guia: true },
      }),
      db.partida.count({ where }),
    ]);

    return NextResponse.json({
      items: items.map(p => ({
        id: p.id,
        recordIndex: p.recordIndex,
        guiaId: p.guiaId,
        guiaNombre: p.guia?.nombre || '',
        codigo: p.codigo,
        descripcion: p.descripcion,
        unidad: p.unidad,
        precioBs: p.precioBs,
        rawText: p.rawText,
      })),
      total,
      limit,
      offset,
    });
  } catch (e) {
    console.error('Partidas API error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
