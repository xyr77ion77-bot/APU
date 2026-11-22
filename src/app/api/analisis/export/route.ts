import { NextResponse, NextRequest } from 'next/server';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';

/**
 * GET /api/analisis/export?id=<partidaId>
 *
 * Genera un Excel APU (Análisis de Precios Unitarios) en formato CIV para
 * una partida específica, y lo devuelve como descarga.
 *
 * El Excel tiene 4 hojas:
 *   - APU:        análisis completo (materiales, equipos, MO, cálculo)
 *   - TABULADOR:  tabulador CC vigente 19/08/2026
 *   - RESUMEN:    resumen del precio unitario y parámetros
 *   - CRITERIOS:  criterios de cálculo
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get('id');

    if (!idParam) {
      return NextResponse.json(
        { error: 'Parámetro "id" requerido. Uso: /api/analisis/export?id=<partidaId>' },
        { status: 400 }
      );
    }

    const partidaId = parseInt(idParam, 10);
    if (isNaN(partidaId) || partidaId <= 0) {
      return NextResponse.json(
        { error: `"id" debe ser un número entero positivo. Recibido: "${idParam}"` },
        { status: 400 }
      );
    }

    // Generar archivo temporal único
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apu-export-'));
    const outFile = path.join(tmpDir, `APU_partida_${partidaId}.xlsx`);

    // Invocar el script Python
    const scriptPath = path.join(process.cwd(), 'scripts', 'exportar_apu_partida.py');
    const pythonBin = process.env.PYTHON_BIN || '/home/z/.venv/bin/python3';

    const result = await new Promise<{ ok: boolean; stderr: string }>((resolve) => {
      const proc = spawn(pythonBin, [scriptPath, String(partidaId), '-o', outFile], {
        stdio: ['ignore', 'ignore', 'pipe'],
      });

      let stderr = '';
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        resolve({ ok: code === 0, stderr });
      });

      proc.on('error', (err) => {
        resolve({ ok: false, stderr: `${err.message}\n${stderr}` });
      });
    });

    if (!result.ok) {
      // Limpiar directorio temporal en caso de error
      try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
      return NextResponse.json(
        { error: 'Error al generar el Excel APU', detalle: result.stderr },
        { status: 500 }
      );
    }

    // Leer el archivo generado
    const fileBuffer = await fs.readFile(outFile);

    // Limpiar directorio temporal
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}

    // Generar nombre descriptivo (con timestamp para evitar colisiones)
    const ts = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `APU_partida_${partidaId}_${ts}.xlsx`;

    // Devolver como descarga
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(fileBuffer.length),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (e: any) {
    console.error('Export APU error:', e);
    return NextResponse.json(
      { error: 'Error inesperado al exportar APU', detalle: e.message },
      { status: 500 }
    );
  }
}
