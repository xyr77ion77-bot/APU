import { NextResponse, NextRequest } from 'next/server'
import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { db } from '@/lib/db'
import { calcularPartida } from '@/lib/calculo'
import { calcularDesdeLineas, type ParametrosCalculo } from '@/lib/calculo-core'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * GET /api/presupuestos/[id]/export
 *
 * Genera el libro Excel COMPLETO del presupuesto en el formato UPTBAL usado en
 * los entregables (Indice del Proyecto + Partidas con APU + Computos Metricos +
 * TABULADOR CC + Verificación y criterios), vía scripts/exportar_presupuesto_excel.py.
 *
 * Cada partida del presupuesto sale como bloque APU con fórmulas vivas:
 *   - Partidas de la BD → composición del PartidaAnalisis (materiales/equipos/MO).
 *   - Partidas S/C  → composición personalizada guardada en ItemMaterial/Equipo/ManoObra
 *     (o precio directo estipulado si no tiene líneas).
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const presupuestoId = parseInt(id)
    if (isNaN(presupuestoId) || presupuestoId <= 0) {
      return NextResponse.json({ error: `id inválido: ${id}` }, { status: 400 })
    }

    const presupuesto = await db.presupuesto.findUnique({
      where: { id: presupuestoId },
      include: {
        items: {
          orderBy: { posicion: 'asc' },
          include: {
            partidaAnalisis: { include: { materiales: true, equipos: true, manoObra: true } },
            materiales: { orderBy: { posicion: 'asc' } },
            equipos: { orderBy: { posicion: 'asc' } },
            manoObra: { orderBy: { posicion: 'asc' } },
            computoBloques: {
              include: {
                computo: { select: { id: true, nombre: true } },
                filas: { orderBy: { posicion: 'asc' } },
                regla: true,
              },
            },
          },
        },
      },
    })
    if (!presupuesto) {
      return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })
    }

    const paramsFinal: ParametrosCalculo = {
      fcasPct: presupuesto.fcasPct,
      ceduPct: presupuesto.ceduPct,
      bonoAlimenticioDiario: presupuesto.bonoAlimenticioDiario,
      administracionPct: presupuesto.administracionPct,
      utilidadPct: presupuesto.utilidadPct,
      ivaPct: presupuesto.ivaPct,
    }

    // --- Items con composición completa y PU recalculado por el motor ---
    const items = presupuesto.items.map(item => {
      const pa = item.partidaAnalisis
      let composicion: {
        materiales: { descripcion: string; unidad: string | null; cantidad: number; costoBs: number }[]
        equipos: { descripcion: string; cantidad: number; cop: number | null; costoBs: number }[]
        manoObra: { cargo: string; cantidad: number; jornalBs: number }[]
      }
      let unitarioMaterialesBs: number | null = null
      let unitarioEquiposBs: number | null = null

      if (item.esPersonalizada) {
        composicion = {
          materiales: item.materiales.map(m => ({ descripcion: m.descripcion, unidad: m.unidad, cantidad: m.cantidad, costoBs: m.costoBs })),
          equipos: item.equipos.map(e => ({ descripcion: e.descripcion, cantidad: e.cantidad, cop: e.cop, costoBs: e.costoBs })),
          manoObra: item.manoObra.map(mo => ({ cargo: mo.cargo, cantidad: mo.cantidad, jornalBs: mo.jornalBs })),
        }
      } else if (pa) {
        composicion = {
          materiales: pa.materiales.map(m => ({ descripcion: m.descripcion, unidad: m.unidad, cantidad: m.cantidad, costoBs: m.costoBs })),
          equipos: pa.equipos.map(e => ({ descripcion: e.descripcion, cantidad: e.cantidad, cop: e.cop, costoBs: e.costoBs })),
          manoObra: pa.manoObra.map(mo => ({ cargo: mo.cargo, cantidad: mo.cantidad, jornalBs: mo.jornalBs })),
        }
        unitarioMaterialesBs = pa.unitarioMaterialesBs
        unitarioEquiposBs = pa.unitarioEquiposBs
      } else {
        composicion = { materiales: [], equipos: [], manoObra: [] }
      }

      // PU del motor con los parámetros del presupuesto (referencia para el QA del libro)
      let puConIvaMotor = item.precioUnitarioBs
      if (pa) {
        puConIvaMotor = calcularPartida(pa, paramsFinal).precioUnitarioBs
      } else if (composicion.materiales.length + composicion.equipos.length + composicion.manoObra.length > 0) {
        puConIvaMotor = calcularDesdeLineas(
          {
            rendimiento: item.rendimiento || 1,
            materiales: composicion.materiales,
            equipos: composicion.equipos,
            manoObra: composicion.manoObra,
          },
          paramsFinal,
        ).precioUnitarioBs
      }

      return {
        id: item.id,
        codigo: item.covenin,
        descripcion: item.descripcion,
        unidad: item.unidad,
        cantidad: item.cantidad,
        rendimiento: item.rendimiento,
        seccion: item.seccion,
        esPersonalizada: item.esPersonalizada,
        notas: item.notas,
        precioDirectoBs: item.esPersonalizada && composicion.materiales.length + composicion.equipos.length + composicion.manoObra.length === 0
          ? item.precioUnitarioBs / (1 + paramsFinal.ivaPct / 100)
          : null,
        puConIvaMotor,
        puSinIvaMotor: puConIvaMotor / (1 + paramsFinal.ivaPct / 100),
        unitarioMaterialesBs,
        unitarioEquiposBs,
        composicion,
        // Cómputos métricos vinculados a este item (para la hoja Computos Metricos)
        computos: item.computoBloques.map(b => ({
          computoId: b.computo.id,
          computoNombre: b.computo.nombre,
          posicion: b.posicion,
          cantidadNeta: b.cantidadNeta,
          ajusteAdoptado: b.ajusteAdoptado,
          justificacion: b.justificacion,
          regla: b.regla ? {
            modo: b.regla.modo,
            desperdicioModo: b.regla.desperdicioModo,
            desperdicioPct: b.regla.desperdicioPct,
          } : null,
          filas: b.filas.map(f => ({
            descripcion: f.descripcion,
            tipo: f.tipo,
            numero: f.numero,
            largo: f.largo,
            ancho: f.ancho,
            alto: f.alto,
            valorDirecto: f.valorDirecto,
            signo: f.signo,
            expresion: f.expresion,
            cantidad: f.cantidad,
          })),
        })),
      }
    })

    // --- Tabulador CC vigente (hoja TABULADOR CC 2026, usada por INDEX/MATCH) ---
    const tabuladorRows = await db.insumo.findMany({
      where: { tipo: 'MANO_DE_OBRA', jornalBs: { not: null }, nivelTabulador: { not: null } },
      orderBy: [{ nivelTabulador: 'asc' }, { oficioTabulador: 'asc' }],
      select: {
        codigo: true,
        descripcion: true,
        denominacionTabulador: true,
        jornalBs: true,
        fuente: true,
        fechaTabulador: true,
      },
    })

    const data = {
      presupuesto: {
        id: presupuesto.id,
        nombre: presupuesto.nombre,
        cliente: presupuesto.cliente,
        obra: presupuesto.obra,
        fecha: presupuesto.fecha,
        descripcion: presupuesto.descripcion,
        parametros: paramsFinal,
        generadoEl: new Date().toISOString(),
      },
      items,
      tabulador: tabuladorRows.map(r => ({
        codigo: r.codigo || '',
        denominacion: r.denominacionTabulador || r.descripcion,
        jornalBs: r.jornalBs as number,
        fuente: r.fuente || '',
        fecha: r.fechaTabulador || '19/08/2026',
      })),
      vigenciaTabulador: tabuladorRows[0]?.fechaTabulador || '19/08/2026',
    }

    // --- Generar el libro con Python ---
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'presupuesto-export-'))
    const dataFile = path.join(tmpDir, 'presupuesto.json')
    const outFile = path.join(tmpDir, 'presupuesto.xlsx')
    await fs.writeFile(dataFile, JSON.stringify(data), 'utf8')

    const scriptPath = path.join(process.cwd(), 'scripts', 'exportar_presupuesto_excel.py')
    const pythonBin = process.env.PYTHON_BIN || '/home/z/.venv/bin/python3'

    const result = await new Promise<{ ok: boolean; stderr: string }>((resolve) => {
      const proc = spawn(pythonBin, [scriptPath, '-i', dataFile, '-o', outFile], {
        stdio: ['ignore', 'ignore', 'pipe'],
      })
      let stderr = ''
      proc.stderr.on('data', d => { stderr += d.toString() })
      proc.on('close', code => resolve({ ok: code === 0, stderr }))
      proc.on('error', err => resolve({ ok: false, stderr: `${err.message}\n${stderr}` }))
    })

    if (!result.ok) {
      try { await fs.rm(tmpDir, { recursive: true, force: true }) } catch {}
      return NextResponse.json(
        { error: 'Error al generar el Excel del presupuesto', detalle: result.stderr },
        { status: 500 },
      )
    }

    const fileBuffer = await fs.readFile(outFile)
    try { await fs.rm(tmpDir, { recursive: true, force: true }) } catch {}

    const slug = (presupuesto.nombre || 'presupuesto')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
      .slice(0, 50)
    const fecha = (presupuesto.fecha || new Date().toISOString().slice(0, 10)).replace(/[-/]/g, '')
    const filename = `Presupuesto_${presupuesto.id}_${slug}_${fecha}.xlsx`

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(fileBuffer.length),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (e: any) {
    console.error('Export presupuesto error:', e)
    return NextResponse.json(
      { error: 'Error inesperado al exportar el presupuesto', detalle: e.message },
      { status: 500 },
    )
  }
}
