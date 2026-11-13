'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Lock } from 'lucide-react';
import { useFinZenStore } from '@/store/finzen-store';
import { translations, type TranslationKey } from '@/lib/finzen/i18n';
import { localizedCategoryName } from '@/lib/finzen/localize';
import {
  CATEGORY_COLOR_KEYS,
  normalizeCategoryColor,
  type CategoryColorKey,
} from '@/lib/finzen/category-color';
import { toast } from 'sonner';
import { EmptyState } from '@/components/finzen/ui/empty-state';
import { IconButton } from '@/components/finzen/ui/icon-button';
import { ConfirmDelete } from '@/components/finzen/ui/confirm-delete';
import { CrudDialog } from '@/components/finzen/ui/crud-dialog';
import { CategoryIcon } from '@/components/finzen/ui/category-icon';

const ICON_OPTIONS = ['📦', '🍔', '🏠', '🚇', '🎬', '⚡', '🏥', '🛍️', '💼', '📈', '💻', '↩️', '₿', '💰', '🎓', '✈️', '📱', '🐕', '🍷', '💡'];
const COLOR_OPTIONS = CATEGORY_COLOR_KEYS;

/**
 * Nombre legible de cada token de color (i18n).
 *
 * El swatch ya no se nombra por HEX (convención 10-U1): el color vive en
 * `--cat-N`, así que el `aria-label` describe el TONO de la clave.
 */
const COLOR_LABEL_KEYS: Record<CategoryColorKey, TranslationKey> = {
  'cat-1': 'categories.color.cat1',
  'cat-2': 'categories.color.cat2',
  'cat-3': 'categories.color.cat3',
  'cat-4': 'categories.color.cat4',
  'cat-5': 'categories.color.cat5',
  'cat-6': 'categories.color.cat6',
  'cat-7': 'categories.color.cat7',
  'cat-8': 'categories.color.cat8',
  'cat-9': 'categories.color.cat9',
  'cat-10': 'categories.color.cat10',
  'cat-11': 'categories.color.cat11',
  'cat-12': 'categories.color.cat12',
};

export function CategoriesManager() {
  const { categories, locale, addCategory, updateCategory, deleteCategory } = useFinZenStore();
  const t = translations[locale];
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [nameEs, setNameEs] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [icon, setIcon] = useState('📦');
  const [color, setColor] = useState<string>('cat-12');
  const [direction, setDirection] = useState('expense');

  function resetForm() { setName(''); setNameEs(''); setNameEn(''); setIcon('📦'); setColor('cat-12'); setDirection('expense'); }
  function openCreate() { resetForm(); setEditingId(null); setDialogOpen(true); }
  function openEdit(id: string) {
    const c = categories.find(x => x.id === id); if (!c) return;
    setEditingId(id); setName(c.name); setNameEs(c.nameEs || ''); setNameEn(c.nameEn || '');
    setIcon(c.icon || '📦'); setColor(normalizeCategoryColor(c.color)); setDirection(c.direction); setDialogOpen(true);
  }
  function closeDialog() { setDialogOpen(false); setEditingId(null); setTimeout(resetForm, 200); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error(t['common.nameRequired']); return; }
    const payload = { name: name.trim(), nameEs: nameEs.trim() || name.trim(), nameEn: nameEn.trim() || name.trim(), icon, color, direction };
    try {
      if (editingId) { await updateCategory(editingId, payload); toast.success(t['categories.updated']); }
      else { await addCategory(payload); toast.success(t['categories.created']); }
      closeDialog();
    } catch (err) { toast.error(String(err).replace('Error: ', '')); }
  }

  async function handleDelete(id: string) {
    try { await deleteCategory(id); toast.success(t['categories.deleted']); }
    catch (err) { toast.error(String(err).replace('Error: ', '')); }
  }

  const expenseCats = categories.filter(c => c.direction === 'expense');
  const incomeCats = categories.filter(c => c.direction === 'income');

  function renderCategoryList(cats: typeof categories, title: string) {
    return (
      <div className="space-y-1">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 pb-1">{title}</h4>
        {cats.length === 0 && (
          <EmptyState
            surface="plain"
            titleAs="p"
            titleClassName="text-xs font-normal text-muted-foreground mb-0 px-1 py-3"
            title={t['categories.empty']}
          />
        )}
        {cats.map(c => (
          <div key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border hover:bg-surface-2 transition-colors">
            <CategoryIcon category={c} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{localizedCategoryName(c, locale)}</div>
              {c.isSystem && <div className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" /> {t['categories.system']}</div>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <IconButton
                icon={<Pencil className="w-3.5 h-3.5" />}
                label={t['a11y.edit']}
                onClick={() => openEdit(c.id)}
                size="sm"
              />
              {!c.isSystem && (
                <ConfirmDelete
                  trigger={
                    <IconButton
                      icon={<Trash2 className="w-3.5 h-3.5" />}
                      label={t['a11y.delete']}
                      variant="danger"
                      size="sm"
                    />
                  }
                  title={t['categories.deleteTitle']}
                  description={t['categories.deleteBody']}
                  confirmLabel={t['common.delete']}
                  cancelLabel={t['common.cancel']}
                  onConfirm={() => {
                    void handleDelete(c.id);
                  }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{t['categories.management']}</h3>
        <Button size="sm" variant="outline" className="h-11 min-h-11" onClick={openCreate}><Plus className="w-3.5 h-3.5 mr-1" />{t['categories.new']}</Button>
      </div>
      <div className="space-y-4 max-h-96 overflow-y-auto scroll-area">
        {renderCategoryList(expenseCats, t['categories.expenses'])}
        {renderCategoryList(incomeCats, t['categories.income'])}
      </div>

      <CrudDialog
        open={dialogOpen}
        onOpenChange={o => { if (!o) closeDialog(); }}
        title={editingId ? t['categories.editTitle'] : t['categories.newTitle']}
        submitLabel={editingId ? t['common.save'] : t['common.create']}
        onSubmit={handleSave}
      >
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">{t['categories.nameEs']}</Label>
          <Input value={nameEs} onChange={e => { setNameEs(e.target.value); if (!nameEn) setName(e.target.value); }} placeholder={t['categories.nameEsPlaceholder']} className="h-11" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">{t['categories.nameEn']}</Label>
          <Input value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder="e.g. Restaurants" className="h-11" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">{t['categories.direction']}</Label>
          <Select value={direction} onValueChange={setDirection}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">{t['categories.expenseType']}</SelectItem>
              <SelectItem value="income">{t['categories.incomeType']}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">{t['categories.icon']}</Label>
          <div className="flex flex-wrap gap-2">
            {ICON_OPTIONS.map(ic => (
              <button key={ic} type="button" onClick={() => setIcon(ic)}
                className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-colors ${icon === ic ? 'bg-primary/15 ring-2 ring-primary' : 'bg-surface-2 hover:bg-surface-2'}`}>{ic}</button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">{t['categories.color']}</Label>
          {/* `gap-0`: el botón mide 40×40 (target táctil) y el círculo visible
              sigue siendo de 32px, centrado — así la separación entre swatches
              (y el reparto en filas) queda igual que antes. */}
          <div className="flex flex-wrap gap-0">
            {COLOR_OPTIONS.map(cl => (
              <button
                key={cl}
                type="button"
                onClick={() => setColor(cl)}
                aria-label={t[COLOR_LABEL_KEYS[cl]]}
                aria-pressed={color === cl}
                className="w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center"
              >
                <span
                  className={`w-8 h-8 rounded-full transition-transform ${color === cl ? 'ring-2 ring-offset-2 ring-foreground scale-110' : ''}`}
                  style={{ background: `var(--${cl})` }}
                />
              </button>
            ))}
          </div>
        </div>
      </CrudDialog>
    </Card>
  );
}
