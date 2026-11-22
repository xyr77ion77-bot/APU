/**
 * Seed script: importa los análisis de precios unitarios (APU) extraídos
 * de los PDFs Guía 1-7 a SQLite via Prisma.
 *
 * Lee los JSON en scripts/data/guia*_analisis.json y pobla las tablas
 * PartidaAnalisis, AnalisisMaterial, AnalisisEquipo, AnalisisManoObra.
 */
import { db } from '@/lib/db'
import * as fs from 'fs'
import * as path from 'path'

interface MaterialRow {
  descripcion: string
  unidad?: string
  cantidad: number
  costo: number
  total: number
}
interface EquipoRow {
  descripcion: string
  cantidad: number
  cop?: number
  costo: number
  total: number
}
interface ManoObraRow {
  cargo: string
  cantidad: number
  jornal: number
  total: number
}
interface PartidaJSON {
  covenin: string
  guia_id: number
  unidad: string
  cantidad_analisis: string
  rendimiento: number
  descripcion: string
  precio_unitario_pdf?: number
  fcas_pct: number
  cedu_pct: number
  total_materiales_bs: number
  unitario_materiales_bs: number
  total_equipos_bs: number
  unitario_equipos_bs: number
  sub_total_mano_obra_bs: number
  factor_costos_bs: number
  total_mano_obra_factor_bs: number
  bono_alimenticio_diario: number
  bono_alimenticio_dias?: number
  bono_alimenticio_bs: number
  total_bono_mas_bs: number
  unitario_mano_obra_bs: number
  costo_directo_unitario_bs: number
  administracion_pct: number
  administracion_bs: number
  utilidad_pct: number
  utilidad_bs: number
  precio_unitario_sin_iva_bs: number
  iva_pct: number
  iva_bs: number
  precio_unitario_bs: number
  materiales: MaterialRow[]
  equipos: EquipoRow[]
  mano_obra: ManoObraRow[]
  pagina_pdf: number
}

async function main() {
  const dataDir = '/home/z/my-project/scripts/data'
  
  // Limpiar tablas antes de importar (idempotente)
  console.log('🧹 Limpiando tablas de análisis...')
  await db.analisisManoObra.deleteMany()
  await db.analisisEquipo.deleteMany()
  await db.analisisMaterial.deleteMany()
  await db.partidaAnalisis.deleteMany()
  
  let totalPartidas = 0
  let totalMateriales = 0
  let totalEquipos = 0
  let totalManoObra = 0
  let duplicados = 0
  
  for (let guiaId = 1; guiaId <= 7; guiaId++) {
    const jsonPath = path.join(dataDir, `guia${guiaId}_analisis.json`)
    if (!fs.existsSync(jsonPath)) {
      console.log(`⚠️  No existe: ${jsonPath}, saltando...`)
      continue
    }
    
    console.log(`\n📖 Procesando Guía ${guiaId}: ${jsonPath}`)
    const partidas: PartidaJSON[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
    console.log(`   ${partidas.length} partidas a importar`)
    
    for (const p of partidas) {
      // Saltar partidas sin covenin válido
      if (!p.covenin || p.covenin.trim() === '') continue
      
      try {
        // Crear o actualizar la partida (upsert por covenin único)
        const partida = await db.partidaAnalisis.upsert({
          where: { covenin: p.covenin },
          create: {
            covenin: p.covenin,
            guiaId: p.guia_id,
            unidad: p.unidad,
            cantidad: p.cantidad_analisis,
            rendimiento: p.rendimiento || 0,
            descripcion: p.descripcion,
            totalMaterialesBs: p.total_materiales_bs || 0,
            totalEquiposBs: p.total_equipos_bs || 0,
            subTotalManoObraBs: p.sub_total_mano_obra_bs || 0,
            factorCostosBs: p.factor_costos_bs || 0,
            totalManoObraFactorBs: p.total_mano_obra_factor_bs || 0,
            bonoAlimenticioBs: p.bono_alimenticio_bs || 0,
            totalBonoMasBs: p.total_bono_mas_bs || 0,
            unitarioMaterialesBs: p.unitario_materiales_bs || 0,
            unitarioEquiposBs: p.unitario_equipos_bs || 0,
            unitarioManoObraBs: p.unitario_mano_obra_bs || 0,
            costoDirectoUnitarioBs: p.costo_directo_unitario_bs || 0,
            administracionPct: p.administracion_pct || 10,
            utilidadPct: p.utilidad_pct || 15,
            ivaPct: p.iva_pct || 16,
            fcasPct: p.fcas_pct || 180,
            ceduPct: p.cedu_pct || 434.27,
            bonoAlimenticioDiario: p.bono_alimenticio_diario || 120,
            precioUnitarioSinIvaBs: p.precio_unitario_sin_iva_bs || 0,
            ivaBs: p.iva_bs || 0,
            precioUnitarioBs: p.precio_unitario_bs || 0,
            paginaPdf: p.pagina_pdf,
            rawText: `${p.covenin} | ${p.unidad} | ${p.descripcion}`,
          },
          update: {
            guiaId: p.guia_id,
            unidad: p.unidad,
            cantidad: p.cantidad_analisis,
            rendimiento: p.rendimiento || 0,
            descripcion: p.descripcion,
            totalMaterialesBs: p.total_materiales_bs || 0,
            totalEquiposBs: p.total_equipos_bs || 0,
            subTotalManoObraBs: p.sub_total_mano_obra_bs || 0,
            factorCostosBs: p.factor_costos_bs || 0,
            totalManoObraFactorBs: p.total_mano_obra_factor_bs || 0,
            bonoAlimenticioBs: p.bono_alimenticio_bs || 0,
            totalBonoMasBs: p.total_bono_mas_bs || 0,
            unitarioMaterialesBs: p.unitario_materiales_bs || 0,
            unitarioEquiposBs: p.unitario_equipos_bs || 0,
            unitarioManoObraBs: p.unitario_mano_obra_bs || 0,
            costoDirectoUnitarioBs: p.costo_directo_unitario_bs || 0,
            administracionPct: p.administracion_pct || 10,
            utilidadPct: p.utilidad_pct || 15,
            ivaPct: p.iva_pct || 16,
            fcasPct: p.fcas_pct || 180,
            ceduPct: p.cedu_pct || 434.27,
            bonoAlimenticioDiario: p.bono_alimenticio_diario || 120,
            precioUnitarioSinIvaBs: p.precio_unitario_sin_iva_bs || 0,
            ivaBs: p.iva_bs || 0,
            precioUnitarioBs: p.precio_unitario_bs || 0,
            paginaPdf: p.pagina_pdf,
            rawText: `${p.covenin} | ${p.unidad} | ${p.descripcion}`,
          },
        })
        
        // Borrar líneas existentes y recrear (si es upsert en una partida existente)
        await db.analisisMaterial.deleteMany({ where: { partidaAnalisisId: partida.id } })
        await db.analisisEquipo.deleteMany({ where: { partidaAnalisisId: partida.id } })
        await db.analisisManoObra.deleteMany({ where: { partidaAnalisisId: partida.id } })
        
        // Insertar materiales
        for (let i = 0; i < p.materiales.length; i++) {
          const m = p.materiales[i]
          await db.analisisMaterial.create({
            data: {
              partidaAnalisisId: partida.id,
              descripcion: m.descripcion,
              unidad: m.unidad || '',
              cantidad: m.cantidad || 0,
              costoBs: m.costo || 0,
              totalBs: m.total || 0,
              posicion: i,
            }
          })
          totalMateriales++
        }
        
        // Insertar equipos
        for (let i = 0; i < p.equipos.length; i++) {
          const e = p.equipos[i]
          await db.analisisEquipo.create({
            data: {
              partidaAnalisisId: partida.id,
              descripcion: e.descripcion,
              cantidad: e.cantidad || 0,
              cop: e.cop || null,
              costoBs: e.costo || 0,
              totalBs: e.total || 0,
              posicion: i,
            }
          })
          totalEquipos++
        }
        
        // Insertar mano de obra
        for (let i = 0; i < p.mano_obra.length; i++) {
          const mo = p.mano_obra[i]
          await db.analisisManoObra.create({
            data: {
              partidaAnalisisId: partida.id,
              cargo: mo.cargo,
              cantidad: mo.cantidad || 0,
              jornalBs: mo.jornal || 0,
              totalBs: mo.total || 0,
              posicion: i,
            }
          })
          totalManoObra++
        }
        
        totalPartidas++
        
        if (totalPartidas % 500 === 0) {
          console.log(`   ✓ ${totalPartidas} partidas procesadas...`)
        }
      } catch (e: any) {
        if (e.code === 'P2002') {
          // Conflicto de unique constraint (covenin duplicado)
          duplicados++
        } else {
          console.error(`   [!] Error en ${p.covenin}:`, e.message)
        }
      }
    }
    console.log(`   ✓ Guía ${guiaId} completada`)
  }
  
  // Actualizar AnalysisStat
  await db.analysisStat.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      insumosCount: 3158,
      partidasCount: 15415,
      preciosCount: 7587,
      filesCount: 226,
      lastUpdated: new Date(),
    },
    update: {
      lastUpdated: new Date(),
    },
  })
  
  console.log('\n' + '='.repeat(60))
  console.log('✅ IMPORTACIÓN COMPLETA')
  console.log('='.repeat(60))
  console.log(`Partidas importadas: ${totalPartidas}`)
  console.log(`  Materiales: ${totalMateriales}`)
  console.log(`  Equipos: ${totalEquipos}`)
  console.log(`  Mano de obra: ${totalManoObra}`)
  console.log(`Duplicados (omitidos): ${duplicados}`)
  
  await db.$disconnect()
}

main().catch(e => {
  console.error('❌ ERROR:', e)
  process.exit(1)
})
