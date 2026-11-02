import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  Bell,
  Bike,
  ChevronRight,
  CircleUser,
  Coins,
  HelpCircle,
  LogOut,
  Package,
  Settings,
  ShieldCheck,
  Ticket,
  Trash2,
  Wallet as WalletIcon,
} from 'lucide-react';
import { Avatar } from '@/shared/components/ui/avatar';
import { toast } from '@/shared/components/ui/toast';
import { formatCurrency } from '@/shared/utils/utils';
import type { ProfileVariantProps } from './grocery-profile';

/** One flat list row in the Rapido menu style: icon, label, chevron. */
function RRow({
  icon: Icon,
  label,
  subtitle,
  value,
  iconClass,
  to,
  onClick,
  tone,
}: {
  icon: typeof CircleUser;
  label: string;
  subtitle?: string;
  value?: React.ReactNode;
  iconClass?: string;
  to?: string;
  onClick?: () => void;
  tone?: 'default' | 'danger';
}) {
  const danger = tone === 'danger';
  const content = (
    <span className="flex w-full items-center gap-3 px-4 py-3.5">
      <Icon className={`h-[22px] w-[22px] shrink-0 ${iconClass ?? (danger ? 'text-danger' : 'text-neutral-600')}`} />
      <span className="min-w-0 flex-1">
        <span className={`block text-left text-[15px] font-bold ${danger ? 'text-danger' : 'text-neutral-900'}`}>
          {label}
        </span>
        {subtitle && <span className="block text-xs font-medium text-neutral-500">{subtitle}</span>}
      </span>
      {value}
      <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" />
    </span>
  );
  if (to) {
    return (
      <Link to={to} className="block transition-colors hover:bg-neutral-50">
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className="block w-full text-left transition-colors hover:bg-neutral-50">
      {content}
    </button>
  );
}

/**
 * The Rides module's profile screen — Rapido's flat menu list: the account row
 * on top, then the ride-centric rows down to Log out, and the cream
 * "Become a Captain" promo strip at the bottom. Every row maps to a real
 * destination or action in this app.
 */
export function RidesProfile({
  brand,
  user,
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
      <button
        type="button"
        onClick={onBack}
        aria-label="Go back"
        className="tap -ml-1 flex h-10 w-10 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-200/70"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      {/* The flat white menu list. */}
      <div className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-100 bg-white">
        <Link to="/profile/edit" className="block transition-colors hover:bg-neutral-50">
          <span className="flex w-full items-center gap-3 px-4 py-4">
            <Avatar name={identity} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-extrabold text-neutral-900">{identity}</span>
              <span className="block text-xs text-neutral-500">{user?.phone ?? user?.email ?? ''}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" />
          </span>
        </Link>

        <RRow icon={HelpCircle} label="Help" to="/support" />
        <RRow
          icon={Package}
          label="Parcel - Send Items"
          onClick={() => toast('Parcel service coming soon')}
        />
        <RRow icon={WalletIcon} label="Payment" to="/profile/payments" />
        <RRow icon={CircleUser} label="My Rides" to="/orders" />
        <RRow
          icon={ShieldCheck}
          label="Safety"
          onClick={() => toast('Safety features coming soon')}
        />
        <RRow
          icon={Award}
          label="Refer and Earn"
          subtitle="Get ₹50"
          onClick={() => toast('Refer & earn coming soon')}
        />
        <RRow icon={Ticket} label="My Rewards" onClick={onOpenCoupons} />
        <RRow icon={Award} label={`${brand} Pass`} onClick={() => toast(`${brand} Pass coming soon`)} iconClass="text-amber-500" />
        <RRow
          icon={Coins}
          label={`${brand} Money`}
          value={
            <span className="text-sm font-bold text-success">
              {walletBalance !== null ? formatCurrency(walletBalance) : '—'}
            </span>
          }
          to="/wallet"
        />
        <RRow icon={Bell} label="Notifications" onClick={onOpenNotifications} />
        <RRow icon={Settings} label="Settings" to="/profile/edit" />
        <RRow icon={LogOut} label="Log out" tone="danger" onClick={onLogout} />
      </div>

      {/* Rapido's cream promo strip — become a delivery captain. */}
      <button
        type="button"
        onClick={() => toast('Captain signup coming soon')}
        className="tap flex w-full items-center gap-3 overflow-hidden rounded-2xl bg-amber-50 px-4 py-4 text-left transition-colors hover:bg-amber-100/70"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-extrabold text-ink-900">Earn money with {brand}</span>
          <span className="block text-sm text-neutral-600">Become a Captain!</span>
        </span>
        <Bike className="h-10 w-10 shrink-0 text-ink-700" />
      </button>

      <button
        type="button"
        onClick={onDeleteAccount}
        className="mx-auto flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-danger hover:bg-danger/10"
      >
        <Trash2 className="h-4 w-4" /> Delete account
      </button>
    </div>
  );
}
