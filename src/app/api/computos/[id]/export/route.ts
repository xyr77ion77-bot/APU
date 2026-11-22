import { NextResponse, NextRequest } from 'next/server'
import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { obtenerComputoCompleto, previsualizarAplicacion } from '@/lib/computos-server'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * GET /api/computos/[id]/export
 *
 * Genera el Excel con el layout exacto de la planilla de mediciones (A7):
 *   - Hoja CÓMPUTO:     cabecera (obra, fecha, valuación), columnas Nº/Descripción/
 *                       Unidad/Nº/L/A/H/+/−/ML/M2/M3/KGS/PIEZA/Observación, bloques por
 *                       partida con filas, neto, ajuste y adoptada, firmas al pie.
 *   - Hoja CONSOLIDADO: partida, neta, desperdicio, adoptada, vigente y diferencia.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const computoId = parseInt(id)
    const formato = req.nextUrl.searchParams.get('formato') === 'pdf' ? 'pdf' : 'xlsx'
    const computo = await obtenerComputoCompleto(computoId)
    if (!computo) return NextResponse.json({ error: 'Cómputo no encontrado' }, { status: 404 })

    // Datos completos para el script (incluye la vista previa con vigente/diferencia)
    const data = {
      computo: {
        ...computo,
        generadoEl: new Date().toISOString(),
        preview: previsualizarAplicacion(computo),
      },
    }

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'computo-export-'))
    const dataFile = path.join(tmpDir, 'computo.json')
    const outFile = path.join(tmpDir, formato === 'pdf' ? 'computo.pdf' : 'computo.xlsx')
    await fs.writeFile(dataFile, JSON.stringify(data), 'utf8')

    const scriptPath = path.join(process.cwd(), 'scripts', formato === 'pdf' ? 'exportar_computo_pdf.py' : 'exportar_computo.py')
    const pythonBin = process.env.PYTHON_BIN || '/home/z/.venv/bin/python3'

    const result = await new Promise<{ ok: boolean; stderr: string }>((resolve) => {
      const proc = spawn(pythonBin, [scriptPath, '-i', dataFile, '-o', outFile], {
        stdio: ['ignore', 'ignore', 'pipe'],
      })
      let stderr = ''
      proc.stderr.on('data', (d) => { stderr += d.toString() })
      proc.on('close', (code) => resolve({ ok: code === 0, stderr }))
      proc.on('error', (err) => resolve({ ok: false, stderr: `${err.message}\n${stderr}` }))
    })

    if (!result.ok) {
      try { await fs.rm(tmpDir, { recursive: true, force: true }) } catch {}
      return NextResponse.json(
        { error: 'Error al generar el export del cómputo', detalle: result.stderr },
        { status: 500 },
      )
    }

    const fileBuffer = await fs.readFile(outFile)
    try { await fs.rm(tmpDir, { recursive: true, force: true }) } catch {}

    const slug = (computo.nombre || 'computo')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
      .slice(0, 40)
    const fecha = (computo.presupuesto.fecha || new Date().toISOString().slice(0, 10)).replace(/[-/]/g, '')
    const filename = `Computo_${computo.id}_${slug}_${fecha}.${formato}`
    const contentType = formato === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(fileBuffer.length),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (e: any) {
    console.error('Export computo error:', e)
    return NextResponse.json({ error: 'Error inesperado al exportar cómputo', detalle: e.message }, { status: 500 })
  }
}
