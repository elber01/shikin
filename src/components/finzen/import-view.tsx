'use client';

import { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileSpreadsheet, CheckCircle2, Download, Upload, FileText, Database } from 'lucide-react';
import { toast } from 'sonner';
import { useFinZenStore, type TransactionType } from '@/store/finzen-store';
import { translations } from '@/lib/finzen/i18n';
import { CURRENCIES, type CurrencyCode } from '@/lib/finzen/currency';
import { parseLocalDate, toLocalDateString, toStorageISOString, matchCategory } from '@/lib/finzen/date-utils';
import { parseCSVLine } from '@/lib/finzen/csv';
import {
  downloadTextFile,
  exportFilename,
  exportTransactionsCsv,
  exportTransactionsJson,
} from '@/lib/finzen/export';
import { cn } from '@/lib/utils';
import { OcrFlow } from '@/components/finzen/ocr-flow';
import { BankImportFlow } from '@/components/finzen/bank-import-flow';

type Step = 'upload' | 'mapping' | 'done';

export function ImportView() {
  const store = useFinZenStore();
  const { locale, accounts, categories, baseCurrency } = store;
  const t = translations[locale];
  const [step, setStep] = useState<Step>('upload');
  const [importOpen, setImportOpen] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [allRows, setAllRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [targetAccountId, setTargetAccountId] = useState('');
  const [importedCount, setImportedCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const CANONICAL_FIELDS = [
    { key: 'date', label: t['common.date'], required: true },
    { key: 'amount', label: t['common.amount'], required: true },
    { key: 'description', label: t['common.description'], required: false },
    { key: 'category', label: t['common.category'], required: false },
    { key: 'type', label: t['common.type'], required: false },
  ];

  function resetWizard() { setStep('upload'); setHeaders([]); setAllRows([]); setMapping({}); setImportedCount(0); setIsDragging(false); }

  // El parser es CSV puro (línea a línea) → solo prometenos .csv.
  function parseCsvFile(file: File) {
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
      toast.error(t['import.csvOnly']);
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = String(ev.target?.result ?? '');
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length < 2) { toast.error(t['common.emptyFile']); return; }
        const ph = parseCSVLine(lines[0]);
        const pr = lines.slice(1).map(line => { const v = parseCSVLine(line); const r: Record<string,string> = {}; ph.forEach((h,i) => { r[h] = v[i] ?? ''; }); return r; });
        setHeaders(ph); setAllRows(pr);
        const lookup: Record<string,string[]> = { date: ['date','fecha'], amount: ['amount','monto','value'], description: ['description','descripción','detalle','concepto'], category: ['category','categoría'], type: ['type','tipo'] };
        const autoMap: Record<string,string> = {};
        Object.entries(lookup).forEach(([can, cands]) => { const m = ph.find(h => cands.some(c => h.toLowerCase().trim() === c)); if (m) autoMap[can] = m; });
        setMapping(autoMap); setStep('mapping');
      } catch { toast.error(t['common.csvError']); }
    };
    reader.readAsText(file);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    parseCsvFile(file);
  }

  async function handleCommit() {
    if (!targetAccountId) { toast.error(t['common.selectAccount']); return; }
    let imported = 0, skipped = 0, duplicates = 0, uncategorized = 0;
    const importBatchId = `csv_${Date.now()}`;
    // Build a set of existing transactions for duplicate detection
    const existingTxKeys = new Set<string>();
    store.transactions.forEach(tx => {
      const datePart = tx.occurredOn.split('T')[0];
      const realAccountId = tx.type === 'income' ? tx.toAccountId : tx.fromAccountId;
      const key = `${datePart}|${tx.amount}|${(tx.description || '').toLowerCase().trim()}|${realAccountId}`;
      existingTxKeys.add(key);
    });
    for (const row of allRows) {
      const dateStr = row[mapping.date]; const amountStr = row[mapping.amount];
      if (!dateStr || !amountStr) { skipped++; continue; }
      const d = parseLocalDate(dateStr); if (isNaN(d.getTime())) { skipped++; continue; }
      const cleaned = amountStr.replace(/[^\d.,-]/g, '').replace(',', '.');
      const amount = Math.abs(Number(cleaned)); if (!amount || amount <= 0) { skipped++; continue; }
      const desc = mapping.description ? row[mapping.description] : t['import.defaultDescription'];
      const dateKey = toLocalDateString(d);
      // Check for duplicates (exact match: date + amount + description + account)
      const txKey = `${dateKey}|${amount}|${desc.toLowerCase().trim()}|${targetAccountId}`;
      if (existingTxKeys.has(txKey)) { duplicates++; continue; }
      existingTxKeys.add(txKey);
      const isNeg = cleaned.startsWith('-');
      let type: TransactionType = isNeg ? 'expense' : 'income';
      if (mapping.type && row[mapping.type]) { const tv = row[mapping.type].toLowerCase(); if (tv.includes('ingreso') || tv.includes('income')) type = 'income'; else if (tv.includes('gasto') || tv.includes('expense')) type = 'expense'; }
      // Category matching — use fuzzy matching, NEVER silently default
      let categoryId: string | undefined;
      if (mapping.category && row[mapping.category]) {
        const matched = matchCategory(row[mapping.category], categories);
        if (matched) {
          const found = categories.find(c => c.name === matched);
          if (found) categoryId = found.id;
        } else {
          uncategorized++;
        }
      }
      try {
        await store.addTransaction({ type, amount, currency: baseCurrency as CurrencyCode, fromAccountId: type === 'income' ? `x_${categoryId}` : targetAccountId, toAccountId: type === 'expense' ? `x_${categoryId}` : targetAccountId, categoryId, description: desc, occurredOn: toStorageISOString(d), tags: [importBatchId], importSource: 'csv' });
        imported++;
      } catch { skipped++; }
    }
    setImportedCount(imported); setStep('done');
    let msg = t['import.imported'].replace('{n}', String(imported));
    if (duplicates > 0) msg += t['import.duplicatesSkipped'].replace('{n}', String(duplicates));
    if (uncategorized > 0) msg += t['import.uncategorized'].replace('{n}', String(uncategorized));
    if (skipped > 0) msg += t['import.invalid'].replace('{n}', String(skipped));
    toast.success(msg);
  }

  function exportData(format: 'csv' | 'json') {
    if (store.transactions.length === 0 && store.accounts.length === 0) { toast.error(t['common.noData']); return; }
    const ctx = { categories, accounts, locale, baseCurrency: baseCurrency as CurrencyCode };
    const content =
      format === 'json'
        ? exportTransactionsJson(store.transactions, ctx, {
            exportedAt: new Date().toISOString(),
            accounts: store.accounts,
          })
        : exportTransactionsCsv(store.transactions, ctx);
    downloadTextFile(
      exportFilename('finzen-export', format),
      content,
      format === 'json' ? 'application/json' : 'text/csv'
    );
    toast.success(t['common.exported'].replace('{format}', format.toUpperCase()));
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold">{t['import.title']}</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-0 overflow-hidden">
          <button
            type="button"
            onClick={() => { if (accounts.length === 0) { toast.error(t['import.createAccountFirst']); return; } resetWizard(); setTargetAccountId(accounts[0].id); setImportOpen(true); }}
            className="w-full h-full p-5 text-left cursor-pointer hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center mb-3"><FileSpreadsheet className="w-6 h-6 text-info" /></div>
            <div className="text-base font-semibold">{t['import.csv']}</div><div className="text-xs text-muted-foreground mt-1">{t['import.csvDesc']}</div>
            <div className="flex gap-1.5 mt-3"><span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-surface-2">CSV</span></div>
          </button>
        </Card>
        <OcrFlow onOpenChange={() => {}} />
        <BankImportFlow />
      </div>
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3"><Download className="w-4 h-4 text-muted-foreground" /><h2 className="text-lg font-semibold">{t['import.exportTitle']}</h2></div>
        <p className="text-sm text-muted-foreground mb-4">{t['import.exportHint']}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-11 min-h-11" onClick={() => exportData('csv')}><FileText className="w-4 h-4 mr-1.5" />CSV</Button>
          <Button variant="outline" size="sm" className="h-11 min-h-11" onClick={() => exportData('json')}><Database className="w-4 h-4 mr-1.5" />JSON</Button>
        </div>
      </Card>
      <Dialog open={importOpen} onOpenChange={o => { if (!o) setImportOpen(false); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto scroll-area">
          <DialogHeader><DialogTitle>{t['import.importCsvTitle']}</DialogTitle></DialogHeader>
          {/* File input INSIDE the Dialog so the click works from within the portal */}
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileUpload} />
          {step === 'upload' && (
            <div className="space-y-4 mt-2">
              {/* Drop zone real: click para elegir archivo + arrastrar y soltar */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) parseCsvFile(file);
                }}
                className={cn(
                  'w-full border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                  isDragging ? 'border-primary bg-surface-2' : 'border-border hover:bg-surface-2'
                )}
              >
                <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">{t['import.selectCsv']}</p>
                <p className="text-xs text-muted-foreground mt-1">{t['import.csvDesc']}</p>
              </button>
              <div className="space-y-2"><Label className="text-xs text-muted-foreground">{t['import.bankTarget']}</Label>
                <Select value={targetAccountId} onValueChange={setTargetAccountId}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
          )}
          {step === 'mapping' && (
            <div className="space-y-4 mt-2">
              <div className="text-sm text-muted-foreground">{t['import.mapColumns'].replace('{n}', String(allRows.length))}</div>
              <div className="space-y-3">
                {CANONICAL_FIELDS.map(f => (
                  <div key={f.key} className="grid grid-cols-2 gap-3 items-center">
                    <div className="text-sm font-medium">{f.label}{f.required && <span className="text-expense ml-1">*</span>}</div>
                    <Select value={mapping[f.key] ?? ''} onValueChange={v => setMapping(m => ({ ...m, [f.key]: v }))}><SelectTrigger className="h-10"><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent></Select>
                  </div>
                ))}
              </div>
              <Button className="w-full h-11" disabled={!mapping.date || !mapping.amount} onClick={handleCommit}>{t['import.importCount'].replace('{n}', String(allRows.length))}</Button>
            </div>
          )}
          {step === 'done' && (
            <div className="space-y-4 mt-2 text-center py-4">
              <div className="w-16 h-16 rounded-full bg-income/10 flex items-center justify-center mx-auto"><CheckCircle2 className="w-8 h-8 text-income" /></div>
              <h3 className="text-lg font-semibold">{t['common.importCompleted']}</h3>
              <div className="bg-surface-2 rounded-lg p-4 text-sm space-y-1 max-w-sm mx-auto">
                <div className="flex justify-between"><span className="text-muted-foreground">{t['import.importedLabel']}:</span><span className="font-semibold text-income">{importedCount}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t['import.totalInFile']}:</span><span>{allRows.length}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t['import.batchId']}:</span><span className="font-mono text-xs">{t['import.seeTags']}</span></div>
              </div>
              <Button className="h-11" onClick={() => { setImportOpen(false); resetWizard(); }}>{t['common.close']}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
