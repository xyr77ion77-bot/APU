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
      db.precio.findMany({
        where,
        orderBy: { id: 'asc' },
        take: Math.min(limit, 200),
        skip: offset,
        include: { guia: true },
      }),
      db.precio.count({ where }),
    ]);

    return NextResponse.json({
      items: items.map(p => ({
        id: p.id,
        lineIndex: p.lineIndex,
        guiaId: p.guiaId,
        guiaNombre: p.guia?.nombre || '',
        rawText: p.rawText,
        valueFloat: p.valueFloat,
      })),
      total,
      limit,
      offset,
    });
  } catch (e) {
    console.error('Precios API error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
