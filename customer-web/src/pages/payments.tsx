import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, CreditCard, Smartphone, Landmark } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

const METHODS = [
  { icon: Smartphone, label: 'UPI', detail: 'Google Pay, PhonePe, Paytm', color: 'bg-brand-50 text-brand-600' },
  { icon: CreditCard, label: 'Credit / Debit cards', detail: 'Visa, Mastercard, RuPay', color: 'bg-accent-50 text-accent-600' },
  { icon: Landmark, label: 'Net banking', detail: 'All major banks', color: 'bg-success/10 text-success' },
];

export function PaymentsPage() {
  return (
    <div className="mx-auto max-w-md space-y-5">
      <div>
        <Link to="/profile" className="mb-1 inline-flex items-center gap-1 text-sm font-semibold text-brand-600">
          <ArrowLeft className="h-4 w-4" /> Profile
        </Link>
        <h1 className="text-xl font-extrabold text-neutral-900">Payment methods</h1>
      </div>

      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-neutral-900">UPI</p>
            <p className="text-xs text-neutral-500">a***@okhdfc</p>
          </div>
          <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">Default</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-neutral-900">Credit card</p>
            <p className="text-xs text-neutral-500">HDFC •••• 4521</p>
          </div>
          <span className="text-xs text-neutral-400">Exp 09/27</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-neutral-900">Cash</p>
            <p className="text-xs text-neutral-500">Pay on delivery / at destination</p>
          </div>
        </div>
      </Card>

      <div className="space-y-2">
        <Button className="w-full" onClick={() => toast('Add payment method coming soon')}>
          <Plus className="h-4 w-4" /> Add payment method
        </Button>
        <p className="text-center text-xs text-neutral-500">Wallet balance is managed from the Wallet tab.</p>
      </div>

      <Card className="divide-y divide-neutral-100">
        {METHODS.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.label}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-neutral-50"
              onClick={() => toast('Coming soon')}
            >
              <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', m.color)}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-neutral-900">{m.label}</span>
                <span className="block text-xs text-neutral-500">{m.detail}</span>
              </span>
            </button>
          );
        })}
      </Card>
    </div>
  );
}