import { NextResponse, NextRequest } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

const TIPOS_ELEMENTO = new Set(['muro', 'losa', 'columna', 'paño'])

/**
 * POST /api/computos/[id]/elementos
 *   Crea un elemento constructivo del cómputo (muro/losa/columna/paño) con
 *   nivel, ambiente, geometría y vanos instanciados opcionales.
 * Body: { tipo, descripcion, nivel?, ambiente?, largo, ancho, alto, espesor?, caras?, vanos? }
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const computoId = parseInt(id)
    const computo = await db.computo.findUnique({ where: { id: computoId } })
    if (!computo) return NextResponse.json({ error: 'Cómputo no encontrado' }, { status: 404 })

    const body = await req.json()
    const tipo = typeof body.tipo === 'string' && TIPOS_ELEMENTO.has(body.tipo) ? body.tipo : null
    if (!tipo) return NextResponse.json({ error: `tipo inválido (muro|losa|columna|paño)` }, { status: 400 })
    if (!String(body.descripcion || '').trim()) {
      return NextResponse.json({ error: 'descripcion requerida' }, { status: 400 })
    }

    const num = (v: unknown, def = 0) => {
      const n = parseFloat(String(v ?? '').replace(',', '.'))
      return Number.isFinite(n) ? n : def
    }

    const elemento = await db.computoElemento.create({
      data: {
        computoId,
        tipo,
        descripcion: String(body.descripcion).trim().slice(0, 200),
        nivel: String(body.nivel || '').slice(0, 120),
        ambiente: String(body.ambiente || '').slice(0, 120),
        largo: num(body.largo),
        ancho: num(body.ancho),
        alto: num(body.alto),
        espesor: num(body.espesor),
        caras: [1, 2].includes(num(body.caras, 1)) ? num(body.caras, 1) : 1,
        vanos: {
          create: Array.isArray(body.vanos) ? body.vanos.slice(0, 50).map((v: any, i: number) => ({
            vanoTipoId: Number.isFinite(parseInt(v?.vanoTipoId)) ? parseInt(v.vanoTipoId) : null,
            nombre: String(v?.nombre || `V-${String(i + 1).padStart(2, '0')}`).slice(0, 20),
            tipo: String(v?.tipo || 'puerta'),
            ancho: num(v?.ancho),
            alto: num(v?.alto),
            antepecho: num(v?.antepecho),
            cantidad: Math.max(1, Math.round(num(v?.cantidad, 1))),
            generaCarpinteria: !!v?.generaCarpinteria,
          })) : [],
        },
      },
      include: { vanos: true },
    })

    return NextResponse.json({ elemento })
  } catch (e: any) {
    console.error('POST elemento error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
