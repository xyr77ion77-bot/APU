import { NextResponse, NextRequest } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * PATCH /api/perfiles/[id] — corrige el peso nominal u otros datos del perfil.
 * DELETE — quita el perfil de la obra (solo propios; los generales se conservan).
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const pid = parseInt(id)
    const perfil = await db.perfilAcero.findUnique({ where: { id: pid } })
    if (!perfil) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    const body = await req.json()
    const num = (v: unknown) => {
      const n = parseFloat(String(v ?? '').replace(',', '.'))
      return Number.isFinite(n) ? n : undefined
    }
    const data: Record<string, unknown> = {}
    if (typeof body.codigo === 'string' && body.codigo.trim()) data.codigo = body.codigo.trim().slice(0, 60)
    if (typeof body.descripcion === 'string') data.descripcion = body.descripcion.slice(0, 200)
    if (typeof body.familia === 'string' && body.familia.trim()) data.familia = body.familia.trim().slice(0, 30)
    const peso = num(body.pesoKgM)
    if (peso !== undefined && peso > 0) data.pesoKgM = peso
    const area = num(body.areaM2M)
    if (area !== undefined) data.areaM2M = area > 0 ? area : null
    const lon = num(body.longitudComercial)
    if (lon !== undefined && lon > 0) data.longitudComercial = lon
    const actualizado = await db.perfilAcero.update({ where: { id: pid }, data })
    return NextResponse.json({ perfil: actualizado })
  } catch (e: any) {
    console.error('PATCH perfiles error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const pid = parseInt(id)
    const perfil = await db.perfilAcero.findUnique({ where: { id: pid } })
    if (!perfil) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    if (perfil.presupuestoId === null) {
      return NextResponse.json({ error: 'Los perfiles generales del catálogo no se pueden eliminar' }, { status: 400 })
    }
    // Las reglas que lo usaban quedan sin perfil (el motor avisa y genera longitud)
    await db.perfilAcero.delete({ where: { id: pid } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('DELETE perfiles error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
