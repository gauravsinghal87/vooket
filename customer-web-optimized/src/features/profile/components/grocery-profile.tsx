import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  BookOpen,
  ChevronRight,
  CircleUser,
  CreditCard,
  FileText,
  LifeBuoy,
  LogOut,
  ShoppingBasket,
  Ticket,
  Trash2,
  Wallet as WalletIcon,
} from 'lucide-react';
import { Avatar } from '@/shared/components/ui/avatar';
import { toast } from '@/shared/components/ui/toast';
import { formatCurrency } from '@/shared/utils/utils';

/** Shared shape the profile page hands every module variant. */
export interface ProfileVariantProps {
  brand: string;
  user: { name?: string | null; email?: string | null; phone?: string | null } | null;
  /** Profile completion percentage (0-100) from the account's real fields. */
  completion: number;
  walletBalance: number | null;
  onBack: () => void;
  onOpenNotifications: () => void;
  onOpenCoupons: () => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
}

/** One grouped-card row: icon, label, optional right-side value, chevron. */
function GRow({
  icon: Icon,
  label,
  value,
  to,
  onClick,
  tone,
}: {
  icon: typeof CircleUser;
  label: string;
  value?: React.ReactNode;
  to?: string;
  onClick?: () => void;
  tone?: 'default' | 'danger';
}) {
  const danger = tone === 'danger';
  const content = (
    <span className="flex w-full items-center gap-3 px-4 py-3.5">
      <Icon className={`h-5 w-5 shrink-0 ${danger ? 'text-danger' : 'text-grocery-700'}`} />
      <span className={`flex-1 text-left text-sm font-semibold ${danger ? 'text-danger' : 'text-neutral-800'}`}>
        {label}
      </span>
      {value}
      <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" />
    </span>
  );
  if (to) {
    return (
      <Link to={to} className="block transition-colors hover:bg-grocery-50">
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className="block w-full text-left transition-colors hover:bg-grocery-50">
      {content}
    </button>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="px-1 pb-2 text-[13px] font-extrabold tracking-wide text-neutral-500">{title}</h2>
      <div className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-100 bg-white">
        {children}
      </div>
    </section>
  );
}

/**
 * The Grocery module's profile screen — the Blinkit "Your account" layout: a
 * soft yellow gradient header with the centred identity, three quick-action
 * cards, then the "Your information / Payment and coupons / Other" groups.
 * Every row maps to a real destination or action in this app (no fake entries).
 */
export function GroceryProfile({
  brand,
  user,
  completion,
  walletBalance,
  onBack,
  onOpenNotifications,
  onOpenCoupons,
  onLogout,
  onDeleteAccount,
}: ProfileVariantProps) {
  const identity = user?.name ?? user?.email ?? 'User';

  return (
    <div className="space-y-4">
      {/* Blinkit's soft yellow header; the module palette is already that gold. */}
      <div className="rounded-b-3xl bg-gradient-to-b from-grocery-200 via-grocery-100 to-grocery-50 px-4 pb-6 pt-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="tap flex h-10 w-10 items-center justify-center rounded-full bg-white text-neutral-800 shadow-sm transition-colors hover:bg-neutral-50"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="mt-2 flex flex-col items-center gap-1.5">
          <span className="rounded-full bg-white p-1 shadow-sm">
            <Avatar name={identity} size="lg" />
          </span>
          <h1 className="text-lg font-extrabold text-ink-900">Your account</h1>
          <p className="text-sm text-neutral-600">{user?.phone ?? user?.email ?? ''}</p>
          {completion < 100 && (
            <Link
              to="/profile/edit"
              className="mt-1 rounded-full bg-grocery-500 px-3 py-1 text-[12px] font-bold text-white transition-colors hover:bg-grocery-600"
            >
              Complete your profile · {completion}%
            </Link>
          )}
        </div>
      </div>

      {/* The three quick actions Blinkit leads with. */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          to="/orders"
          className="flex flex-col items-center gap-2 rounded-2xl border border-neutral-100 bg-white px-2 py-4 text-center transition-colors hover:border-neutral-200"
        >
          <ShoppingBasket className="h-7 w-7 text-grocery-700" />
          <span className="text-[13px] font-bold text-neutral-800">Your orders</span>
        </Link>
        <Link
          to="/wallet"
          className="flex flex-col items-center gap-2 rounded-2xl border border-neutral-100 bg-white px-2 py-4 text-center transition-colors hover:border-neutral-200"
        >
          <WalletIcon className="h-7 w-7 text-grocery-700" />
          <span className="text-[13px] font-bold text-neutral-800">{brand} Money</span>
          <span className="-mt-1 text-[12px] font-bold text-success">
            {walletBalance !== null ? formatCurrency(walletBalance) : '—'}
          </span>
        </Link>
        <Link
          to="/support"
          className="flex flex-col items-center gap-2 rounded-2xl border border-neutral-100 bg-white px-2 py-4 text-center transition-colors hover:border-neutral-200"
        >
          <LifeBuoy className="h-7 w-7 text-grocery-700" />
          <span className="text-[13px] font-bold text-neutral-800">Need help?</span>
        </Link>
      </div>

      <Group title="Your information">
        <GRow icon={BookOpen} label="Address book" to="/grocery/profile/addresses" />
        <GRow
          icon={CircleUser}
          label="Your profile"
          to="/profile/edit"
          value={
            completion < 100 ? (
              <span className="rounded-md bg-orange-100 px-2 py-0.5 text-[12px] font-bold text-orange-600">
                {completion}%
              </span>
            ) : undefined
          }
        />
      </Group>

      <Group title="Payment and coupons">
        <GRow
          icon={WalletIcon}
          label="Wallet"
          to="/wallet"
          value={
            <span className="text-sm font-bold text-success">
              {walletBalance !== null ? formatCurrency(walletBalance) : '—'}
            </span>
          }
        />
        <GRow icon={CreditCard} label="Payment settings" to="/profile/payments" />
        <GRow icon={Ticket} label="Your coupons" onClick={onOpenCoupons} />
      </Group>

      <Group title="Other">
        <GRow icon={Bell} label="Notifications" onClick={onOpenNotifications} />
        <GRow icon={LifeBuoy} label="Help & support" to="/support" />
        <GRow icon={FileText} label="Terms & policies" onClick={() => toast('Terms will open soon')} />
        <GRow icon={LogOut} label="Log out" tone="danger" onClick={onLogout} />
      </Group>

      <button
        type="button"
        onClick={onDeleteAccount}
        className="mx-auto flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-danger hover:bg-danger/10"
      >
        <Trash2 className="h-4 w-4" /> Delete account
      </button>

      <p className="pb-2 text-center text-xs font-bold text-neutral-400">{brand}</p>
    </div>
  );
}
