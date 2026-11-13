// Seed script — creates default categories for a new user
// Run with: bun run db:seed

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_CATEGORIES = [
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

async function seedCategoriesForUser(userId: string) {
  for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
    const cat = DEFAULT_CATEGORIES[i];
    await prisma.category.upsert({
      where: { id: `${userId}_${cat.name}` },
      update: {},
      create: {
        id: `${userId}_${cat.name}`,
        userId,
        name: cat.name,
        nameEs: cat.nameEs,
        nameEn: cat.nameEn,
        icon: cat.icon,
        color: cat.color,
        direction: cat.direction,
        isSystem: true,
        sortOrder: i,
      },
    });
  }
  console.log(`Seeded ${DEFAULT_CATEGORIES.length} categories for user ${userId}`);
}

// Export for use in API routes
export { seedCategoriesForUser, DEFAULT_CATEGORIES };

// If run directly, just print a message
if (require.main === module) {
  console.log('This seed function is called per-user during registration.');
  console.log('Run the app and register a new user to seed categories.');
}
