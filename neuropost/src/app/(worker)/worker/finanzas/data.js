// app/worker/finanzas/data.js
// Estructura de datos del panel. Reemplaza los valores por datos reales o
// convierte esta función en un fetch async desde page.jsx.

export function getFinanzasData() {
  return {
    // ---------- Resumen (tarjetas superiores) ----------
    summary: {
      ingresos: 453,
      mrr: 151,
      gastos: 3,
      beneficio: 450,
      beneficioPct: 99.4,
      clientes: 4,
      clientesNetos: 4,
      bajas: 0,
      ingresosDeltaPct: 18.2,
      beneficioDeltaPp: 0.3,
      clientesDeltaPct: 100,
      gastosDeltaPct: 0,
    },

    // ---------- Salud del negocio ----------
    health: {
      churnRate: 0.0,
      nrr: 108,
      quickRatio: 4.0,
    },

    // ---------- Evolución MRR (últimos 6 meses) ----------
    mrrEvolution: [
      { mes: 'Nov', esencial: 25, crecimiento: 0,  total: 25  },
      { mes: 'Dic', esencial: 50, crecimiento: 0,  total: 50  },
      { mes: 'Ene', esencial: 75, crecimiento: 0,  total: 75  },
      { mes: 'Feb', esencial: 75, crecimiento: 76, total: 151 },
      { mes: 'Mar', esencial: 75, crecimiento: 76, total: 151 },
      { mes: 'Abr', esencial: 75, crecimiento: 76, total: 151 },
    ],

    // ---------- Altas vs Bajas (últimos 6 meses) ----------
    clientMovement: [
      { mes: 'Nov', altas: 1, bajas: 0, neto: 1 },
      { mes: 'Dic', altas: 1, bajas: 0, neto: 1 },
      { mes: 'Ene', altas: 1, bajas: 0, neto: 1 },
      { mes: 'Feb', altas: 1, bajas: 0, neto: 1 },
      { mes: 'Mar', altas: 0, bajas: 0, neto: 0 },
      { mes: 'Abr', altas: 0, bajas: 0, neto: 0 },
    ],

    // ---------- Churn rate mensual ----------
    churnHistory: [
      { mes: 'Nov', churn: 0 },
      { mes: 'Dic', churn: 0 },
      { mes: 'Ene', churn: 0 },
      { mes: 'Feb', churn: 0 },
      { mes: 'Mar', churn: 0 },
      { mes: 'Abr', churn: 0 },
    ],

    // ---------- Desglose de gastos ----------
    expenseBreakdown: [
      { categoria: 'APIs e IA',       valor: 3,    color: 'var(--teal)'    },
    ],

    // ---------- Suscripciones por plan ----------
    plans: [
      { nombre: 'Esencial',    clientes: 3, mrr: 75, arpu: 25, color: 'var(--teal)'   },
      { nombre: 'Crecimiento', clientes: 1, mrr: 76, arpu: 76, color: 'var(--violet)' },
    ],

    // ---------- Costes de IA por proveedor ----------
    aiProviders: [
      { proveedor: 'nanobanana', llamadas: 74, costeUsd: 2.96, costeEur: 2.72, mediaUsd: 0.040, color: 'var(--teal)' },
    ],

    // ---------- Rentabilidad por cliente ----------
    clients: [
      { nombre: 'NEUROPOST', plan: 'Esencial',    ingresos: 25, coste: 1.73, margen: 93.1 },
      { nombre: 'SportArea', plan: 'Crecimiento', ingresos: 76, coste: 0.99, margen: 98.7 },
      { nombre: 'a',         plan: 'Esencial',    ingresos: 25, coste: 0,    margen: 100  },
      { nombre: 'SMI',       plan: 'Esencial',    ingresos: 25, coste: 0,    margen: 100  },
    ],

    // ---------- Funnel de conversión (últimos 90 días) ----------
    funnel: [
      { etapa: 'Visitantes',    valor: 1240, convPct: 100,  color: 'var(--steel)'   },
      { etapa: 'Registros',     valor: 96,   convPct: 7.7,  color: 'var(--violet)'  },
      { etapa: 'Trials activos', valor: 42,   convPct: 43.8, color: 'var(--pink)'   },
      { etapa: 'Convertidos',   valor: 8,    convPct: 19.0, color: 'var(--mustard)' },
      { etapa: 'Pago activo',   valor: 4,    convPct: 50.0, color: 'var(--teal)'    },
    ],

    // ---------- Cohort retention heatmap ----------
    cohorts: [
      { cohorte: "Nov '25", clientes: 1, values: [100, 100, 100, 100, 100, 100] },
      { cohorte: "Dic '25", clientes: 1, values: [100, 100, 100, 100, 100, null] },
      { cohorte: "Ene '26", clientes: 1, values: [100, 100, 100, 100, null, null] },
      { cohorte: "Feb '26", clientes: 1, values: [100, 100, 100, null, null, null] },
      { cohorte: "Mar '26", clientes: 0, values: [null, null, null, null, null, null] },
      { cohorte: "Abr '26", clientes: 0, values: [null, null, null, null, null, null] },
    ],

    // ---------- Métricas SaaS ----------
    saas: {
      mrr:        { value: 151,  unit: 'EUR', delta: '+18.2% vs mes anterior', status: 'ok'   },
      arr:        { value: 1812, unit: 'EUR', delta: 'Proyección anual',       status: 'ok'   },
      arpu:       { value: 37.75,unit: 'EUR', delta: 'Promedio por usuario',   status: 'neutral' },
      ltv:        { value: 1888, unit: 'EUR', delta: 'Valor de vida cliente',  status: 'neutral' },
      ltvCac:     { value: null, unit: '',    delta: 'Requiere datos de CAC',  status: 'warn' },
      cac:        { value: null, unit: '',    delta: 'Coste adquisición',      status: 'warn' },
      payback:    { value: null, unit: '',    delta: 'Meses de retorno',       status: 'warn' },
      grossMargin:{ value: 99.4, unit: '%',   delta: 'Excepcional',            status: 'ok'   },
    },
  };
}
