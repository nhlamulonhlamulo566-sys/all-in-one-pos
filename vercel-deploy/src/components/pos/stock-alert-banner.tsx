'use client';

import { useState } from 'react';
import { BellRing, MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export type StockAlertItem = { name: string; size: string; stock: number; threshold: number };

function whatsappNumber(value: string) {
  const digits = value.replace(/[^0-9]/g, '');
  if (value.trim().startsWith('+')) return digits;
  if (digits.startsWith('0')) return `27${digits.slice(1)}`;
  return digits;
}

export function StockAlertBanner({ items, ownerPhone }: { items: StockAlertItem[]; ownerPhone?: string | null }) {
  const [dismissed, setDismissed] = useState(false);
  if (!items.length || dismissed) return null;

  const message = `*SPAZA POS LOW STOCK ALERT*\n\nThe following items need attention:\n\n${items.map((item, index) => `${index + 1}. *${item.name}*\n   Size/format: ${item.size}\n   Current stock: ${item.stock}\n   Threshold: ${item.threshold}`).join('\n\n')}\n\nPlease review the supplier quote list.`;
  const target = ownerPhone ? `https://wa.me/${whatsappNumber(ownerPhone)}?text=${encodeURIComponent(message)}` : `https://wa.me/?text=${encodeURIComponent(message)}`;

  return <Card className="border-destructive/40 bg-destructive/5"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><BellRing className="mt-0.5 h-5 w-5 shrink-0 text-destructive" /><div><p className="font-medium">Low stock needs attention</p><p className="text-sm text-muted-foreground">{items.length} item{items.length === 1 ? '' : 's'} reached its stock threshold. The owner can receive this alert on WhatsApp, even when away from the shop.</p></div></div><div className="flex shrink-0 gap-2"><Button size="sm" onClick={() => window.open(target, '_blank', 'noopener,noreferrer')}><MessageCircle className="mr-2 h-4 w-4" />Send WhatsApp alert</Button><Button size="icon" variant="ghost" onClick={() => setDismissed(true)} title="Dismiss low stock alert"><X className="h-4 w-4" /></Button></div></CardContent></Card>;
}