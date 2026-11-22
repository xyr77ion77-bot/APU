'use client'

import { useState, useEffect } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { formatBs } from '@/lib/calculo'
import type { TabuladorData } from './types'

export function TabuladorView({ onToast }: { onToast: (msg: string) => void }) {
  const [data, setData] = useState<TabuladorData | null>(null)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      fetch(`/api/tabulador${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`)
        .then(r => r.json())
        .then(d => (d.error ? setData(null) : setData(d)))
        .catch(() => setData(null))
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  const fmt = (n: number) => n.toLocaleString('es-VE')

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Tabuladores</h1>
          <p>Tabulador de sueldos y salarios del Contrato Colectivo Único de la Construcción aplicado por el motor de cálculo.</p>
        </div>
      </div>

      {data && (
        <div className="summary-strip">
          <span className="summary-pill"><span className="dot" />Vigencia <strong>{data.vigencia}</strong></span>
          <span className="summary-pill">Cargos <strong>{fmt(data.total)}</strong></span>
          <span className="summary-pill">Bono alimenticio <strong>Bs. {formatBs(data.bonoAlimenticioDiario)}/jornada</strong></span>
          <span className="summary-pill">Bono mensual <strong>Bs. {formatBs(data.bonoAlimenticioMensual)}</strong></span>
          <span className="summary-spacer" />
          <span className="last-update">{data.contrato}</span>
        </div>
      )}

      <div className="toolbar">
        <label className="searchbox">
          <Search size={14} strokeWidth={1.8} />
          <input
            type="search"
            placeholder="Buscar cargo, oficio o nivel…"
            autoComplete="off"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </label>
      </div>

      <div className="table-frame">
        <div className="table-scroll">
          <table className="data-table" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th style={{ width: 60 }}>NIVEL</th>
                <th style={{ width: 60 }}>OFICIO</th>
                <th>CÓDIGO</th>
                <th>DENOMINACIÓN</th>
                <th style={{ textAlign: 'right' }}>BS./JORNAL 19/08/2026</th>
                <th style={{ textAlign: 'right' }}>BS. HOMOLOGACIÓN</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 12 }).map((_, i) => (
                  <tr key={i}>
                    <td><div className="skel" style={{ width: 30 }} /></td>
                    <td><div className="skel" style={{ width: 30 }} /></td>
                    <td><div className="skel" style={{ width: 70 }} /></td>
                    <td><div className="skel" style={{ width: '60%' }} /></td>
                    <td><div className="skel" style={{ width: 80, marginLeft: 'auto' }} /></td>
                    <td><div className="skel" style={{ width: 80, marginLeft: 'auto' }} /></td>
                  </tr>
                ))
              ) : !data || data.items.length === 0 ? (
                <tr><td colSpan={6}><div className="empty">No se encontraron cargos en el tabulador.</div></td></tr>
              ) : (
                data.items.map(r => (
                  <tr key={r.codigo || `${r.nivel}-${r.oficio}`} style={{ cursor: 'default' }}>
                    <td className="num">{r.nivel}</td>
                    <td className="num">{r.oficio}</td>
                    <td><span className="code">{r.codigo}</span></td>
                    <td>
                      <div className="desc" style={{ maxWidth: 380 }} title={r.denominacion}>{r.denominacion}</div>
                      {r.descripcion !== r.denominacion && (
                        <div className="guide-line">{r.descripcion}</div>
                      )}
                    </td>
                    <td className="price" style={{ textAlign: 'right' }}>{formatBs(r.jornalBs)}</td>
                    <td className="price" style={{ textAlign: 'right' }}>
                      {r.jornalHomologacionBs != null ? formatBs(r.jornalHomologacionBs) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="table-foot">
          <span>{loading ? 'Cargando…' : `Mostrando ${fmt(data?.items.length ?? 0)} cargos`}</span>
          <span className="page-info">Contrato Colectivo · Construcción</span>
        </div>
      </div>

      {loading && data && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 10, color: '#8995a3', fontSize: 10 }}>
          <Loader2 size={13} className="animate-spin" />
        </div>
      )}

      <p className="calc-note" style={{ maxWidth: 620 }}>
        <span>
          Los jornales de homologación son los válidos desde la fecha de homologación del Contrato Colectivo.
          El motor de cálculo usa la columna vigente 19/08/2026 para calcular la mano de obra de todas las
          partidas y el bono alimenticio legal y convencional de Bs. 5.407,53 por jornada (Bs. 162.226 al mes).
        </span>
      </p>
    </>
  )
}
