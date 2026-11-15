import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * P1 — Contrato del drill-down (convención 10-U4), verificado por ESCANEO
 * ESTÁTICO del código (sin jsdom: no hay tests de componentes todavía).
 *
 * Lo que se fija aquí:
 * - El HISTORIAL: cambiar un filtro usa `replace` (no ensucia el historial);
 *   el drill-down desde otra vista usa `push` (el botón "atrás" vuelve).
 * - La MARCA: cada drill-down es un `<button type="button">` real (nunca un
 *   `<div onClick>`, nunca `role="button"`).
 * - La ACCESIBILIDAD: cada drill-down lleva `aria-label` i18n con el dato real
 *   (categoría/cuenta + importe + periodo).
 * - Los DESTINOS: los 7 destinos acordados, cada uno con su filtro.
 */

const SRC = resolve(process.cwd(), 'src');
const read = (relative: string) => readFileSync(resolve(SRC, relative), 'utf8');

const VIEWS = {
  dashboard: 'components/finzen/dashboard-view.tsx',
  reports: 'components/finzen/reports-view.tsx',
  budgets: 'components/finzen/budgets-view.tsx',
  accounts: 'components/finzen/accounts-view.tsx',
} as const;

/** Nº de drill-downs que cada vista debe exponer. */
const EXPECTED_DRILLDOWNS: Record<keyof typeof VIEWS, number> = {
  dashboard: 3, // KPI Ingresos + KPI Gastos + leyenda del donut
  reports: 3, // total Ingresos + total Gastos + top categorías
  budgets: 1, // fila del presupuesto (nombre de la categoría)
  accounts: 1, // nombre de la cuenta
};

/**
 * Localiza los SITIOS de drill-down: handlers `onClick` cuyo cuerpo llama a
 * `drillDownToTransactions(...)` o a `navigate('transactions', { ... })`.
 * Devuelve la etiqueta JSX de apertura (`<button ...>`) y la región del
 * elemento (para comprobar el `aria-label`).
 */
function drillDownSites(src: string): Array<{ tag: string; region: string }> {
  const sites: Array<{ tag: string; region: string }> = [];
  const marker = 'onClick={() =>';
  const positions: number[] = [];
  let idx = src.indexOf(marker);
  while (idx !== -1) {
    positions.push(idx);
    idx = src.indexOf(marker, idx + marker.length);
  }
  positions.forEach((start, i) => {
    const end = i + 1 < positions.length ? positions[i + 1] : Math.min(src.length, start + 900);
    const handler = src.slice(start, end);
    if (
      !handler.includes('drillDownToTransactions(') &&
      !handler.includes("navigate('transactions', {")
    ) {
      return;
    }
    const tagStart = src.lastIndexOf('<button', start);
    if (tagStart === -1) return;
    const tagEnd = findTagEnd(src, tagStart);
    sites.push({ tag: src.slice(tagStart, tagEnd + 1), region: src.slice(tagStart, end) });
  });
  return sites;
}

/**
 * Índice del `>` que CIERRA la etiqueta JSX de apertura.
 * Salta cadenas y grupos `{...}` (los handlers `onClick={() => ...}` contienen
 * `=>`, así que un `indexOf('>')` ingenuo cortaría la etiqueta por la mitad).
 */
function findTagEnd(src: string, from: number): number {
  let i = from;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      i++;
      while (i < src.length && src[i] !== ch) {
        if (src[i] === '\\') i++;
        i++;
      }
      i++;
      continue;
    }
    if (ch === '{') {
      let depth = 0;
      while (i < src.length) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') {
          depth--;
          if (depth === 0) {
            i++;
            break;
          }
        }
        i++;
      }
      continue;
    }
    if (ch === '>') return i;
    i++;
  }
  return src.length;
}

/** Nº de `<button type="button">` reales del fichero. */
function countRawButtons(src: string): number {
  return (src.match(/<button\b/g) ?? []).length;
}

function countTypeButton(src: string): number {
  return (src.match(/<button\b[^>]*type="button"/g) ?? []).length;
}

describe('drill-down — historial del navegador', () => {
  it('cambiar un filtro usa REPLACE (no ensucia el historial)', () => {
    const src = read('hooks/use-transaction-filters.ts');
    expect(src).toContain('replace: opts?.replace ?? true');
    expect(src).toContain("navigate('transactions', {");
  });

  it('el drill-down desde otra vista usa PUSH (el botón atrás vuelve)', () => {
    const src = read('hooks/use-view-navigation.ts');
    expect(src).toContain('if (opts?.replace || isSameView) {');
    expect(src).toContain('router.replace(url, { scroll: false });');
    expect(src).toContain('router.push(url, { scroll: false });');
  });

  it('NINGÚN drill-down pide replace (el destino siempre es una entrada nueva)', () => {
    for (const [name, path] of Object.entries(VIEWS)) {
      const src = read(path);
      const withReplace = src.match(/navigate\('transactions',\s*\{[^}]*replace\s*:/g) ?? [];
      expect(withReplace, `${name} no debe usar replace en el drill-down`).toEqual([]);
    }
  });
});

describe('drill-down — marca y accesibilidad', () => {
  for (const [name, path] of Object.entries(VIEWS)) {
    it(`${name}: ${EXPECTED_DRILLDOWNS[name as keyof typeof VIEWS]} drill-down(s) como <button type="button"> con aria-label i18n`, () => {
      const src = read(path);
      const sites = drillDownSites(src);

      expect(sites).toHaveLength(EXPECTED_DRILLDOWNS[name as keyof typeof VIEWS]);

      for (const site of sites) {
        expect(site.tag, 'el drill-down debe ser un <button type="button">').toContain(
          'type="button"'
        );
        expect(site.region, 'el drill-down debe llevar aria-label i18n').toContain(
          "aria-label={t['drilldown."
        );
      }

      // Todos los `<button>` crudos del fichero son `type="button"`.
      expect(countTypeButton(src)).toBe(countRawButtons(src));
    });
  }

  it('0 <div onClick> y 0 role="button" en las vistas con drill-down', () => {
    for (const path of Object.values(VIEWS)) {
      const src = read(path);
      expect(src.match(/<div\b[^>]*\bonClick=/g) ?? []).toEqual([]);
      expect(src.match(/role="button"/g) ?? []).toEqual([]);
    }
  });
});

describe('drill-down — los 7 destinos acordados', () => {
  it('Dashboard: KPI Ingresos (type=income + mes)', () => {
    const src = read(VIEWS.dashboard);
    expect(src).toContain("type: 'income',");
    expect(src).toContain('from: viewRange?.from ?? null,');
    expect(src).toContain('to: viewRange?.to ?? null,');
    expect(src).toContain("t['drilldown.incomeToTransactions']");
  });

  it('Dashboard: KPI Gastos (type=expense + mes)', () => {
    const src = read(VIEWS.dashboard);
    expect(src).toContain("type: 'expense',");
    expect(src).toContain("t['drilldown.expenseToTransactions']");
  });

  it('Dashboard: leyenda del donut (category + type=expense + mes)', () => {
    const src = read(VIEWS.dashboard);
    expect(src).toContain('categoryId: c.categoryId,');
    // El importe de la leyenda suma SOLO gastos → el destino acota por tipo.
    const legend = drillDownSites(src).find((site) =>
      site.region.includes('categoryId: c.categoryId')
    );
    expect(legend, 'no se encuentra el drill-down de la leyenda del donut').toBeDefined();
    expect(legend?.region).toContain("type: 'expense'");
    expect(src).toContain("t['drilldown.categoryToTransactions']");
  });

  it('Reportes: totales Ingresos/Gastos (type + rango)', () => {
    const src = read(VIEWS.reports);
    expect(src).toContain("type: 'income',");
    expect(src).toContain("type: 'expense',");
    expect(src).toContain('from: periodRange.from,');
    expect(src).toContain('to: periodRange.to,');
  });

  it('Reportes: top categorías (category + type=expense + rango)', () => {
    const src = read(VIEWS.reports);
    expect(src).toContain('categoryId: cat.categoryId,');
    // El importe de la categoría suma SOLO gastos → el destino acota por tipo.
    const top = drillDownSites(src).find((site) =>
      site.region.includes('categoryId: cat.categoryId')
    );
    expect(top, 'no se encuentra el drill-down de las top categorías').toBeDefined();
    expect(top?.region).toContain("type: 'expense'");
    expect(src).toContain('from: periodRange.from,');
    expect(src).toContain('to: periodRange.to,');
    expect(src).toContain("t['drilldown.categoryToTransactions']");
  });

  it('Presupuesto: fila (category + type=expense + el MISMO rango del cálculo de spent)', () => {
    const src = read(VIEWS.budgets);
    expect(src).toContain('categoryId: item.categoryId');
    // El destino acota por TIPO: `spent` suma SOLO gastos → el conjunto que se
    // abre es EXACTAMENTE el que se muestra (igualdad estructural).
    const [row] = drillDownSites(src);
    expect(row, 'no se encuentra el drill-down de la fila de presupuesto').toBeDefined();
    expect(row?.region).toContain("type: 'expense'");
    // El destino usa el rango COMPLETO del presupuesto (puede abarcar meses).
    expect(src).toContain('from: budgetRange.from,');
    expect(src).toContain('to: budgetRange.to,');
    // El cálculo de `spent` usa el MISMO rango y la MISMA función de filtrado
    // que aplica el destino (el número mostrado no puede divergir).
    expect(src).toContain('applyTransactionFilters(');
    expect(src).toContain('from: budgetRange.from,');
    expect(src).toContain('to: budgetRange.to,');
    expect(src).toContain('budgetPeriodRange(budget?.startDate, budget?.endDate');
  });

  it('Cuentas: nombre de la cuenta (account)', () => {
    const src = read(VIEWS.accounts);
    expect(src).toContain('accountId: a.id');
    expect(src).toContain("t['drilldown.accountToTransactions']");
  });
});

describe('drill-down — honestidad de los agregados', () => {
  /** Bloque JSX que va de `from` al cierre `/>` del componente. */
  function jsxBlock(src: string, from: string): string {
    const start = src.indexOf(from);
    expect(start, `no se encuentra ${from}`).toBeGreaterThan(-1);
    const end = src.indexOf('/>', start);
    return src.slice(start, end === -1 ? start + 600 : end);
  }

  it('el patrimonio neto (Dashboard) NO es clicable', () => {
    const block = jsxBlock(read(VIEWS.dashboard), "<KpiCard\n            label={t['dashboard.netWorth']}");
    expect(block).not.toContain('labelAction');
    expect(block).not.toContain('drillDownToTransactions');
  });

  it('el ahorro neto (Reportes) NO es clicable', () => {
    const block = jsxBlock(read(VIEWS.reports), "<StatCard\n          label={t['reports.netSavings']}");
    expect(block).not.toContain('labelAction');
    expect(block).not.toContain('drillDownToTransactions');
  });

  it('el total del presupuesto NO es clicable', () => {
    const src = read(VIEWS.budgets);
    // El total se pinta como texto (no hay `labelAction` ni drill-down en la
    // cabecera de totales).
    const totalsBlock = src.slice(src.indexOf('const totals'), src.indexOf('const totals') + 600);
    expect(totalsBlock).not.toContain('drillDownToTransactions');
    expect(src.match(/labelAction/g) ?? []).toEqual([]);
  });

  it('los contenedores de recharts están marcados como role="img" con aria-label i18n', () => {
    for (const path of [VIEWS.dashboard, VIEWS.reports]) {
      const src = read(path);
      const containers = src.match(/<ResponsiveContainer/g) ?? [];
      const imgs = src.match(/role="img"/g) ?? [];
      expect(
        containers.length,
        `${path}: cada contenedor de recharts necesita role="img"`
      ).toBeLessThanOrEqual(imgs.length);
      expect(src, `${path}: el aria-label del gráfico debe ser i18n`).toContain(
        "aria-label={t['a11y.chart."
      );
    }

    // El sparkline del KpiCard recibe la etiqueta i18n por prop.
    const kpi = read('components/finzen/kpi-card.tsx');
    expect(kpi).toContain('role="img"');
    expect(kpi).toContain('aria-label={sparklineLabel}');
    expect(read(VIEWS.dashboard)).toContain(
      "sparklineLabel={t['a11y.chart.netWorthTrend']}"
    );
  });
});
