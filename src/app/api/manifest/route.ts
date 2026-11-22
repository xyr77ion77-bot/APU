import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const extension = searchParams.get('extension') || '';
    const category = searchParams.get('category') || '';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where = {};
    if (extension) where.extension = extension;
    if (category) where.category = { contains: category };

    const [items, total] = await Promise.all([
      db.installFile.findMany({
        where,
        orderBy: { id: 'asc' },
        take: Math.min(limit, 500),
        skip: offset,
      }),
      db.installFile.count({ where }),
    ]);

    return NextResponse.json({
      items,
      total,
      limit,
      offset,
    });
  } catch (e) {
    console.error('Manifest API error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
