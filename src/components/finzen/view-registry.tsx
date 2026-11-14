import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  Target,
  BarChart3,
  Download,
  Settings,
} from 'lucide-react';
import type { TranslationKey } from '@/lib/finzen/i18n';
import type { ViewKey } from '@/lib/finzen/views';
import {
  VIEW_KEYS,
  type AssertNever,
  type MissingViews,
} from '@/lib/finzen/views';

/**
 * Registro de vistas (convención 10-U2) — ÚNICA lista de iconos del repo.
 *
 * `Record<ViewKey, ViewMeta>` → `tsc` falla si falta una vista (anti-drift).
 * La etiqueta visible sale de i18n (`labelKey`); los `paletteKeywords` son
 * alias técnicos de búsqueda (identificadores, no texto traducible): incluyen
 * sinónimos en español e inglés para que la paleta los encuentre en ambos
 * idiomas.
 */
export interface ViewMeta {
  icon: LucideIcon;
  labelKey: TranslationKey;
  paletteKeywords?: readonly string[];
}

export const VIEW_REGISTRY: Record<ViewKey, ViewMeta> = {
  dashboard: {
    icon: LayoutDashboard,
    labelKey: 'nav.dashboard',
    paletteKeywords: ['dashboard', 'panel', 'resumen', 'inicio', 'home'],
  },
  transactions: {
    icon: Receipt,
    labelKey: 'nav.transactions',
    paletteKeywords: [
      'transactions',
      'transacciones',
      'movimientos',
      'gastos',
      'tx',
    ],
  },
  accounts: {
    icon: Wallet,
    labelKey: 'nav.accounts',
    paletteKeywords: ['accounts', 'cuentas', 'wallet'],
  },
  budgets: {
    icon: Target,
    labelKey: 'nav.budgets',
    paletteKeywords: ['budgets', 'presupuestos'],
  },
  reports: {
    icon: BarChart3,
    labelKey: 'nav.reports',
    paletteKeywords: ['reports', 'reportes', 'informes'],
  },
  import: {
    icon: Download,
    labelKey: 'nav.import',
    paletteKeywords: ['import', 'importar', 'cargar'],
  },
  settings: {
    icon: Settings,
    labelKey: 'nav.settings',
    paletteKeywords: ['settings', 'ajustes', 'configuracion'],
  },
};

/** Orden de navegación en escritorio (sidebar). */
export const DESKTOP_NAV_ORDER: readonly ViewKey[] = VIEW_KEYS;

/** Pestañas principales de la barra inferior (móvil). */
export const MOBILE_PRIMARY = ['dashboard', 'transactions'] as const;

/** Pestaña secundaria de la barra inferior (móvil). */
export const MOBILE_SECONDARY = ['accounts'] as const;

/** Vistas del sheet "Más" (móvil). */
export const MOBILE_MORE = ['budgets', 'reports', 'import', 'settings'] as const;

/** Vistas cubiertas por la partición móvil. */
type MobileCovered =
  | (typeof MOBILE_PRIMARY)[number]
  | (typeof MOBILE_SECONDARY)[number]
  | (typeof MOBILE_MORE)[number];

/**
 * Aserción de cobertura: si una vista nueva no se mete en
 * `MOBILE_PRIMARY`/`MOBILE_SECONDARY`/`MOBILE_MORE`, el tipo deja de ser
 * `never` y `tsc` falla.
 */
export type MobileViewCoverage = AssertNever<MissingViews<MobileCovered>>;
