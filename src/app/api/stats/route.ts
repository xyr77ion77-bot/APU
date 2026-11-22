import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [insumos, partidas, precios, files, guias] = await Promise.all([
      db.insumo.count(),
      db.partida.count(),
      db.precio.count(),
      db.installFile.count(),
      db.guia.findMany({ orderBy: { id: 'asc' } }),
    ]);

    const insumosByCategory = await db.insumo.groupBy({
      by: ['categoria'],
      _count: { _all: true },
      orderBy: { _count: { categoria: 'desc' } },
    });

    const insumosByTipo = await db.insumo.groupBy({
      by: ['tipo'],
      _count: { _all: true },
      orderBy: { _count: { tipo: 'desc' } },
    });

    const preciosByGuia = await db.precio.groupBy({
      by: ['guiaId'],
      _count: { _all: true },
      _min: { valueFloat: true },
      _max: { valueFloat: true },
      _avg: { valueFloat: true },
    });

    const filesByExtension = await db.installFile.groupBy({
      by: ['extension'],
      _count: { _all: true },
      orderBy: { _count: { extension: 'desc' } },
    });

    const filesByCategory = await db.installFile.groupBy({
      by: ['category'],
      _count: { _all: true },
      orderBy: { _count: { category: 'desc' } },
      take: 15,
    });

    // Estadísticas nuevas del catálogo de insumos (post-actualización Nov-2026)
    const insumosByFuente = await db.insumo.groupBy({
      by: ['fuente'],
      _count: { _all: true },
      orderBy: { _count: { fuente: 'desc' } },
    });

    const insumosLimpios = await db.insumo.count({ where: { esLimpio: true } });
    const insumosConPrecio = await db.insumo.count({ where: { costoBs: { gt: 0 } } });
    const insumosConActualizado = await db.insumo.count({ where: { costoActualizadoBs: { gt: 0 } } });
    const insumosConUnidad = await db.insumo.count({ where: { NOT: { unidad: null } } });
    const equiposConCop = await db.insumo.count({ where: { cop: { not: null } } });
    const manoObraConJornal = await db.insumo.count({ where: { jornalBs: { not: null } } });

    return NextResponse.json({
      totals: { insumos, partidas, precios, files },
      guias: guias.map(g => ({
        id: g.id,
        nombre: g.nombre,
        archivoDat: g.archivoDat,
        archivoApu: g.archivoApu,
        nRegistros: g.nRegistros,
        nPrecios: g.nPrecios,
        descripcion: g.descripcion,
      })),
      insumosByCategory: insumosByCategory.map(c => ({
        categoria: c.categoria || '(sin categoría)',
        count: c._count._all,
      })),
      insumosByTipo: insumosByTipo.map(t => ({
        tipo: t.tipo || '(sin tipo)',
        count: t._count._all,
      })),
      insumosByFuente: insumosByFuente.map(f => ({
        fuente: f.fuente || '(sin fuente)',
        count: f._count._all,
      })),
      insumosCalidad: {
        limpios: insumosLimpios,
        conPrecio: insumosConPrecio,
        conPrecioActualizado: insumosConActualizado,
        conUnidad: insumosConUnidad,
        equiposConCop,
        manoObraConJornal,
      },
      factorActualizacion: {
        factor: 232.56,
        fechaBase: '01/02/2011',
        fechaActualizacion: '09/11/2026',
        tasaBsUsdFeb2011: 4.30,
        tasaBsUsdNov2026: 1000.0,
        metodo: 'USD/BCV: convertir Bs.Feb-2011 a USD (tasa CADIVI 4,30) y luego a Bs.Nov-2026 (tasa BCV 1.000)',
      },
      preciosByGuia: preciosByGuia.map(p => ({
        guiaId: p.guiaId,
        count: p._count._all,
        min: p._min.valueFloat,
        max: p._max.valueFloat,
        avg: p._avg.valueFloat,
      })),
      filesByExtension: filesByExtension.map(e => ({
        extension: e.extension,
        count: e._count._all,
      })),
      filesByCategory: filesByCategory.map(c => ({
        category: c.category,
        count: c._count._all,
      })),
    });
  } catch (e) {
    console.error('Stats API error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
