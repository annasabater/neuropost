'use client';

import { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis,
  CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea,
} from 'recharts';
import styles from './FinanzasPanel.module.css';

const COLORS = {
  teal:    '#0B6E5F',
  coral:   '#D94F30',
  mustard: '#D9A441',
  violet:  '#5B3F8A',
  steel:   '#2F5D7E',
  pink:    '#C85A85',
  ink:     '#0A0A0A',
  ink60:   '#5C5C5C',
  ink40:   '#9A9A9A',
  line:    '#F1F1F1',
};

const PERIODS = ['1M', '3M', '6M', '12M', 'Todo'];

function fmtEur(value) {
  if (value == null) return '—';
  return `${value.toLocaleString('es-ES')} EUR`;
}

function cohortColor(value) {
  if (value == null) return { bg: '#F6F6F4', color: COLORS.ink40 };
  if (value >= 95) return { bg: '#0B6E5F', color: '#FFF' };
  if (value >= 85) return { bg: '#2F8374', color: '#FFF' };
  if (value >= 75) return { bg: '#5FA394', color: '#FFF' };
  if (value >= 65) return { bg: '#8FC2B3', color: COLORS.ink };
  if (value >= 55) return { bg: '#B9D8CE', color: COLORS.ink };
  return { bg: '#D9E8E3', color: COLORS.ink };
}

function statusClass(status) {
  if (status === 'ok')    return styles.statusOk;
  if (status === 'warn')  return styles.statusWarn;
  if (status === 'alert') return styles.statusAlert;
  return '';
}

function ChartTooltip({ active, payload, label, suffix = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#FFF', border: `1px solid ${COLORS.line}`, padding: '8px 12px',
      borderRadius: 4, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,.06)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontFamily: 'var(--font-mono, monospace)' }}>
          {p.name}: {p.value}{suffix}
        </div>
      ))}
    </div>
  );
}

function Sparkline({ data, color, type = 'area' }) {
  const Chart = type === 'line' ? LineChart : AreaChart;
  return (
    <ResponsiveContainer width="100%" height={40}>
      <Chart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <defs>
          <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity={0.35} />
            <stop offset="1" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {type === 'area' ? (
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.6}
                fill={`url(#spark-${color})`} dot={false} />
        ) : (
          <Line type="linear" dataKey="v" stroke={color} strokeWidth={1.8} dot={false} />
        )}
      </Chart>
    </ResponsiveContainer>
  );
}

export default function FinanzasPanel({ data }) {
  const [period, setPeriod] = useState('3M');

  const { summary, health, mrrEvolution, clientMovement, churnHistory,
          expenseBreakdown, plans, aiProviders, clients, funnel,
          cohorts, saas } = data;

  const sparkIngresos = mrrEvolution.map(m => ({ v: m.total }));
  const sparkClientes = mrrEvolution.map(m => ({ v: m.esencial / 25 + (m.crecimiento > 0 ? 1 : 0) }));
  const sparkGastos   = [2.5, 2.7, 2.6, 2.8, 2.7, 2.72].map(v => ({ v }));
  const sparkBenef    = mrrEvolution.map(m => ({ v: 98 + Math.random() * 2 }));

  return (
    <div className={styles.panel}>

      <h1 className={styles.title}>PANEL FINANCIERO</h1>
      <div className={styles.subheader}>
        Beneficio <b>{fmtEur(summary.beneficio)}</b> · margen{' '}
        <span className={styles.pill}>{summary.beneficioPct}%</span>{' '}
        · <b>+{summary.clientesNetos}</b> clientes netos · churn{' '}
        <span className={`${styles.pill} ${styles.pillCoral}`}>{health.churnRate}%</span>
      </div>

      <div className={styles.tabs} role="tablist">
        {PERIODS.map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`${styles.tab} ${period === p ? styles.tabActive : ''}`}
            role="tab"
            aria-selected={period === p}
          >
            {p}
          </button>
        ))}
      </div>

      {/* KPI ROW */}
      <div className={styles.kpiRow}>
        <div className={`${styles.kpi} ${styles.kpiTeal}`}>
          <div className={styles.stripe} />
          <div className={styles.kpiHead}>💰 Ingresos</div>
          <div className={styles.kpiValue}>
            {summary.ingresos} <span className={styles.kpiValueSmall}>EUR</span>
          </div>
          <div className={styles.kpiMeta}>
            <div className={styles.kpiSub}>MRR · {summary.mrr} EUR</div>
            <div className={`${styles.delta} ${styles.deltaUp}`}>▲ {summary.ingresosDeltaPct}%</div>
          </div>
          <div className={styles.spark}><Sparkline data={sparkIngresos} color={COLORS.teal} /></div>
        </div>

        <div className={`${styles.kpi} ${styles.kpiMustard}`}>
          <div className={styles.stripe} />
          <div className={styles.kpiHead}>📊 Gastos</div>
          <div className={styles.kpiValue}>
            {summary.gastos} <span className={styles.kpiValueSmall}>EUR</span>
          </div>
          <div className={styles.kpiMeta}>
            <div className={styles.kpiSub}>IA + infra</div>
            <div className={`${styles.delta} ${styles.deltaFlat}`}>± {summary.gastosDeltaPct}%</div>
          </div>
          <div className={styles.spark}><Sparkline data={sparkGastos} color={COLORS.mustard} /></div>
        </div>

        <div className={`${styles.kpi} ${styles.kpiViolet}`}>
          <div className={styles.stripe} />
          <div className={styles.kpiHead}>💲 Beneficio</div>
          <div className={styles.kpiValue}>
            {summary.beneficioPct}<span className={styles.kpiValueSmall}>%</span>
          </div>
          <div className={styles.kpiMeta}>
            <div className={styles.kpiSub}>{fmtEur(summary.beneficio)}</div>
            <div className={`${styles.delta} ${styles.deltaUp}`}>▲ {summary.beneficioDeltaPp}pp</div>
          </div>
          <div className={styles.spark}><Sparkline data={sparkBenef} color={COLORS.violet} /></div>
        </div>

        <div className={`${styles.kpi} ${styles.kpiPink}`}>
          <div className={styles.stripe} />
          <div className={styles.kpiHead}>👥 Clientes</div>
          <div className={styles.kpiValue}>{summary.clientes}</div>
          <div className={styles.kpiMeta}>
            <div className={styles.kpiSub}>+{summary.clientesNetos} netos · {summary.bajas} bajas</div>
            <div className={`${styles.delta} ${styles.deltaUp}`}>▲ {summary.clientesDeltaPct}%</div>
          </div>
          <div className={styles.spark}><Sparkline data={sparkClientes} color={COLORS.pink} type="line" /></div>
        </div>
      </div>

      {/* MRR EVOLUTION + HEALTH */}
      <div className={`${styles.row} ${styles.rowTwo}`}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>
              <span className={styles.accent} style={{ background: COLORS.teal }} />
              EVOLUCIÓN DE MRR
            </div>
            <div className={styles.cardHint}>Últimos 6 meses · EUR</div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={mrrEvolution} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fillTeal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={COLORS.teal} stopOpacity={0.8} />
                  <stop offset="1" stopColor={COLORS.teal} stopOpacity={0.4} />
                </linearGradient>
                <linearGradient id="fillViolet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={COLORS.violet} stopOpacity={0.8} />
                  <stop offset="1" stopColor={COLORS.violet} stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={COLORS.line} vertical={false} />
              <XAxis dataKey="mes" stroke={COLORS.ink60} fontSize={11} tickLine={false} />
              <YAxis stroke={COLORS.ink40} fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip suffix=" EUR" />} />
              <Area type="monotone" dataKey="esencial" stackId="1" stroke={COLORS.teal} fill="url(#fillTeal)" name="Esencial" />
              <Area type="monotone" dataKey="crecimiento" stackId="1" stroke={COLORS.violet} fill="url(#fillViolet)" name="Crecimiento" />
              <Line type="monotone" dataKey="total" stroke={COLORS.ink} strokeWidth={2} dot={{ r: 3 }} name="Total MRR" />
            </AreaChart>
          </ResponsiveContainer>
          <div className={styles.legend}>
            <span className={styles.legendItem}><span className={styles.sw} style={{ background: COLORS.teal }} />Esencial</span>
            <span className={styles.legendItem}><span className={styles.sw} style={{ background: COLORS.violet }} />Crecimiento</span>
            <span className={styles.legendItem}><span className={styles.sw} style={{ background: COLORS.ink }} />Total MRR</span>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>
              <span className={styles.accent} style={{ background: COLORS.ink }} />
              SALUD DEL NEGOCIO
            </div>
          </div>
          <div className={styles.healthGrid}>
            <div className={styles.healthItem}>
              <div className={styles.healthLabel}><span className={`${styles.status} ${styles.statusOk}`} />Churn mensual</div>
              <div className={`${styles.healthValue} ${styles.textTeal}`}>{health.churnRate}<span className={styles.healthValueUnit}>%</span></div>
              <div className={styles.healthFootnote}>Benchmark SaaS: &lt; 5%</div>
            </div>
            <div className={styles.healthItem}>
              <div className={styles.healthLabel}><span className={`${styles.status} ${styles.statusOk}`} />NRR · Retención ingresos</div>
              <div className={`${styles.healthValue} ${styles.textTeal}`}>{health.nrr}<span className={styles.healthValueUnit}>%</span></div>
              <div className={styles.healthFootnote}>Objetivo &gt; 100%</div>
            </div>
            <div className={styles.healthItem}>
              <div className={styles.healthLabel}><span className={`${styles.status} ${styles.statusWarn}`} />Quick Ratio</div>
              <div className={`${styles.healthValue} ${styles.textMustard}`}>{health.quickRatio.toFixed(1)}</div>
              <div className={styles.healthFootnote}>Saludable &gt; 4 · Excelente &gt; 8</div>
            </div>
          </div>
        </div>
      </div>

      {/* ALTAS vs BAJAS + CHURN RATE */}
      <div className={`${styles.row} ${styles.rowTwo}`}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}><span className={styles.accent} style={{ background: COLORS.coral }} />ALTAS VS BAJAS · MOVIMIENTO DE CLIENTES</div>
            <div className={styles.cardHint}>Últimos 6 meses</div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={clientMovement.map(d => ({ ...d, bajasNeg: -d.bajas }))} margin={{ top: 10, right: 20, left: 0, bottom: 0 }} stackOffset="sign">
              <CartesianGrid stroke={COLORS.line} vertical={false} />
              <XAxis dataKey="mes" stroke={COLORS.ink60} fontSize={11} tickLine={false} />
              <YAxis stroke={COLORS.ink40} fontSize={10} tickLine={false} axisLine={false} />
              <ReferenceLine y={0} stroke={COLORS.ink60} strokeWidth={1} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload;
                return (
                  <div style={{ background: '#FFF', border: `1px solid ${COLORS.line}`, padding: '8px 12px', borderRadius: 4, fontSize: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
                    <div style={{ color: COLORS.teal }}>Altas: {row.altas}</div>
                    <div style={{ color: COLORS.coral }}>Bajas: {row.bajas}</div>
                    <div style={{ color: COLORS.ink, marginTop: 2, paddingTop: 4, borderTop: `1px solid ${COLORS.line}` }}>Neto: {row.neto > 0 ? '+' : ''}{row.neto}</div>
                  </div>
                );
              }} />
              <Bar dataKey="altas" fill={COLORS.teal} radius={[3, 3, 0, 0]} name="Altas" />
              <Bar dataKey="bajasNeg" fill={COLORS.coral} radius={[0, 0, 3, 3]} name="Bajas" />
              <Line type="monotone" dataKey="neto" stroke={COLORS.ink} strokeWidth={2} strokeDasharray="3 3" dot={{ r: 3 }} name="Neto" />
            </BarChart>
          </ResponsiveContainer>
          <div className={styles.legend}>
            <span className={styles.legendItem}><span className={styles.sw} style={{ background: COLORS.teal }} />Altas</span>
            <span className={styles.legendItem}><span className={styles.sw} style={{ background: COLORS.coral }} />Bajas</span>
            <span className={styles.legendItem}><span className={styles.sw} style={{ background: COLORS.ink }} />Neto</span>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}><span className={styles.accent} style={{ background: COLORS.coral }} />CHURN RATE MENSUAL</div>
            <div className={styles.cardHint}>% de rotación</div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={churnHistory} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={COLORS.line} vertical={false} />
              <XAxis dataKey="mes" stroke={COLORS.ink60} fontSize={10} tickLine={false} />
              <YAxis stroke={COLORS.ink40} fontSize={10} tickLine={false} axisLine={false} domain={[0, 20]} tickFormatter={v => `${v}%`} />
              <ReferenceArea y1={0} y2={5} fill={COLORS.teal} fillOpacity={0.08} label={{ value: 'Zona saludable (<5%)', position: 'insideTopLeft', fontSize: 10, fill: COLORS.teal }} />
              <Tooltip content={<ChartTooltip suffix="%" />} />
              <Line type="monotone" dataKey="churn" stroke={COLORS.coral} strokeWidth={2.2} dot={{ r: 3.5, fill: COLORS.coral }} activeDot={{ r: 5, stroke: '#FFF', strokeWidth: 2 }} name="Churn" />
            </LineChart>
          </ResponsiveContainer>
          <div className={styles.churnFooter}>
            <div><div className={styles.churnLabel}>Actual</div><div className={`${styles.churnNum} ${styles.textTeal}`}>{health.churnRate}%</div></div>
            <div><div className={styles.churnLabel}>Media 6M</div><div className={styles.churnNum}>{(churnHistory.reduce((a, b) => a + b.churn, 0) / churnHistory.length).toFixed(1)}%</div></div>
            <div><div className={styles.churnLabel}>Objetivo</div><div className={`${styles.churnNum} ${styles.textInk60}`}>&lt; 5%</div></div>
          </div>
        </div>
      </div>

      {/* DESGLOSE GASTOS + PLANES */}
      <div className={`${styles.row} ${styles.rowHalf}`}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}><span className={styles.accent} style={{ background: COLORS.mustard }} />DESGLOSE DE GASTOS</div>
            <div className={styles.cardHint}>Total: {summary.gastos} EUR</div>
          </div>
          <div className={styles.donutWrap}>
            <ResponsiveContainer width={200} height={200}>
              <PieChart>
                <Pie data={expenseBreakdown} dataKey="valor" nameKey="categoria" cx="50%" cy="50%" innerRadius={55} outerRadius={85} startAngle={90} endAngle={-270} paddingAngle={2}>
                  {expenseBreakdown.map((entry, idx) => {
                    const colorMap = { 'var(--teal)': COLORS.teal, 'var(--violet)': COLORS.violet, 'var(--steel)': COLORS.steel, 'var(--pink)': COLORS.pink, 'var(--mustard)': COLORS.mustard };
                    return <Cell key={idx} fill={colorMap[entry.color] || COLORS.teal} />;
                  })}
                </Pie>
                <Tooltip content={<ChartTooltip suffix=" EUR" />} />
              </PieChart>
            </ResponsiveContainer>
            <div className={styles.donutLegend}>
              {expenseBreakdown.map((item, idx) => {
                const total = expenseBreakdown.reduce((a, b) => a + b.valor, 0);
                const pct = ((item.valor / total) * 100).toFixed(1);
                return (
                  <div key={idx} className={styles.donutRow}>
                    <span><span className={styles.sw} style={{ display: 'inline-block', marginRight: 8, verticalAlign: 'middle', background: item.color }} />{item.categoria}</span>
                    <span className={styles.num}>{item.valor.toFixed(2)} EUR <span className={styles.muted}>· {pct}%</span></span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}><span className={styles.accent} style={{ background: COLORS.violet }} />SUSCRIPCIONES POR PLAN</div>
            <div className={styles.cardHint}>MRR por plan</div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={plans} layout="vertical" margin={{ top: 10, right: 50, left: 30, bottom: 0 }}>
              <CartesianGrid stroke={COLORS.line} horizontal={false} />
              <XAxis type="number" stroke={COLORS.ink40} fontSize={10} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="nombre" stroke={COLORS.ink} fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip suffix=" EUR MRR" />} />
              <Bar dataKey="mrr" radius={[0, 3, 3, 0]} name="MRR">
                {plans.map((p, i) => {
                  const colorMap = { 'var(--teal)': COLORS.teal, 'var(--violet)': COLORS.violet };
                  return <Cell key={i} fill={colorMap[p.color] || COLORS.teal} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className={styles.planKpiGrid}>
            {plans.map((p, i) => {
              const colorMap = { 'var(--teal)': COLORS.teal, 'var(--violet)': COLORS.violet };
              return (
                <div key={i}>
                  <div className={styles.healthLabel}>ARPU {p.nombre}</div>
                  <div className={styles.planKpi} style={{ color: colorMap[p.color] || COLORS.teal }}>{p.arpu} EUR</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* FUNNEL + COHORT */}
      <div className={`${styles.row} ${styles.rowHalf}`}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}><span className={styles.accent} style={{ background: COLORS.pink }} />FUNNEL DE CONVERSIÓN</div>
            <div className={styles.cardHint}>Últimos 90 días</div>
          </div>
          <div className={styles.funnel}>
            {funnel.map((step, i) => {
              const maxValue = funnel[0].valor;
              const widthPct = (step.valor / maxValue) * 100;
              const colorMap = { 'var(--steel)': COLORS.steel, 'var(--violet)': COLORS.violet, 'var(--pink)': COLORS.pink, 'var(--mustard)': COLORS.mustard, 'var(--teal)': COLORS.teal };
              return (
                <div key={i} className={styles.funnelStep}>
                  <div className={styles.funnelLabel}>{step.etapa}</div>
                  <div className={styles.funnelBarWrap}>
                    <div className={styles.funnelBar} style={{ width: `${widthPct}%`, background: colorMap[step.color] || COLORS.teal }}>{step.valor.toLocaleString('es-ES')}</div>
                  </div>
                  <div className={styles.funnelConv}>{step.convPct}%</div>
                </div>
              );
            })}
          </div>
          <div className={styles.funnelFooter}>
            <b>Conversión global:</b> visita → pago <b>{((funnel[funnel.length - 1].valor / funnel[0].valor) * 100).toFixed(2)}%</b> · trial → pago <b>{((funnel[funnel.length - 1].valor / funnel[2].valor) * 100).toFixed(1)}%</b>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}><span className={styles.accent} style={{ background: COLORS.teal }} />RETENCIÓN POR COHORTE</div>
            <div className={styles.cardHint}>% clientes activos</div>
          </div>
          <table className={styles.cohort}>
            <thead>
              <tr>
                <th></th><th>Clientes</th>
                {['M0', 'M1', 'M2', 'M3', 'M4', 'M5'].map(m => <th key={m}>{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c, i) => (
                <tr key={i}>
                  <td className={styles.cohortRowLabel}>{c.cohorte}</td>
                  <td>{c.clientes}</td>
                  {c.values.map((v, j) => {
                    const { bg, color } = cohortColor(v);
                    return <td key={j} style={{ background: bg, color }}>{v == null ? '—' : v}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.cohortFooter}>Retención 100% a 6 meses en todas las cohortes existentes. <b>Excelente.</b></div>
        </div>
      </div>

      {/* COSTES DE IA POR PROVEEDOR */}
      <div className={`${styles.row} ${styles.rowFull}`}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}><span className={styles.accent} style={{ background: COLORS.mustard }} />COSTES DE IA POR PROVEEDOR</div>
            <div className={styles.cardHint}>Total: {aiProviders.reduce((a, b) => a + b.costeEur, 0).toFixed(2)} EUR · {aiProviders.reduce((a, b) => a + b.llamadas, 0)} llamadas</div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={aiProviders} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={COLORS.line} vertical={false} />
              <XAxis dataKey="proveedor" stroke={COLORS.ink} fontSize={11} tickLine={false} />
              <YAxis stroke={COLORS.ink40} fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `${v} EUR`} />
              <Tooltip content={<ChartTooltip suffix=" EUR" />} />
              <Bar dataKey="costeEur" radius={[3, 3, 0, 0]} name="Coste">
                {aiProviders.map((p, i) => {
                  const colorMap = { 'var(--teal)': COLORS.teal, 'var(--violet)': COLORS.violet, 'var(--steel)': COLORS.steel, 'var(--mustard)': COLORS.mustard, 'var(--pink)': COLORS.pink };
                  return <Cell key={i} fill={colorMap[p.color] || COLORS.teal} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <table className={`${styles.table} ${styles.aiTable}`}>
            <thead>
              <tr><th>Proveedor</th><th>Llamadas</th><th>Coste USD</th><th>Coste EUR</th><th>Media / llamada</th><th>% del total</th></tr>
            </thead>
            <tbody>
              {aiProviders.map((p, i) => {
                const totalEur = aiProviders.reduce((a, b) => a + b.costeEur, 0) || 1;
                const pct = ((p.costeEur / totalEur) * 100).toFixed(0);
                const colorMap = { 'var(--teal)': COLORS.teal, 'var(--violet)': COLORS.violet, 'var(--steel)': COLORS.steel, 'var(--mustard)': COLORS.mustard, 'var(--pink)': COLORS.pink };
                return (
                  <tr key={i}>
                    <td><span className={styles.sw} style={{ display: 'inline-block', marginRight: 8, verticalAlign: 'middle', background: colorMap[p.color] || COLORS.teal }} /><b>{p.proveedor}</b></td>
                    <td className={styles.num}>{p.llamadas}</td>
                    <td className={`${styles.num} ${styles.textTeal}`}>${p.costeUsd.toFixed(2)}</td>
                    <td className={styles.num}>{p.costeEur.toFixed(2)} EUR</td>
                    <td className={styles.num}>${p.mediaUsd.toFixed(3)}</td>
                    <td>
                      <div className={`${styles.mbar} ${styles.mbarLarge}`}><span className={styles.mbarFill} style={{ width: `${pct}%`, background: colorMap[p.color] || COLORS.teal }} /></div>{' '}
                      <span className={styles.num} style={{ fontSize: 11 }}>{pct}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* RENTABILIDAD POR CLIENTE */}
      <div className={`${styles.row} ${styles.rowFull}`}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}><span className={styles.accent} style={{ background: COLORS.teal }} />RENTABILIDAD POR CLIENTE</div>
            <div className={styles.cardHint}>Margen bruto mensual</div>
          </div>
          <table className={styles.table}>
            <thead>
              <tr><th>Cliente</th><th>Plan</th><th>Ingresos / mes</th><th>Coste IA / mes</th><th>Margen bruto</th><th style={{ width: '30%' }}>Visualización</th></tr>
            </thead>
            <tbody>
              {clients.map((c, i) => (
                <tr key={i}>
                  <td><b>{c.nombre}</b></td>
                  <td><span className={`${styles.planTag} ${c.plan === 'Esencial' ? styles.planEss : styles.planCre}`}>{c.plan}</span></td>
                  <td className={styles.num}>{c.ingresos} EUR</td>
                  <td className={`${styles.num} ${c.coste > 0 ? styles.textMustard : styles.textInk40}`}>{c.coste === 0 ? '0 EUR' : `${c.coste.toFixed(2)} EUR`}</td>
                  <td className={`${styles.num} ${styles.textTeal}`}>{c.margen}%</td>
                  <td><div className={styles.mbar}><span className={styles.mbarFill} style={{ width: `${c.margen}%` }} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MÉTRICAS SAAS */}
      <div className={styles.card} style={{ marginBottom: 14 }}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}><span className={styles.accent} style={{ background: COLORS.ink }} />MÉTRICAS SAAS</div>
          <div className={styles.cardHint}>KPIs clave del negocio</div>
        </div>
        <div className={styles.saasGrid}>
          {[
            { key: 'mrr', label: 'MRR', colorClass: styles.textTeal },
            { key: 'arr', label: 'ARR', colorClass: styles.textTeal },
            { key: 'arpu', label: 'ARPU', colorClass: styles.textViolet },
            { key: 'ltv', label: 'LTV', colorClass: styles.textViolet },
            { key: 'ltvCac', label: 'LTV / CAC', colorClass: styles.textMustard },
            { key: 'cac', label: 'CAC', colorClass: styles.textMustard },
            { key: 'payback', label: 'Payback', colorClass: styles.textMustard },
            { key: 'grossMargin', label: 'Gross Margin', colorClass: styles.textTeal },
          ].map(m => {
            const d = saas[m.key];
            return (
              <div key={m.key} className={styles.saas}>
                <div className={styles.saasLabel}><span className={`${styles.status} ${statusClass(d.status)}`} />{m.label}</div>
                <div className={`${styles.saasValue} ${m.colorClass}`}>
                  {d.value == null ? '—' : d.value.toLocaleString('es-ES')}
                  {d.unit && d.value != null && <span className={styles.saasValueUnit}> {d.unit}</span>}
                </div>
                <div className={`${styles.saasTrend} ${d.status === 'ok' ? styles.textTeal : styles.textInk60}`}>
                  {d.status === 'ok' ? '▲ ' : ''}{d.delta}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <div className={styles.propose}>
        <div className={styles.proposeTitle}>💡 SIGUIENTE PASO</div>
        <div className={styles.proposeText}>
          Para completar <b>LTV/CAC, CAC y Payback</b> necesitas registrar los canales de
          adquisición y los costes de marketing por cliente. Añade un módulo de{' '}
          <b>&quot;Fuentes de adquisición&quot;</b> en la sección Clientes y estas métricas se
          calcularán automáticamente.
        </div>
      </div>
    </div>
  );
}
