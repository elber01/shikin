'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Key, Plus, Copy, Trash2, Check, Bot, Eye, EyeOff } from 'lucide-react';
import { useFinZenStore } from '@/store/finzen-store';
import { translations } from '@/lib/finzen/i18n';
import { intlLocale } from '@/lib/finzen/localize';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export function ApiKeyManager() {
  const { locale } = useFinZenStore();
  const t = translations[locale];
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPerms, setNewKeyPerms] = useState('read,write');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/api-keys');
      if (res.ok) {
        const data = await res.json();
        setKeys(data);
      }
    } catch (e) {
      console.error('Failed to load API keys:', e);
    }
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadKeys(); }, [loadKeys]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim()) { toast.error(t['common.nameRequired']); return; }
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim(), permissions: newKeyPerms }),
      });
      if (res.ok) {
        const data = await res.json();
        setCreatedKey(data.key);
        setShowKey(false);
        toast.success(t['apiKeys.created']);
        setNewKeyName('');
        setNewKeyPerms('read,write');
        loadKeys();
      } else {
        toast.error(t['common.failed']);
      }
    } catch { toast.error(t['common.failed']); }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/api-keys/${id}`, { method: 'DELETE' });
      toast.success(t['apiKeys.revoked']);
      loadKeys();
    } catch { toast.error(t['common.failed']); }
  }

  async function handleToggle(id: string, currentActive: boolean) {
    try {
      await fetch(`/api/api-keys/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      toast.success(currentActive ? t['apiKeys.deactivated'] : t['apiKeys.activated']);
      loadKeys();
    } catch { toast.error(t['common.failed']); }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success(t['apiKeys.copied']);
  }

  function closeDialog() {
    setDialogOpen(false);
    setCreatedKey(null);
    setShowKey(false);
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString(intlLocale(locale), { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">{t['apiKeys.integration']}</h3>
        </div>
        <Button size="sm" variant="outline" className="h-11 min-h-11" onClick={() => { setCreatedKey(null); setDialogOpen(true); }}>
          <Plus className="w-3.5 h-3.5 mr-1" />{t['apiKeys.new']}
        </Button>
      </div>

      {keys.length === 0 && !loading ? (
        <div className="py-6 text-center">
          <Key className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground mb-3">
            {t['apiKeys.emptyHint']}
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto scroll-area">
          {keys.map(key => (
            <div key={key.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-surface-2 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Key className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{key.name}</span>
                  {!key.isActive && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {t['apiKeys.inactive']}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                  <code className="font-mono">{key.keyPrefix}</code>
                  <span>·</span>
                  <span>{key.permissions}</span>
                  <span>·</span>
                  <span>{t['apiKeys.used']}: {formatDate(key.lastUsedAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleToggle(key.id, key.isActive)} className="p-1.5 rounded-md hover:bg-surface-2 text-muted-foreground min-w-[40px] min-h-[40px] flex items-center justify-center" title={key.isActive ? t['apiKeys.deactivate'] : t['apiKeys.activate']} aria-label={key.isActive ? t['apiKeys.deactivate'] : t['apiKeys.activate']}>
                  {key.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="p-1.5 rounded-md hover:bg-expense-soft text-muted-foreground hover:text-expense min-w-[40px] min-h-[40px] flex items-center justify-center" title={t['a11y.delete']} aria-label={t['a11y.delete']}><Trash2 className="w-3.5 h-3.5" /></button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t['apiKeys.revokeTitle']}</AlertDialogTitle>
                      <AlertDialogDescription>{t['apiKeys.revokeBody']}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t['common.cancel']}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(key.id)} className="bg-expense text-primary-foreground hover:bg-expense/90">{t['apiKeys.revoke']}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* API documentation snippet */}
      <div className="mt-3 p-3 rounded-lg bg-surface-2 text-xs space-y-1">
        <div className="font-medium text-muted-foreground">{t['apiKeys.publicEndpoints']}</div>
        <code className="block text-[11px] text-muted-foreground">POST /api/v1/expenses&nbsp;&nbsp;&nbsp;— {t['apiKeys.registerExpense']}</code>
        <code className="block text-[11px] text-muted-foreground">GET&nbsp; /api/v1/expenses&nbsp;&nbsp;&nbsp;— {t['apiKeys.listExpenses']}</code>
        <code className="block text-[11px] text-muted-foreground">GET&nbsp; /api/v1/summary&nbsp;&nbsp;&nbsp;&nbsp;— {t['apiKeys.monthlySummary']}</code>
        <div className="text-[10px] text-muted-foreground mt-1 pt-1 border-t border-border">
          {t['apiKeys.header']} <code className="font-mono">X-API-Key: fz_…</code> {t['apiKeys.or']} <code className="font-mono">Authorization: Bearer fz_…</code>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={o => { if (!o) closeDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t['apiKeys.createTitle']}</DialogTitle></DialogHeader>
          {createdKey ? (
            <div className="space-y-4 mt-2">
              <div className="bg-income-soft/30 border border-income/20 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-income" />
                  <span className="text-sm font-medium">{t['apiKeys.createdBody']}</span>
                </div>
                <div className="relative">
                  <Input value={createdKey} readOnly className="font-mono text-xs pr-20" />
                  <button onClick={() => copyToClipboard(createdKey)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-md hover:bg-surface-2" title={t['apiKeys.copy']} aria-label={t['apiKeys.copy']}>
                    {copied ? <Check className="w-3.5 h-3.5 text-income" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {t['apiKeys.useHeader']}
                  <code className="block mt-1 p-2 bg-surface-2 rounded font-mono">Authorization: Bearer {createdKey.substring(0, 12)}...</code>
                </div>
              </div>
              <Button className="w-full h-11" onClick={closeDialog}>{t['apiKeys.done']}</Button>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t['apiKeys.agentName']}</Label>
                <Input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder={t['apiKeys.agentNamePlaceholder']} className="h-11" required />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t['apiKeys.permissions']}</Label>
                <Select value={newKeyPerms} onValueChange={setNewKeyPerms}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read,write">{t['apiKeys.readWrite']}</SelectItem>
                    <SelectItem value="read">{t['apiKeys.readOnly']}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full h-11">{t['apiKeys.create']}</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
