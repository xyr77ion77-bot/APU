import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const categoria = searchParams.get('categoria') || '';
    const tipo = searchParams.get('tipo') || '';
    const fuente = searchParams.get('fuente') || '';
    const esLimpio = searchParams.get('esLimpio'); // 'true' | 'false' | null
    const conPrecio = searchParams.get('conPrecio'); // 'true' para solo con costoBs > 0
    const orderBy = searchParams.get('orderBy') || 'id';
    const orderDir = (searchParams.get('orderDir') || 'asc') as 'asc' | 'desc';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = {};
    if (q) {
      where.OR = [
        { descripcion: { contains: q } },
        { codigo: { contains: q } },
      ];
    }
    if (categoria) where.categoria = categoria;
    if (tipo) where.tipo = tipo;
    if (fuente) where.fuente = fuente;
    if (esLimpio === 'true') where.esLimpio = true;
    if (esLimpio === 'false') where.esLimpio = false;
    if (conPrecio === 'true') where.costoBs = { gt: 0 };

    // Map orderBy string to Prisma field
    const validOrderBy = ['id', 'codigo', 'descripcion', 'costoBs', 'costoActualizadoBs', 'frecuencia', 'tipo', 'categoria', 'createdAt'];
    const orderByField = validOrderBy.includes(orderBy) ? orderBy : 'id';

    const [items, total] = await Promise.all([
      db.insumo.findMany({
        where,
        orderBy: { [orderByField]: orderDir },
        take: Math.min(limit, 200),
        skip: offset,
      }),
      db.insumo.count({ where }),
    ]);

    // Estadísticas resumidas del catálogo (para mostrar totales en UI)
    const stats = await db.insumo.aggregate({
      _count: { _all: true },
      where: {},
    });

    const porTipo = await db.insumo.groupBy({
      by: ['tipo'],
      _count: { _all: true },
      orderBy: { _count: { tipo: 'desc' } },
    });

    const porFuente = await db.insumo.groupBy({
      by: ['fuente'],
      _count: { _all: true },
      orderBy: { _count: { fuente: 'desc' } },
    });

    return NextResponse.json({
      items,
      total,
      limit,
      offset,
      stats: {
        total: stats._count._all,
        porTipo: porTipo.map((t) => ({ tipo: t.tipo, count: t._count._all })),
        porFuente: porFuente.map((f) => ({ fuente: f.fuente, count: f._count._all })),
        factorActualizacion: 232.56,
        fechaBase: '01/02/2011',
        fechaActualizacion: '09/11/2026',
        tasaBsUsdFeb2011: 4.30,
        tasaBsUsdNov2026: 1000.0,
      },
    });
  } catch (e) {
    console.error('Insumos API error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
