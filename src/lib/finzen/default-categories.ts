// Default categories seeded for every new user
// El color es una CLAVE de token (`cat-1`..`cat-12`), nunca un HEX:
// el tono real lo resuelve el tema light/dark en `src/app/globals.css`
// (convención 10-U1 — ver `src/lib/finzen/category-color.ts`).
export const DEFAULT_CATEGORIES = [
  // Income
  { name: 'Salary', nameEs: 'Salario', nameEn: 'Salary', icon: '💼', color: 'cat-1', direction: 'income' },
  { name: 'Passive Income', nameEs: 'Ingreso Pasivo', nameEn: 'Passive Income', icon: '📈', color: 'cat-1', direction: 'income' },
  { name: 'Freelance', nameEs: 'Freelance', nameEn: 'Freelance', icon: '💻', color: 'cat-2', direction: 'income' },
  { name: 'Refund', nameEs: 'Reembolso', nameEn: 'Refund', icon: '↩️', color: 'cat-3', direction: 'income' },
  // Expense
  { name: 'Housing', nameEs: 'Vivienda', nameEn: 'Housing', icon: '🏠', color: 'cat-4', direction: 'expense' },
  { name: 'Food', nameEs: 'Comida', nameEn: 'Food', icon: '🍔', color: 'cat-5', direction: 'expense' },
  { name: 'Transport', nameEs: 'Transporte', nameEn: 'Transport', icon: '🚇', color: 'cat-6', direction: 'expense' },
  { name: 'Leisure', nameEs: 'Ocio', nameEn: 'Leisure', icon: '🎬', color: 'cat-7', direction: 'expense' },
  { name: 'Utilities', nameEs: 'Servicios', nameEn: 'Utilities', icon: '⚡', color: 'cat-8', direction: 'expense' },
  { name: 'Health', nameEs: 'Salud', nameEn: 'Health', icon: '🏥', color: 'cat-9', direction: 'expense' },
  { name: 'Shopping', nameEs: 'Compras', nameEn: 'Shopping', icon: '🛍️', color: 'cat-10', direction: 'expense' },
  { name: 'Investment', nameEs: 'Inversión', nameEn: 'Investment', icon: '₿', color: 'cat-11', direction: 'expense' },
  { name: 'Other', nameEs: 'Otros', nameEn: 'Other', icon: '📦', color: 'cat-12', direction: 'expense' },
];
