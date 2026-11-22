#!/usr/bin/env node
/**
 * Import all extracted data into the SQLite database.
 *
 * Sources:
 * - reverse_analysis/dat_files/INSUMOS_decrypted_max_ascii.csv  → Insumo (3158 rows)
 * - reverse_analysis/dat_files/GUIA*_decrypted_v2.csv           → Partida (descripciones parciales)
 * - reverse_analysis/apu_files/GUIA*_prices.csv                 → Precio (7594 rows)
 * - reverse_analysis/install_manifest.json                       → InstallFile (226 rows)
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();

const ROOT = '/home/z/my-project';
const DAT_DIR = path.join(ROOT, 'reverse_analysis/dat_files');
const APU_DIR = path.join(ROOT, 'reverse_analysis/apu_files');

// ─── Helpers ────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  if (lines.length === 0) return [];
  // Detect delimiter
  const delim = lines[0].includes('\t') ? '\t' : ',';
  const headers = parseCSVLine(lines[0], delim);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i], delim);
    if (cells.length === headers.length) {
      const obj = {};
      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = cells[j];
      }
      rows.push(obj);
    } else {
      // If line doesn't have same number of cells, fall back to splitting
      const obj = {};
      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = cells[j] || '';
      }
      rows.push(obj);
    }
  }
  return rows;
}

function parseCSVLine(line, delim = ',') {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delim) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

function inferCategory(desc) {
  if (!desc) return null;
  const upper = desc.toUpperCase();
  if (upper.includes('CEMENTO') || upper.includes('PORTLAND')) return 'CEMENTO';
  if (upper.includes('ARENA')) return 'ARENA';
  if (upper.includes('BLOQUE') || upper.includes('LADRILLO')) return 'BLOQUE';
  if (upper.includes('CABILLA') || upper.includes('ACERO')) return 'CABILLA';
  if (upper.includes('MADERA')) return 'MADERA';
  if (upper.includes('PIEDRA') || upper.includes('MARMOL') || upper.includes('GRANITO')) return 'PIEDRA';
  if (upper.includes('MALLA')) return 'MALLA';
  if (upper.includes('PINTURA') || upper.includes('ESMALTE') || upper.includes('BARNIZ')) return 'PINTURA';
  if (upper.includes('TUBERIA') || upper.includes('TUBO')) return 'TUBERIA';
  if (upper.includes('CLAVO') || upper.includes('PERNO')) return 'FIJACION';
  if (upper.includes('ALAMBRE') || upper.includes('CABLE')) return 'ELECTRICO';
  return 'OTROS';
}

function inferTipo(desc) {
  if (!desc) return 'MATERIAL';
  const upper = desc.toUpperCase();
  if (upper.includes('OFICIAL') || upper.includes('CAPATAZ') || upper.includes('AYUDANTE') || upper.includes('OPERARIO') || upper.includes('PEON')) return 'MANO_DE_OBRA';
  if (upper.includes('EQUIPO') || upper.includes('MAQUINARIA') || upper.includes('MEZCLADOR')) return 'EQUIPO';
  return 'MATERIAL';
}

function extractUnit(desc) {
  if (!desc) return null;
  // Look for typical units at end of description
  const m = desc.match(/\((?:saco|p\/m2|rollo|kg|saco|litro|galon)[^)]*\)/i);
  if (m) return m[0];
  return null;
}

function extractCost(desc) {
  if (!desc) return null;
  // Look for cost patterns like "42.5 Kgf" or "Bs. 1234"
  const m = desc.match(/(\d+[.,]?\d*)\s*(?:Kgf|kg|Bs\.?|kg\/m)/i);
  if (m) {
    const v = parseFloat(m[1].replace('.', '').replace(',', '.'));
    return isNaN(v) ? null : v;
  }
  return null;
}

// ─── Import Insumos ─────────────────────────────────────────────
async function importInsumos() {
  console.log('Importando INSUMOS...');
  const csvPath = path.join(DAT_DIR, 'INSUMOS_decrypted_max_ascii.csv');
  const text = fs.readFileSync(csvPath, 'latin1');
  const rows = parseCSV(text);
  console.log(`  Encontrados ${rows.length} registros en CSV`);

  await db.insumo.deleteMany({});
  let inserted = 0;
  for (const row of rows) {
    const recordIdx = parseInt(row.record);
    let desc = row.text || '';
    // Strip the 8-byte prefix "bMJbIOZ" (per-record XOR key)
    if (desc.startsWith('bMJbIOZ')) desc = desc.slice(7);
    // Extract first contiguous text run
    const m = desc.match(/^([A-ZÁÉÍÓÚÑa-záéíóúñ0-9.()/,"=:+% -]+)/);
    let description = m ? m[1].trim() : desc.slice(0, 80).trim();
    if (!description) description = `(insumo ${recordIdx})`;

    const categoria = inferCategory(description);
    const tipo = inferTipo(description);
    const unidad = extractUnit(description);
    const costoBs = extractCost(description);

    await db.insumo.create({
      data: {
        id: recordIdx,
        codigo: `INS-${String(recordIdx).padStart(4, '0')}`,
        descripcion: description,
        unidad: unidad,
        costoBs: costoBs,
        tipo: tipo,
        categoria: categoria,
        pesoKg: null,
        rawHex: row.raw_hex || '',
      },
    });
    inserted++;
  }
  console.log(`  Insertados ${inserted} insumos`);
  return inserted;
}

// ─── Import Guías + Partidas ────────────────────────────────────
const GUIA_INFO = [
  { id: 1, nombre: 'Edificaciones (Guía 1)', archivoDat: 'GUIA1.DAT', archivoApu: 'GUIA1.APU', descripcion: 'Partidas de edificaciones - urbanismo y vialidad' },
  { id: 2, nombre: 'Edificaciones (Guía 2)', archivoDat: 'GUIA2.DAT', archivoApu: 'GUIA2.APU', descripcion: 'Partidas de edificaciones - estructura y acabados' },
  { id: 3, nombre: 'Reparaciones (Guía 3)', archivoDat: 'GUIA3.DAT', archivoApu: 'GUIA3.APU', descripcion: 'Partidas de reparaciones / mantenimiento' },
  { id: 4, nombre: 'Instalaciones eléctricas (Guía 4)', archivoDat: 'GUIA4.DAT', archivoApu: 'GUIA4.APU', descripcion: 'Partidas de instalaciones eléctricas' },
  { id: 5, nombre: 'Instalaciones sanitarias (Guía 5)', archivoDat: 'GUIA5.DAT', archivoApu: 'GUIA5.APU', descripcion: 'Partidas de plomería y sanitarios' },
  { id: 6, nombre: 'Obras exteriores (Guía 6)', archivoDat: 'GUIA6.DAT', archivoApu: 'GUIA6.APU', descripcion: 'Partidas de obras exteriores y paisajismo' },
  { id: 7, nombre: 'Especialidades (Guía 7)', archivoDat: 'GUIA7.DAT', archivoApu: 'GUIA7.APU', descripcion: 'Partidas de carpintería, herrería, especialidades' },
  { id: 8, nombre: 'Guía 9000 Edificaciones', archivoDat: '9000ED.DAT', archivoApu: null, descripcion: 'Referencia CIV Guía 9000 - Edificaciones' },
  { id: 9, nombre: 'Guía 9000 Reparaciones', archivoDat: '9000RM.DAT', archivoApu: null, descripcion: 'Referencia CIV Guía 9000 - Reparaciones' },
];

async function importGuiasYPartidas() {
  console.log('Importando Guías y Partidas...');
  await db.guia.deleteMany({});
  await db.partida.deleteMany({});

  for (const g of GUIA_INFO) {
    const csvPath = path.join(DAT_DIR, g.archivoDat.replace('.DAT', '_decrypted_v2.csv'));
    let nRegistros = 0;
    if (fs.existsSync(csvPath)) {
      const text = fs.readFileSync(csvPath, 'latin1');
      const rows = parseCSV(text);
      nRegistros = rows.length;
    }
    await db.guia.create({
      data: {
        id: g.id,
        nombre: g.nombre,
        archivoDat: g.archivoDat,
        archivoApu: g.archivoApu,
        nRegistros: nRegistros,
        descripcion: g.descripcion,
      },
    });
    console.log(`  Guía ${g.id}: ${g.nombre} (${nRegistros} registros)`);

    // Import partidas
    if (fs.existsSync(csvPath)) {
      const text = fs.readFileSync(csvPath, 'latin1');
      const rows = parseCSV(text);
      for (const row of rows) {
        const recIdx = parseInt(row.record);
        let text = row.text || '';
        // Strip constant prefix if present
        if (text.startsWith('bIOZ')) text = text.slice(4);
        // Try to extract description (find first contiguous ASCII text)
        const m = text.match(/([A-ZÁÉÍÓÚÑa-záéíóúñ0-9.()/,"=:+% \-]{8,})/);
        const desc = m ? m[1].trim() : null;
        await db.partida.create({
          data: {
            recordIndex: recIdx,
            guiaId: g.id,
            codigo: `G${g.id}-${String(recIdx).padStart(4, '0')}`,
            descripcion: desc ? desc.slice(0, 200) : null,
            unidad: null,
            precioBs: null,
            rendimiento: null,
            rawText: row.text || '',
            rawHex: row.raw_hex || '',
          },
        });
      }
    }
  }
  const totalPartidas = await db.partida.count();
  console.log(`  Total partidas insertadas: ${totalPartidas}`);
  return totalPartidas;
}

// ─── Import Precios (.APU) ──────────────────────────────────────
async function importPrecios() {
  console.log('Importando Precios desde archivos .APU...');
  await db.precio.deleteMany({});
  let total = 0;
  for (let guiaId = 1; guiaId <= 7; guiaId++) {
    const apuFile = `GUIA${guiaId}.APU`;
    const csvPath = path.join(APU_DIR, `GUIA${guiaId}_prices.csv`);
    if (!fs.existsSync(csvPath)) continue;
    const text = fs.readFileSync(csvPath, 'latin1');
    const rows = parseCSV(text);
    // Skip header row
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row.line || !row.raw_text) continue;
      const lineNum = parseInt(row.line);
      const rawText = row.raw_text;
      const valueFloat = parseFloat(row.price_float);
      if (isNaN(valueFloat)) continue;
      await db.precio.create({
        data: {
          lineIndex: lineNum,
          guiaId: guiaId,
          rawText: rawText,
          valueFloat: valueFloat,
        },
      });
      total++;
    }
    // Update Guia record with n_precios
    const count = rows.length - 1;
    await db.guia.update({ where: { id: guiaId }, data: { nPrecios: count } });
    console.log(`  ${apuFile}: ${count} precios`);
  }
  console.log(`  Total precios insertados: ${total}`);
  return total;
}

// ─── Import Install Manifest ────────────────────────────────────
async function importManifest() {
  console.log('Importando manifiesto de instalación...');
  const manifestPath = path.join(ROOT, 'reverse_analysis/install_manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.log('  Manifiesto no encontrado, saltando...');
    return 0;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  await db.installFile.deleteMany({});
  let id = 0;
  let total = 0;
  for (const filePath of manifest.all_files) {
    id++;
    const filename = filePath.split(/[\\/]/).pop() || filePath;
    const ext = (filename.match(/\.([^.]+)$/) || [, ''])[1].toLowerCase();
    let category = 'ROOT';
    if (filePath.toUpperCase().includes('DOCUMENTOS')) {
      const parts = filePath.split(/[\\/]/);
      const docIdx = parts.findIndex(p => p.toUpperCase() === 'DOCUMENTOS');
      if (docIdx >= 0 && docIdx + 1 < parts.length - 1) {
        category = 'DOCUMENTOS/' + parts[docIdx + 1];
      } else {
        category = 'DOCUMENTOS';
      }
    }
    await db.installFile.create({
      data: {
        id: id,
        filename: filePath,
        extension: '.' + ext,
        category: category,
        size: null,
      },
    });
    total++;
  }
  console.log(`  Total archivos en manifiesto: ${total}`);
  return total;
}

// ─── Main ───────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(60));
  console.log('INICIO DE IMPORTACIÓN DE DATOS');
  console.log('='.repeat(60));

  const t0 = Date.now();
  const insumosCount = await importInsumos();
  const partidasCount = await importGuiasYPartidas();
  const preciosCount = await importPrecios();
  const filesCount = await importManifest();

  // Update stats
  await db.analysisStat.deleteMany({});
  await db.analysisStat.create({
    data: {
      id: 1,
      insumosCount: insumosCount,
      partidasCount: partidasCount,
      preciosCount: preciosCount,
      filesCount: filesCount,
    },
  });

  const dt = ((Date.now() - t0) / 1000).toFixed(2);
  console.log('='.repeat(60));
  console.log(`IMPORTACIÓN COMPLETADA en ${dt}s`);
  console.log(`  - ${insumosCount} insumos`);
  console.log(`  - ${partidasCount} partidas`);
  console.log(`  - ${preciosCount} precios`);
  console.log(`  - ${filesCount} archivos en manifiesto`);
  console.log('='.repeat(60));

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error('ERROR:', e);
  await db.$disconnect();
  process.exit(1);
});
