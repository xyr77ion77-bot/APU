import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [partidas, materiales, equipos, manoObra, guias, presupuestos] = await Promise.all([
      db.partidaAnalisis.count(),
      db.analisisMaterial.count(),
      db.analisisEquipo.count(),
      db.analisisManoObra.count(),
      db.guia.findMany({ where: { id: { lte: 7 } }, orderBy: { id: 'asc' } }),
      db.presupuesto.count(),
    ])
    
    // Contar partidas por guía
    const porGuia = await Promise.all(
      guias.map(async g => ({
        id: g.id,
        nombre: g.nombre,
        partidas: await db.partidaAnalisis.count({ where: { guiaId: g.id } }),
      }))
    )
    
    return NextResponse.json({
      partidas,
      materiales,
      equipos,
      manoObra,
      presupuestos,
      porGuia,
    })
  } catch (e: any) {
    console.error('Stats Analisis error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
