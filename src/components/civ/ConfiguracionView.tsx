'use client'

import { useState } from 'react'
import { RotateCcw, Check } from 'lucide-react'
import { PARAMETROS_DEFAULT, type ParametrosCalculo, formatBs } from '@/lib/calculo'

const CAMPOS: { key: keyof ParametrosCalculo; label: string; ayuda: string }[] = [
  { key: 'fcasPct', label: 'F.C.A.S. (%)', ayuda: 'Factor de costos asociados al salario — beneficios sociales y prestaciones sobre la mano de obra.' },
  { key: 'ceduPct', label: 'C.I.V. (%)', ayuda: 'Sobrecarga laboral total del Colegio de Ingenieros de Venezuela (referencial, no entra en la fórmula del precio).' },
  { key: 'bonoAlimenticioDiario', label: 'Bono alimenticio diario (Bs.)', ayuda: 'Bono Alimentario Legal y Convencional del CC vigente — Bs. 5.407,53 por jornada (Bs. 162.226/mes).' },
  { key: 'administracionPct', label: 'Administración (%)', ayuda: 'Gastos generales y de dirección de obra sobre el costo directo.' },
  { key: 'utilidadPct', label: 'Utilidad (%)', ayuda: 'Utilidad del contratista sobre el costo directo más administración.' },
  { key: 'ivaPct', label: 'I.V.A. (%)', ayuda: 'Impuesto al Valor Agregado sobre el precio sin IVA.' },
]

export function ConfiguracionView({ parametros, setParametros, onToast }: {
  parametros: ParametrosCalculo
  setParametros: (p: ParametrosCalculo) => void
  onToast: (msg: string) => void
}) {
  const [guardado, setGuardado] = useState(false)

  const set = (key: keyof ParametrosCalculo, v: number) => {
    setParametros({ ...parametros, [key]: v })
    setGuardado(true)
    setTimeout(() => setGuardado(false), 1200)
  }

  const restablecer = () => {
    setParametros({ ...PARAMETROS_DEFAULT })
    onToast('Parámetros restablecidos a los valores del tabulador vigente')
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Configuración</h1>
          <p>Parámetros de cálculo del motor de precios. Se aplican al presupuesto actual y se conservan en este navegador.</p>
        </div>
        <div className="head-tools">
          <button className="btn outline" onClick={restablecer}>
            <RotateCcw size={14} strokeWidth={1.8} /> Restablecer
          </button>
        </div>
      </div>

      <div className="summary-strip">
        <span className="summary-pill"><span className="dot" />
          {guardado ? <>Cambios guardados <strong>automáticamente</strong></> : <>Parámetros <strong>persistidos</strong> en este navegador</>}
        </span>
        <span className="summary-pill">Costo directo <strong>+ Admin {parametros.administracionPct}%</strong></span>
        <span className="summary-pill">Utilidad <strong>{parametros.utilidadPct}%</strong></span>
        <span className="summary-pill">I.V.A. <strong>{parametros.ivaPct}%</strong></span>
        <span className="summary-spacer" />
        <span className="last-update">Fórmula: CD × (1 + Admin%) × (1 + Util%) × (1 + IVA%)</span>
      </div>

      <div className="panel-card" style={{ marginBottom: 14 }}>
        <div className="panel-title">Parámetros de cálculo <span>Afectan el próximo recálculo del presupuesto</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          {CAMPOS.map(c => (
            <div key={c.key}>
              <label className="field-label">{c.label}</label>
              <input
                className="field-input"
                type="number"
                step="0.01"
                value={parametros[c.key]}
                onChange={e => set(c.key, parseFloat(e.target.value) || 0)}
                style={{ maxWidth: 220 }}
              />
              <p style={{ fontSize: 9, color: '#8793a1', lineHeight: 1.5, margin: '6px 0 0' }}>{c.ayuda}</p>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 14, color: '#12694f', fontSize: 10 }}>
          {guardado && <><Check size={13} strokeWidth={1.8} /> Guardado</>}
        </div>
      </div>

      <div className="panel-card">
        <div className="panel-title">Acerca del motor <span>Colegio de Ingenieros de Venezuela · Edición Febrero 2011</span></div>
        <div className="calc-card" style={{ marginTop: 0 }}>
          <div className="calc-row"><span>Base de datos</span><span>7.594 APU de las Guías 1–7 del CIV</span></div>
          <div className="calc-row"><span>Mano de obra</span><span>Tabulador CC vigente 19/08/2026</span></div>
          <div className="calc-row"><span>Materiales y equipos</span><span>Factor USD/BCV 232,56× (Bs. 4,30 → Bs. 1.000)</span></div>
          <div className="calc-row"><span>Bono alimenticio</span><span>Bs. {formatBs(parametros.bonoAlimenticioDiario)}/jornada</span></div>
          <div className="calc-row emph"><span>Fórmula del precio</span><span className="mono" style={{ fontSize: 9 }}>CD×(1+Admin%)×(1+Util%)×(1+IVA%)</span></div>
          <div className="calc-row"><span>Recalibración masiva</span><span>09/11/2026 · 0 discrepancias verificadas</span></div>
        </div>
        <p className="calc-note">
          <Check size={13} strokeWidth={1.8} />
          <span>
            Los cambios de parámetros solo afectan los cálculos nuevos (presupuesto en construcción y APU que
            se recalculen). Los presupuestos guardados conservan los precios congelados al momento de su guardado.
          </span>
        </p>
      </div>
    </>
  )
}
